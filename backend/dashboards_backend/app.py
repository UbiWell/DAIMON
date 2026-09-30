from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
import time
import sys
import os
import json as json_lib
from collections import defaultdict
from flask_socketio import SocketIO, emit, join_room, leave_room
import fcntl  # For file locking on Unix systems
import threading  # For thread-safe operations

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import sensemaking_process
import random
import shutil
import json
import csv
from dashboards_backend.nl_interface.functions import summary, analysis, suggestions, graph, data_subsetting, \
    detect_mode
from dashboards_backend.nl_interface.nl_call_database import delete_call_by_view_id, get_call_statistics
from dashboards_backend.datatable.users import fetch_user_data
from dashboards_backend.datatable.functions import flag_issues
from dashboards_backend.issue_tracker.issue_tracker_database import create_issue, update_issue, get_issue
from dashboards_backend.issue_tracker.issue_manager import IssueManager
from datetime import datetime
from data_streams.past_issues import get_past_issue_by_id
import eventlet

eventlet.monkey_patch()

app = Flask(__name__, static_folder='static', static_url_path='/static')
# Use eventlet for production, threading for development
# Flask-SocketIO will auto-detect eventlet if available, otherwise fall back to threading
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
CORS(app, resources={r"/*": {"origins": "*"}})

# Store active users per dashboard room
active_users = defaultdict(dict)  # {dashboard_id: {username: {cursor: {x, y}, timestamp, sid}}}

# Store shared dashboard states (for collaborative editing)
# Format: {dashboard_id: {'state': {...}, 'file_mtime': timestamp}}
# This allows us to validate cache freshness by checking file modification time
shared_dashboard_states = {}  # {dashboard_id: {'state': {...}, 'file_mtime': float}}

# File locks for thread-safe file operations
_file_locks = {}  # {dashboard_id: threading.Lock()}
_file_locks_lock = threading.Lock()  # Lock for accessing _file_locks dict

# Dashboard state storage configuration
DASHBOARD_STATE_DIR = os.path.dirname(__file__)
DASHBOARD_STATE_FILE_PREFIX = "dashboard_state_"
DASHBOARD_STATE_FILE_EXT = ".json"
SHARED_DASHBOARD_FILE_PREFIX = "shared_"


def _get_dashboard_state_file_path(username: str) -> str:
    """Get the file path for a user's dashboard state."""
    filename = f"{DASHBOARD_STATE_FILE_PREFIX}{username}{DASHBOARD_STATE_FILE_EXT}"
    return os.path.join(DASHBOARD_STATE_DIR, filename)


def save_dashboard_state_to_file(username: str, state: dict) -> bool:
    """Save dashboard state to JSON file."""
    try:
        file_path = _get_dashboard_state_file_path(username)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving dashboard state for {username}: {e}")
        return False


def load_dashboard_state_from_file(username: str) -> dict:
    """Load dashboard state from JSON file."""
    try:
        file_path = _get_dashboard_state_file_path(username)
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading dashboard state for {username}: {e}")
    return None


def _get_shared_dashboard_file_path(dashboard_id: str) -> str:
    """Get the file path for a shared dashboard state."""
    filename = f"{SHARED_DASHBOARD_FILE_PREFIX}{dashboard_id}{DASHBOARD_STATE_FILE_EXT}"
    return os.path.join(DASHBOARD_STATE_DIR, filename)


def _get_file_lock(dashboard_id: str) -> threading.Lock:
    """Get or create a file lock for a dashboard ID."""
    with _file_locks_lock:
        if dashboard_id not in _file_locks:
            _file_locks[dashboard_id] = threading.Lock()
        return _file_locks[dashboard_id]


def save_shared_dashboard_state(dashboard_id: str, state: dict) -> bool:
    """Save shared dashboard state to JSON file with atomic write and file locking."""
    file_lock = _get_file_lock(dashboard_id)
    file_path = _get_shared_dashboard_file_path(dashboard_id)
    
    with file_lock:  # Acquire lock before file operations
        try:
            # Write to temporary file first, then rename (atomic operation)
            temp_file_path = file_path + '.tmp'
            with open(temp_file_path, 'w', encoding='utf-8') as f:
                json.dump(state, f, indent=2)
                f.flush()
                os.fsync(f.fileno())  # Force write to disk
            
            # Atomic rename (works on Unix and Windows)
            if os.path.exists(file_path):
                os.replace(temp_file_path, file_path)
            else:
                os.rename(temp_file_path, file_path)
            
            # Also update in-memory cache with file modification time
            file_mtime = os.path.getmtime(file_path) if os.path.exists(file_path) else time.time()
            shared_dashboard_states[dashboard_id] = {
                'state': state,
                'file_mtime': file_mtime
            }
            print(f"Successfully saved dashboard state for {dashboard_id} with timestamp {state.get('timestamp', 'unknown')}")
            return True
        except Exception as e:
            print(f"Error saving shared dashboard state for {dashboard_id}: {e}")
            # Clean up temp file if it exists
            temp_file_path = file_path + '.tmp'
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except:
                    pass
            return False


def load_shared_dashboard_state(dashboard_id: str, force_reload: bool = False) -> dict:
    """Load shared dashboard state from JSON file with file locking.
    
    Args:
        dashboard_id: The dashboard ID
        force_reload: If True, always reload from file (bypass cache)
    
    Returns:
        The dashboard state dict, or None if not found
    """
    file_lock = _get_file_lock(dashboard_id)
    file_path = _get_shared_dashboard_file_path(dashboard_id)
    
    # If force_reload, always read from file to get latest state
    if force_reload:
        with file_lock:  # Acquire lock before file operations
            # CRITICAL: Always clear cache first when force_reload is True
            # This ensures we never serve stale cached state
            if dashboard_id in shared_dashboard_states:
                del shared_dashboard_states[dashboard_id]
                print(f"Cleared in-memory cache for {dashboard_id} before force reload")
            
            try:
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8') as f:
                        state = json.load(f)
                        # Validate state structure
                        if not isinstance(state, dict):
                            print(f"Invalid state structure for {dashboard_id}, returning None")
                            return None
                        
                        # Update cache with latest state from disk and file modification time
                        file_mtime = os.path.getmtime(file_path)
                        shared_dashboard_states[dashboard_id] = {
                            'state': state,
                            'file_mtime': file_mtime
                        }
                        timestamp = state.get('timestamp', 'unknown')
                        pages_count = len(state.get('pages', []))
                        total_views = sum(len(page.get('views', [])) for page in state.get('pages', []))
                        print(f"Force reloaded dashboard state for {dashboard_id} from disk: timestamp={timestamp}, pages={pages_count}, views={total_views}")
                        return state
                else:
                    # File doesn't exist - ensure cache is cleared
                    if dashboard_id in shared_dashboard_states:
                        del shared_dashboard_states[dashboard_id]
                    print(f"Dashboard state file does not exist for {dashboard_id}, cache cleared and returning None")
                    return None
            except json.JSONDecodeError as e:
                print(f"JSON decode error loading dashboard state for {dashboard_id}: {e}")
                # Try to read backup or return None
                return None
            except Exception as e:
                print(f"Error loading shared dashboard state for {dashboard_id}: {e}")
        return None
    
    # Check in-memory cache first (but still use lock for consistency)
    with file_lock:
        # CRITICAL: Only use cache if file exists
        # If file doesn't exist, clear cache and return None
        # This prevents serving stale cached data when file is deleted
        if not os.path.exists(file_path):
            if dashboard_id in shared_dashboard_states:
                del shared_dashboard_states[dashboard_id]
                print(f"File {file_path} does not exist - cleared cache for {dashboard_id}")
            return None
        
        # File exists - check cache first, but validate file modification time
        if dashboard_id in shared_dashboard_states:
            cached_entry = shared_dashboard_states[dashboard_id]
            
            # CRITICAL: Validate cache freshness by checking file modification time
            # If file was modified after cache was created, cache is stale - reload from disk
            try:
                current_file_mtime = os.path.getmtime(file_path)
                cached_file_mtime = cached_entry.get('file_mtime', 0)
                
                # If file was modified after cache was created, cache is stale
                if current_file_mtime > cached_file_mtime:
                    print(f"Cache for {dashboard_id} is stale (file modified {current_file_mtime} > cache {cached_file_mtime}), reloading from disk")
                    # Clear stale cache and reload from disk below
                    del shared_dashboard_states[dashboard_id]
                else:
                    # Cache is fresh - return cached state
                    return cached_entry.get('state')
            except (OSError, ValueError) as e:
                # File might have been deleted or error reading mtime - clear cache
                print(f"Error checking file mtime for {dashboard_id}: {e}, clearing cache")
                del shared_dashboard_states[dashboard_id]

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                state = json.load(f)
                # Cache it with file modification time for future validation
                file_mtime = os.path.getmtime(file_path)
                shared_dashboard_states[dashboard_id] = {
                    'state': state,
                    'file_mtime': file_mtime
                }
                return state
        except json.JSONDecodeError as e:
            print(f"JSON decode error loading dashboard state for {dashboard_id}: {e}")
            # Clear cache on error
            if dashboard_id in shared_dashboard_states:
                del shared_dashboard_states[dashboard_id]
            return None
        except Exception as e:
            print(f"Error loading shared dashboard state for {dashboard_id}: {e}")
            # Clear cache on error
            if dashboard_id in shared_dashboard_states:
                del shared_dashboard_states[dashboard_id]
    return None


# Parse incoming requests for GLOSS
def parse_request(request):
    if request.method == 'POST':
        # For POST requests, get data from JSON body
        data = request.get_json()
        print("******************************")
        print(data)
        query = data.get("query", "") if data else ""
        view_id = data.get("viewId", "default") if data else "default"
        refresh_interval = data.get("refreshInterval", "none") if data else "none"
        is_redo = data.get("isRedo", False) if data else False
        ra_name = data.get("raName", "") if data else ""
    else:
        # For GET requests, get data from query parameters
        query = request.args.get("query", "")
        view_id = request.args.get("viewId", "default")
        refresh_interval = request.args.get("refreshInterval", "none")
        is_redo = request.args.get("isRedo", "false").lower() == "true"
        ra_name = request.args.get("raName", "")

    return query, view_id, refresh_interval, is_redo, ra_name


@app.route('/api/users', methods=['GET', 'POST'])
def datatable_users():
    try:
        # Get date from query parameter or use current date
        date_str = request.args.get('date')
        if not date_str:
            date_str = datetime.now().strftime('%m/%d/%y')

        print(f"Fetching data for date: {date_str}")
        user_data = fetch_user_data(date_str)
        return user_data
    except Exception as error:
        print(f'Error fetching users: {error}')
        return jsonify({'error': 'Failed to fetch users', 'details': str(error)}), 500


@app.route("/api/nl/summary", methods=['POST', 'GET'])
def summary_nl():
    query, view_id, refresh_interval, is_redo, ra_name = parse_request(request)
    result = summary(query=query, view_id=view_id, is_redo=is_redo, ra_name=ra_name)
    return jsonify(result)


@app.route("/api/nl/analysis", methods=['POST', 'GET'])
def analysis_nl():
    query, view_id, refresh_interval, is_redo, ra_name = parse_request(request)
    result = analysis(query=query, view_id=view_id, is_redo=is_redo, ra_name=ra_name)
    return jsonify(result)


@app.route("/api/nl/suggestions", methods=['POST', 'GET'])
def suggestions_nl():
    query, view_id, refresh_interval, is_redo, ra_name = parse_request(request)
    result = suggestions(query=query, view_id=view_id, is_redo=is_redo, ra_name=ra_name)
    return jsonify(result)


@app.route("/test-static")
def test_static():
    """Test route to verify static file serving"""
    import os
    static_path = os.path.join(app.root_path, 'static', 'images')
    files = os.listdir(static_path) if os.path.exists(static_path) else []
    return jsonify({
        "static_folder": app.static_folder,
        "static_url_path": app.static_url_path,
        "root_path": app.root_path,
        "static_images_path": static_path,
        "files_in_static_images": files
    })


@app.route('/static/images/<filename>')
def serve_static_image(filename):
    """Explicit route to serve static images"""
    return send_from_directory('static/images', filename)


@app.route("/api/nl/plotting", methods=['POST', 'GET'])
def plotting_nl():
    query, view_id, refresh_interval, is_redo, ra_name = parse_request(request)
    result = graph(query=query, view_id=view_id, is_redo=is_redo, ra_name=ra_name)
    return jsonify(result)


@app.route("/api/nl/datasubsets", methods=['POST', 'GET'])
def data_subsetting_nl():
    query, view_id, refresh_interval, is_redo, ra_name = parse_request(request)
    result = data_subsetting(query=query, view_id=view_id, is_redo=is_redo, ra_name=ra_name)
    return jsonify(result)


@app.route("/api/nl/detect-mode", methods=['POST', 'GET'])
def detect_mode_nl():
    query, view_id, refresh_interval, is_redo, ra_name = parse_request(request)
    try:
        mode = detect_mode(query=query, view_id=view_id, refresh_interval=refresh_interval, is_redo=is_redo,
                           ra_name=ra_name)
        return jsonify(mode)
    except Exception as e:
        print(f"Error detecting mode: {e}")
        return jsonify({"error": "Failed to detect mode", "details": str(e)}), 500


@app.route("/api/nl/destroy-view", methods=['POST', 'DELETE'])
def destroy_view():
    """
    API endpoint to destroy a view and remove its data from the database.

    Expected JSON payload:
    {
        "view_id": "dashboard_view_001"
    }

    Or as query parameter: ?view_id=dashboard_view_001
    """
    try:
        # Get view_id from request
        if request.method == 'POST':
            data = request.get_json()
            view_id = data.get("viewId") if data else None
        else:  # DELETE method
            view_id = request.args.get("viewId")

        if not view_id:
            return jsonify({
                "error": "viewId is required",
                "message": "Please provide viewId in JSON body (POST) or query parameter (DELETE)"
            }), 400

        # Delete all calls for this view_id from database
        success = delete_call_by_view_id(view_id)

        if success:
            return jsonify({
                "success": True,
                "message": f"Successfully destroyed view '{view_id}' and removed all associated data",
                "view_id": view_id,
                "timestamp": datetime.now().isoformat()
            })
        else:
            return jsonify({
                "success": False,
                "message": f"No data found for view '{view_id}'",
                "view_id": view_id,
                "timestamp": datetime.now().isoformat()
            })

    except Exception as e:
        print(f"Error destroying view: {e}")
        return jsonify({
            "error": "Failed to destroy view",
            "details": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500


@app.route("/api/nl/database-stats", methods=['GET'])
def database_stats():
    """
    API endpoint to get database statistics.

    Returns statistics about NL calls including:
    - Total calls
    - Mode breakdown
    - Refresh interval breakdown
    - Redo breakdown
    """
    try:
        stats = get_call_statistics()
        return jsonify({
            "success": True,
            "statistics": stats,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        print(f"Error getting database stats: {e}")
        return jsonify({
            "error": "Failed to get database statistics",
            "details": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500


@app.route("/api/evaluate-criteria", methods=['POST'])
def evaluate_criteria():
    """
    API endpoint to evaluate sensemaking criteria.
    """
    data = request.get_json()
    criteria = data.get("criteria", {})
    date_str = data.get("date", datetime.now().strftime('YYYY-MM-DD'))
    viewId = data.get("viewId", "default")

    response = flag_issues(criteria, date_str, viewId)
    return jsonify(response)


@app.route("/api/issues/create", methods=['POST'])
def create_issue_api():
    """
    API endpoint to create a new issue.

    Expected JSON payload:
    {
        "userId": "test004",
        "reason": "High phone usage detected",
        "potentialPastIssues": [],
        "color": "yellow",
        "raName": "Akshat"
    }

    Returns:
    {
        "issueID": "ISSUE_1"
    }
    """
    try:
        data = request.get_json()

        # Extract parameters
        user_id = data.get("userId")
        reason = data.get("reason", "")
        potential_past_issues = data.get("potentialPastIssues", [])
        color = data.get("color", "green")
        ra_name = data.get("raName", "")

        # Validate required parameters
        if not user_id:
            return jsonify({
                "error": "userId is required",
                "message": "Please provide userId in the request body"
            }), 400

        if not ra_name:
            return jsonify({
                "error": "raName is required",
                "message": "Please provide raName in the request body"
            }), 400

        # Generate issue ID using counter
        issue_manager = IssueManager()
        issue_id = issue_manager.generate_issue_id(prefix="ISSUE")

        # Create the issue with specified parameters
        issue = create_issue(
            issue_id=issue_id,
            summary=reason,
            status="not started",
            priority="not decided",
            assignee=ra_name,  # Assignee is now raName
            severity=color,  # Map color to severity
            uid=user_id  # User ID who reported the issue
        )

        # Set empty notes (RA notes [])
        issue.set_notes({})

        # Set potential past issues if provided
        if potential_past_issues:
            for past_issue_id in potential_past_issues:
                issue.add_potential_past_issue(past_issue_id, {})

        # Return the issue ID
        return jsonify({
            "issueId": issue_id,
            "message": f"Issue created successfully for user {user_id} by {ra_name}",
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        print(f"Error creating issue: {e}")
        return jsonify({
            "error": "Failed to create issue",
            "details": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500


@app.route("/api/issues/update", methods=['POST'])
def update_issue_api():
    """
    API endpoint to update an existing issue.

    Expected JSON payload:
    {
        "issueId": "ISSUE_1",
        "status": "in progress",
        "priority": "high",
        "resolution": "Fixed by updating configuration",
        "reason": "High phone usage detected",
        "raNotes": [
            {
                "notes": "User reported connectivity issues",
                "username": "RA_John",
                "timestamp": 1758562263
            },
            {
                "notes": "Followed up with technical support",
                "username": "RA_John",
                "timestamp": 1758562264
            }
        ],
        "raName": "Akshat",
        "color": "yellow"
    }

    Returns:
    {
        "message": "Issue updated successfully",
        "issueId": "ISSUE_1",
        "timestamp": "2024-01-01T10:00:00"
    }
    """
    try:
        data = request.get_json()

        # Extract parameters
        issue_id = data.get("issueId")
        status = data.get("status")
        priority = data.get("priority")
        resolution = data.get("resolution")
        reason = data.get("reason")  # Map reason to summary
        ra_notes = data.get("raNotes", [])
        ra_name = data.get("raName", "")
        color = data.get("color", "green")  # Map color to severity

        # Validate required parameters
        if not issue_id:
            return jsonify({
                "error": "issueId is required",
                "message": "Please provide issueId in the request body"
            }), 400

        # Check if issue exists
        existing_issue = get_issue(issue_id)
        if not existing_issue:
            return jsonify({
                "error": "Issue not found",
                "message": f"Issue with ID {issue_id} does not exist"
            }), 404

        # Prepare updates dictionary
        updates = {}

        print(data)
        # Update status if provided
        if status is not None:
            updates["status"] = status

        # Update priority if provided
        if priority is not None:
            updates["priority"] = priority

        # Update resolution if provided
        if resolution is not None:
            updates["resolution"] = resolution

        # Update summary if reason is provided (map reason to summary)
        if reason is not None:
            updates["summary"] = reason

        # Update severity if color is provided (map color to severity)
        if color is not None:
            updates["severity"] = color

        # Update assignee if raName is provided
        if ra_name:
            updates["assignee"] = ra_name

        # Clear troubleshooting_steps when issue is updated (since content may have changed)
        if updates:
            updates["troubleshooting_steps"] = ""  # Clear cached troubleshooting steps
            updated_issue = update_issue(issue_id, updates)
            if not updated_issue:
                return jsonify({
                    "error": "Failed to update issue",
                    "message": "Issue update operation failed"
                }), 500

        # Handle RA notes if provided
        if ra_notes:
            # Convert ra_notes list to notes dictionary
            notes_dict = {}
            for i, note_data in enumerate(ra_notes):
                if isinstance(note_data, dict):
                    # New format: {"notes": "content", "username": "RA_John", "timestamp": 1758562263}
                    note_content = note_data.get("notes", "")
                    username = note_data.get("username", ra_name or "Unknown")
                    timestamp = note_data.get("timestamp", int(time.time()))
                    note_id = f"{username}_{timestamp}"
                    notes_dict[note_id] = {
                        "content": note_content,
                        "username": username,
                        "timestamp": timestamp
                    }
                else:
                    # Legacy format: just a string
                    note_id = f"{ra_name}_{int(time.time())}" if ra_name else f"note_{int(time.time())}"
                    notes_dict[note_id] = {
                        "content": str(note_data),
                        "username": ra_name or "Unknown",
                        "timestamp": int(time.time())
                    }

            # Update notes and clear troubleshooting_steps (since notes changed)
            existing_issue = get_issue(issue_id)  # Get fresh copy
            if existing_issue:
                existing_issue.set_notes(notes_dict)
                # Save the updated issue back to database, clearing troubleshooting_steps
                update_issue(issue_id, {"notes": notes_dict, "troubleshooting_steps": ""})

        # Return success response
        return jsonify({
            "message": "Issue updated successfully",
            "issueId": issue_id,
            "updatedFields": list(updates.keys()) + (["notes"] if ra_notes else []),
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        print(f"Error updating issue: {e}")
        return jsonify({
            "error": "Failed to update issue",
            "details": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500


@app.route("/api/issues/delete", methods=['DELETE'])
def delete_issue_api():
    """
    API endpoint to delete an issue by its ID.

    Expected JSON payload:
    {
        "issueId": "ISSUE_21"
    }

    Returns:
    {
        "message": "Issue deleted successfully",
        "issueId": "ISSUE_21",
        "timestamp": 1705312245
    }
    """
    try:
        data = request.get_json()

        # Extract issue ID
        issue_id = data.get("issueId") if data else None

        # Validate required parameters
        if not issue_id:
            return jsonify({
                "error": "issueId is required",
                "message": "Please provide issueId in the request body"
            }), 400

        # Import delete_issue function
        from dashboards_backend.issue_tracker.issue_tracker_database import delete_issue

        # Delete the issue
        success = delete_issue(issue_id)

        if success:
            return jsonify({
                "success": True,
                "message": "Issue deleted successfully"
            })
        else:
            return jsonify({
                "error": "Issue not found",
                "message": f"Issue with ID {issue_id} does not exist"
            }), 404

    except Exception as e:
        print(f"Error deleting issue: {e}")
        return jsonify({
            "error": "Failed to delete issue",
            "details": str(e),
            "timestamp": int(time.time())
        }), 500


@app.route("/api/issues/csv", methods=['GET'])
def get_issues_csv():
    """
    API endpoint to return all issues as structured JSON data.

    Returns:
        Structured JSON data with all issues, or error message if file doesn't exist
    """
    try:
        import os
        import csv
        import json
        csv_file_path = os.path.join(os.path.dirname(__file__), 'issue_tracker', 'issues.csv')

        # Check if CSV file exists
        if not os.path.exists(csv_file_path):
            return jsonify({
                "error": "No issues found",
                "message": "Issues CSV file does not exist yet",
                "issues": []
            }), 404

        # Read and parse CSV file content
        issues = []
        with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Parse JSON fields properly
                if row.get('notes'):
                    try:
                        row['notes'] = json.loads(row['notes'])
                    except json.JSONDecodeError:
                        print(f"Warning: Could not parse notes JSON for issue {row.get('id', 'unknown')}")
                        row['notes'] = {}
                else:
                    row['notes'] = {}

                if row.get('potential_past_issues'):
                    try:
                        row['potential_past_issues'] = json.loads(row['potential_past_issues'])
                    except json.JSONDecodeError:
                        print(
                            f"Warning: Could not parse potential_past_issues JSON for issue {row.get('id', 'unknown')}")
                        row['potential_past_issues'] = {}
                else:
                    row['potential_past_issues'] = {}

                issues.append(row)

        # Return structured JSON data
        return jsonify({
            "success": True,
            "message": "Issues data retrieved successfully",
            "issues": issues,
            "count": len(issues),
            "timestamp": int(time.time())
        })

    except Exception as e:
        print(f"Error reading issues CSV: {e}")
        return jsonify({
            "error": "Failed to read issues CSV",
            "details": str(e),
            "timestamp": int(time.time())
        }), 500


@app.route("/api/issues/past-issues", methods=['POST'])
def get_past_issues_api():
    """
    API endpoint to fetch relevant past issues using RAG-based agent.

    Expected JSON payload:
    {
        "query": "What past issues are similar to battery problems for user test007?"
    }

    Returns:
    {
        "success": true,
        "past_issues": ["ISSUE_1", "ISSUE_4"],
        "message": "Relevant past issues retrieved successfully",
        "timestamp": 1705312245
    }
    """
    try:
        data = request.get_json()

        # Extract query from request
        query = data.get("summary") if data else None
        issue_id = data.get("issueId") if data else None

        # Validate required parameters
        if not query:
            return jsonify({
                "error": "query is required",
                "message": "Please provide a query in the request body"
            }), 400

        # Check for cached results first
        cached_results = None
        if issue_id:
            try:
                current_issue = get_issue(issue_id)
                if current_issue:
                    potential_past_issues = current_issue.get_potential_past_issues()
                    # Look for recent RAG cache entries
                    for key, value in potential_past_issues.items():
                        if key.startswith("rag_cache_") and isinstance(value, dict):
                            if value.get("rag_agent_used") and value.get("query") == query:
                                # Check if cache is recent (within 1 hour)
                                cache_age = int(time.time()) - value.get("timestamp", 0)
                                if cache_age < 3600:  # 1 hour
                                    cached_results = value.get("past_issues", [])
                                    print(f"Using cached RAG results for issue {issue_id} (age: {cache_age}s)")
                                    break
            except Exception as cache_error:
                print(f"Warning: Failed to check cache for issue {issue_id}: {cache_error}")

        # If we have cached results, use them
        if cached_results is not None:
            past_issues_info = cached_results
        else:
            # Import the RAG agent
            from agents.past_issues_rag_agent import RAGBasedPastIssuesAgent

            # Initialize and invoke the RAG agent
            rag_agent = RAGBasedPastIssuesAgent()
            result = rag_agent.invoke_rag_agent({'question': query})

            # Extract past issues from the result
            past_issues = []
            if result and hasattr(result, 'past_issues'):
                past_issues = result.past_issues
            elif isinstance(result, dict) and 'past_issues' in result:
                past_issues = result['past_issues']
            elif isinstance(result, list):
                past_issues = result

            past_issues_info = []
            if issue_id in past_issues:
                past_issues.remove(issue_id)

            for p in past_issues:
                issue = get_past_issue_by_id(p)
                print(issue)
                past_issues_info += [{"id": issue['id'], "summary": issue['summary'], "status": issue['status'],
                                      "created_at": issue['created_at']}]

        # Cache the results in the issue's potential_past_issues field (only if we ran RAG agent)
        if issue_id and past_issues_info and cached_results is None:
            try:
                # Get the current issue
                current_issue = get_issue(issue_id)
                if current_issue:
                    # Create a cache entry with timestamp and results
                    cache_entry = {
                        "timestamp": int(time.time()),
                        "query": query,
                        "past_issues": past_issues_info,
                        "rag_agent_used": True
                    }

                    # Update the issue with cached results
                    current_issue.add_potential_past_issue(f"rag_cache_{int(time.time())}", cache_entry)

                    # Save the updated issue back to database
                    update_issue(issue_id, {"potential_past_issues": current_issue.get_potential_past_issues()})

                    print(f"Cached RAG results for issue {issue_id}")
            except Exception as cache_error:
                print(f"Warning: Failed to cache RAG results for issue {issue_id}: {cache_error}")

        print({
            "success": True,
            "past_issues": past_issues_info,
            "message": f"Found {len(past_issues_info)} relevant past issues",
            "timestamp": int(time.time())
        })

        return jsonify({
            "success": True,
            "past_issues": past_issues_info,
            "message": f"Found {len(past_issues_info)} relevant past issues",
            "timestamp": int(time.time())
        })

    except Exception as e:
        print(f"Error fetching past issues: {e}")
        return jsonify({
            "error": "Failed to fetch past issues",
            "details": str(e),
            "timestamp": int(time.time())
        }), 500


@app.route("/api/issues/<issue_id>", methods=['GET'])
def get_issue_by_id_api(issue_id):
    print(issue_id)
    """
    API endpoint to fetch a specific issue by its ID.

    URL Parameters:
        issue_id: The ID of the issue to fetch

    Returns:
    {
        "success": true,
        "issue": {
            "id": "ISSUE_1",
            "summary": "High phone usage detected",
            "status": "in progress",
            "priority": "medium",
            "assignee": "Akshat",
            "uid": "test004",
            "severity": "yellow",
            "created_at": "2024-01-15 10:30:45",
            "updated_at": "2024-01-15 10:30:45",
            "resolved_at": null,
            "troubleshooting_steps": "Check app usage patterns",
            "resolution": "Fixed by updating configuration",
            "notes": {"RA_John_1": "User reported connectivity issues"}
        },
        "message": "Issue retrieved successfully",
        "timestamp": 1705312245
    }
    """
    try:
        # Use get_past_issue_by_id from past_issues module
        issue_dict = get_past_issue_by_id(issue_id)

        print({
            "success": True,
            "issue": issue_dict,
            "message": "Issue retrieved successfully",
            "timestamp": int(time.time())
        })

        if not issue_dict:
            return jsonify({
                "error": "Issue not found",
                "message": f"Issue with ID {issue_id} does not exist"
            }), 404

        return jsonify({
            "success": True,
            "issue": issue_dict,
            "message": "Issue retrieved successfully",
            "timestamp": int(time.time())
        })

    except Exception as e:
        print(f"Error fetching issue {issue_id}: {e}")
        return jsonify({
            "error": "Failed to fetch issue",
            "details": str(e),
            "timestamp": int(time.time())
        }), 500


@app.route("/api/generate-email", methods=['POST'])
def generate_email_api():
    """
    API endpoint to generate an email using the email agent.

    Expected JSON payload:
    {
        "userId": "test004",
        "reason": "High phone usage detected",
        "raName": "Akshat",
        "troubleshootingSteps": "Check app usage patterns and reduce screen time",
        "raNotes": [
            {
                "notes": "User reported connectivity issues",
                "username": "RA_John",
                "timestamp": 1758562263
            }
        ]
    }

    Returns:
    {
        "success": true,
        "email": "Dear test004,\n\nWe noticed some data collection issues...\n\nBest,\nAkshat\nConnect Research Team",
        "timestamp": 1705312245
    }
    """
    try:
        data = request.get_json()

        # Extract parameters
        user_id = data.get("userId")
        reason = data.get("reason", "")
        ra_name = data.get("raName", "")
        troubleshooting_steps = data.get("troubleshootingSteps", "")
        ra_notes = data.get("raNotes", [])

        # Validate required parameters
        if not user_id:
            return jsonify({
                "error": "userId is required",
                "message": "Please provide userId in the request body"
            }), 400

        if not ra_name:
            return jsonify({
                "error": "raName is required",
                "message": "Please provide raName in the request body"
            }), 400

        # Process ra_notes to create past_notes string
        past_notes = ""
        if ra_notes and isinstance(ra_notes, list):
            note_strings = []
            for note in ra_notes:
                if isinstance(note, dict):
                    note_content = note.get("notes", "")
                    username = note.get("username", "Unknown")
                    timestamp = note.get("timestamp", "")
                    if note_content:
                        note_strings.append(f"{username}: {note_content}")
                elif isinstance(note, str):
                    note_strings.append(note)
            past_notes = "; ".join(note_strings)

        # Import and initialize the email agent
        from agents.email_agent import EmailAgent

        # Prepare input parameters for the email agent
        input_params = {
            'user_id': user_id,
            'ra_name': ra_name,
            'summary': reason,
            'past_notes': past_notes,
            'troubleshooting_steps': troubleshooting_steps
        }

        # Generate email using the email agent
        email_agent = EmailAgent()
        result = email_agent.invoke_email_agent(input_params)

        # Extract email content from the result
        email_content = ""
        if hasattr(result, 'email'):
            email_content = result.email
        elif isinstance(result, dict) and 'email' in result:
            email_content = result['email']
        elif isinstance(result, str):
            email_content = result
        else:
            email_content = str(result)

        # Return the generated email
        return jsonify({
            "success": True,
            "email": email_content,
            "message": "Email generated successfully",
            "timestamp": int(time.time())
        })

    except Exception as e:
        print(f"Error generating email: {e}")
        return jsonify({
            "error": "Failed to generate email",
            "details": str(e),
            "timestamp": int(time.time())
        }), 500


@app.route("/api/generate-troubleshooting", methods=['POST'])
def generate_troubleshooting_api():
    """
    API endpoint to generate troubleshooting steps for an issue.

    Expected JSON payload:
    {
        "issueId": "string"          // The issue ID (auto-generated if not provided)
    }

    Returns:
    {
        "troubleshootingSteps": "string"      // The generated troubleshooting steps text
    }
    """
    try:
        data = request.get_json()
        issue_id = data.get("issueId")

        if not issue_id:
            return jsonify({
                "error": "issueId is required",
                "timestamp": int(time.time())
            }), 400

        # Import the troubleshooting function
        from dashboards_backend.datatable.functions import troubleshooting

        # Call the troubleshooting function
        result = troubleshooting(issue_id)
        print(f"Troubleshooting result: {result}")
        print(type(result))
        # try converting result to json
        # if isinstance(result, str):
        #     try:
        #         result = json.loads(result)
        #     except json.JSONDecodeError:
        #         pass

        # Extract troubleshooting steps from the result
        troubleshooting_steps = ""
        if isinstance(result, dict):
            if "troubleshooting_plan" in result:
                troubleshooting_steps = result["troubleshooting_plan"]
            elif "results" in result:
                troubleshooting_steps = result["results"]
            else:
                troubleshooting_steps = str(result)
        else:
            troubleshooting_steps = str(result)

        return jsonify({
            "success": True,
            "troubleshootingSteps": troubleshooting_steps,
            "message": "Troubleshooting steps generated successfully",
            "timestamp": int(time.time())
        })

    except Exception as e:
        print(f"Error generating troubleshooting steps: {e}")
        return jsonify({
            "error": "Failed to generate troubleshooting steps",
            "details": str(e),
            "timestamp": int(time.time())
        }), 500


@app.route("/api/dashboard/state", methods=['GET', 'POST'])
def dashboard_state_api():
    """
    API endpoint for dashboard state (pan, zoom, currentPageId).

    GET: Retrieve dashboard state for a user
    POST: Save dashboard state for a user

    GET Parameters:
        username: The username

    POST JSON Body:
        {
            "username": "user123",
            "state": {
                "panOffset": {"x": 0, "y": 0},
                "zoom": 1,
                "currentPageId": 1,
                "lastUpdated": 1234567890
            }
        }
    """
    try:
        if request.method == 'GET':
            username = request.args.get('username')
            if not username:
                return jsonify({
                    "error": "username parameter is required"
                }), 400

            state = load_dashboard_state_from_file(username)
            if state:
                response = jsonify({
                    "success": True,
                    "state": state.get("state", state),
                    "username": username
                })
                # CRITICAL: Prevent caching of dashboard state API responses
                response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'
                return response
            else:
                response = jsonify({
                    "success": False,
                    "message": "No dashboard state found for user"
                })
                response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'
                return response, 404

        elif request.method == 'POST':
            data = request.get_json()
            if not data:
                return jsonify({
                    "error": "Request body is required"
                }), 400

            username = data.get('username')
            state_data = data.get('state')

            if not username:
                return jsonify({
                    "error": "username is required"
                }), 400

            if not state_data:
                return jsonify({
                    "error": "state is required"
                }), 400

            # Load existing state to preserve pages and other fields
            existing_state = load_dashboard_state_from_file(username) or {}

            # Merge new state data with existing state, preserving pages
            full_state = {
                "username": username,
                "lastUpdated": datetime.now().isoformat()
            }

            # Preserve pages from existing state if they exist
            if 'pages' in existing_state:
                full_state['pages'] = existing_state['pages']
            if 'idCounters' in existing_state:
                full_state['idCounters'] = existing_state['idCounters']

            # Include pan/zoom/currentPageId from new state_data
            if 'panOffset' in state_data:
                full_state['panOffset'] = state_data['panOffset']
            if 'zoom' in state_data:
                full_state['zoom'] = state_data['zoom']
            if 'currentPageId' in state_data:
                full_state['currentPageId'] = state_data['currentPageId']

            # Also preserve top-level panOffset/zoom/currentPageId from existing state if not in new state_data
            if 'panOffset' not in full_state and 'panOffset' in existing_state:
                full_state['panOffset'] = existing_state['panOffset']
            if 'zoom' not in full_state and 'zoom' in existing_state:
                full_state['zoom'] = existing_state['zoom']
            if 'currentPageId' not in full_state and 'currentPageId' in existing_state:
                full_state['currentPageId'] = existing_state['currentPageId']

            success = save_dashboard_state_to_file(username, full_state)

            if success:
                return jsonify({
                    "success": True,
                    "message": "Dashboard state saved successfully",
                    "username": username
                })
            else:
                return jsonify({
                    "success": False,
                    "error": "Failed to save dashboard state"
                }), 500

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/dashboard/full-state", methods=['GET', 'POST'])
def dashboard_full_state_api():
    """
    API endpoint for full dashboard state (pages, views, pan, zoom, etc.).

    GET: Retrieve full dashboard state for a user
    POST: Save full dashboard state for a user

    GET Parameters:
        username: The username

    POST JSON Body:
        {
            "username": "user123",
            "pages": [...],
            "panOffset": {"x": 0, "y": 0},
            "zoom": 1,
            "currentPageId": 1,
            "idCounters": {"view": 10, "page": 5},
            "lastUpdated": 1234567890
        }
    """
    try:
        if request.method == 'GET':
            username = request.args.get('username')
            if not username:
                return jsonify({
                    "error": "username parameter is required"
                }), 400

            state = load_dashboard_state_from_file(username)
            if state:
                # Remove internal metadata for response
                # Handle both old format (state nested) and new format (flat)
                if 'state' in state and isinstance(state['state'], dict) and 'pages' not in state:
                    # Old format: {username, state: {panOffset, zoom, ...}, lastUpdated}
                    # Extract pages if they exist at top level, otherwise from state
                    response_data = {
                        'pages': state.get('pages', []),
                        'panOffset': state['state'].get('panOffset'),
                        'zoom': state['state'].get('zoom'),
                        'currentPageId': state['state'].get('currentPageId'),
                        'idCounters': state.get('idCounters', {})
                    }
                    # Remove None values
                    response_data = {k: v for k, v in response_data.items() if v is not None}
                else:
                    # New format: flat structure with pages at top level
                    response_data = {k: v for k, v in state.items() if k not in ['username', 'lastUpdated']}
                    # If pages exist, include them
                    if 'pages' not in response_data and 'pages' in state:
                        response_data['pages'] = state['pages']

                return jsonify({
                    "success": True,
                    **response_data
                })
            else:
                # Return 200 with success: false instead of 404 to avoid console errors
                # Frontend will handle this gracefully
                return jsonify({
                    "success": False,
                    "message": "No dashboard state found for user"
                }), 200

        elif request.method == 'POST':
            data = request.get_json()
            if not data:
                return jsonify({
                    "error": "Request body is required"
                }), 400

            username = data.get('username')

            if not username:
                return jsonify({
                    "error": "username is required"
                }), 400

            # Save full state with metadata
            # Extract pages and other fields from data
            full_state = {
                "username": username,
                "lastUpdated": datetime.now().isoformat()
            }

            # Include pages if present (CRITICAL: pages must be at top level)
            if 'pages' in data:
                full_state['pages'] = data['pages']
                print(f"Saving {len(data['pages'])} pages for user {username}")

            # Include other state fields at top level (not nested in 'state')
            if 'panOffset' in data:
                full_state['panOffset'] = data['panOffset']
            if 'zoom' in data:
                full_state['zoom'] = data['zoom']
            if 'currentPageId' in data:
                full_state['currentPageId'] = data['currentPageId']
            if 'idCounters' in data:
                full_state['idCounters'] = data['idCounters']

            # Debug: log what we're saving
            print(
                f"Saving full state for {username}: pages={len(full_state.get('pages', []))}, panOffset={full_state.get('panOffset')}, zoom={full_state.get('zoom')}")

            success = save_dashboard_state_to_file(username, full_state)

            if success:
                return jsonify({
                    "success": True,
                    "message": "Full dashboard state saved successfully",
                    "username": username
                })
            else:
                return jsonify({
                    "success": False,
                    "error": "Failed to save dashboard state"
                }), 500

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# Flask-SocketIO event handlers for collaborative dashboard
# Global flag to track if cleanup task is running
_cleanup_task_started = False

@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    global _cleanup_task_started
    print(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to collaboration server'})
    
    # Start cleanup task on first connection (only once)
    if not _cleanup_task_started:
        _cleanup_task_started = True
        socketio.start_background_task(cleanup_stale_users)


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    print(f"Client disconnected: {request.sid}")
    # Remove user from all rooms
    for dashboard_id, users in list(active_users.items()):
        users_to_remove = [username for username, data in users.items() if data.get('sid') == request.sid]
        for username in users_to_remove:
            del users[username]
            emit('user_left', {'username': username}, room=dashboard_id, include_self=False)
        if not users:
            del active_users[dashboard_id]


@socketio.on('join_dashboard')
def handle_join_dashboard(data):
    """Handle user joining a dashboard room."""
    dashboard_id = data.get('dashboard_id')
    username = data.get('username')

    if not dashboard_id or not username:
        emit('error', {'message': 'dashboard_id and username are required'})
        return

    # Join the room
    join_room(dashboard_id)

    # Initialize dashboard room if it doesn't exist
    if dashboard_id not in active_users:
        active_users[dashboard_id] = {}

    # Add or update user in active users (handles reconnections)
    # If user already exists with different sid, update it (reconnection)
    existing_user = active_users[dashboard_id].get(username)
    if existing_user and existing_user.get('sid') != request.sid:
        print(f"User {username} reconnected with new sid: {request.sid} (old: {existing_user.get('sid')})")
    
    active_users[dashboard_id][username] = {
        'sid': request.sid,
        'cursor': existing_user.get('cursor', {'x': 0, 'y': 0}) if existing_user else {'x': 0, 'y': 0},
        'timestamp': time.time()
    }

    # Send current active users to the new user (include all users with their cursors)
    # This ensures the new user knows about all existing users immediately
    cursors = {user: data['cursor'] for user, data in active_users[dashboard_id].items()}
    emit('active_users', {
        'users': list(active_users[dashboard_id].keys()),
        'cursors': cursors
    })

    # Notify others in the room about the new user joining
    # This ensures everyone gets updated about the new user
    emit('user_joined', {
        'username': username,
        'active_users': list(active_users[dashboard_id].keys())
    }, room=dashboard_id, include_self=False)
    
    # Also send updated active users list to all existing users
    # This ensures everyone has the complete list
    emit('active_users', {
        'users': list(active_users[dashboard_id].keys()),
        'cursors': cursors
    }, room=dashboard_id, include_self=False)

    # Send current dashboard state to the new user
    # Always initialize shared state if it doesn't exist (for first user)
    # CRITICAL: Always reload from file to get latest state when user joins
    # This ensures every user gets the absolute latest state, not cached version
    shared_state = load_shared_dashboard_state(dashboard_id, force_reload=True)
    if not shared_state:
        # Initialize empty shared state for first user
        # CRITICAL: Use very recent timestamp to prevent old cached state from overwriting
        current_timestamp = int(time.time() * 1000)
        shared_state = {
            'pages': [{'id': 1, 'name': 'Main Dashboard', 'views': []}],
            # zoom, panOffset, and currentPageId are NOT stored - they're per-user preferences
            'idCounters': {'view': 0, 'page': 1},
            'timestamp': current_timestamp  # Add timestamp in milliseconds
        }
        save_shared_dashboard_state(dashboard_id, shared_state)
        print(f"Initialized empty shared state for {dashboard_id} with timestamp {current_timestamp}")
    else:
        # Ensure existing state has a timestamp
        if 'timestamp' not in shared_state:
            shared_state['timestamp'] = int(time.time() * 1000)
            save_shared_dashboard_state(dashboard_id, shared_state)

    timestamp = shared_state.get('timestamp', 'unknown')
    pages_count = len(shared_state.get('pages', []))
    total_views = sum(len(page.get('views', [])) for page in shared_state.get('pages', []))
    print(f"📤 Sending dashboard state to {username} on join (dashboard_id={dashboard_id}, timestamp={timestamp}, pages={pages_count}, views={total_views})")
    print(f"   State content: {json.dumps({k: v for k, v in shared_state.items() if k != 'pages'}, indent=2)}")
    emit('dashboard_state', {
        'dashboard_id': dashboard_id,
        'state': shared_state
    })


@socketio.on('leave_dashboard')
def handle_leave_dashboard(data):
    """Handle user leaving a dashboard room."""
    dashboard_id = data.get('dashboard_id')
    username = data.get('username')

    if dashboard_id and username:
        leave_room(dashboard_id)
        if dashboard_id in active_users and username in active_users[dashboard_id]:
            del active_users[dashboard_id][username]
            emit('user_left', {'username': username}, room=dashboard_id, include_self=False)
            if not active_users[dashboard_id]:
                del active_users[dashboard_id]


@socketio.on('cursor_move')
def handle_cursor_move(data):
    """Handle cursor position updates."""
    dashboard_id = data.get('dashboard_id')
    username = data.get('username')
    cursor = data.get('cursor', {})

    if not dashboard_id or not username:
        return

    # Update cursor position and timestamp (heartbeat)
    if dashboard_id in active_users and username in active_users[dashboard_id]:
        active_users[dashboard_id][username]['cursor'] = cursor
        active_users[dashboard_id][username]['timestamp'] = time.time()

        # Broadcast to others in the room
        emit('cursor_update', {
            'username': username,
            'cursor': cursor
        }, room=dashboard_id, include_self=False)


@socketio.on('ping')
def handle_ping():
    """Handle ping/heartbeat from client to keep connection alive."""
    # Update user's timestamp if they're in a dashboard
    for dashboard_id, users in active_users.items():
        for username, user_data in users.items():
            if user_data.get('sid') == request.sid:
                user_data['timestamp'] = time.time()
                break
    emit('pong', {'timestamp': time.time()})


@socketio.on('dashboard_change')
def handle_dashboard_change(data):
    """Handle dashboard state changes (view create/update/delete, page changes, etc.)."""
    dashboard_id = data.get('dashboard_id')
    username = data.get('username')
    change_type = data.get(
        'change_type')  # 'view_add', 'view_update', 'view_delete', 'page_change', 'pan_zoom', 'full_state'
    change_data = data.get('change_data', {})

    if not dashboard_id or not username or not change_type:
        emit('error', {'message': 'dashboard_id, username, and change_type are required'})
        return

    # CRITICAL: Always reload from file to get latest state before processing changes
    # This prevents race conditions where cached state might be stale
    current_state = load_shared_dashboard_state(dashboard_id, force_reload=True) or {}

    if change_type == 'full_state':
        # Full state update (initial load or major change)
        new_state = change_data.get('state', {})
        new_timestamp = new_state.get('timestamp', 0)
        current_timestamp = current_state.get('timestamp', 0)
        
        # CRITICAL: If current state is empty (just initialized), be very strict about accepting updates
        # Only accept empty state or state that's significantly newer (to prevent old cached state from overwriting)
        current_pages = current_state.get('pages', [])
        current_total_views = sum(len(page.get('views', [])) for page in current_pages)
        current_is_empty = current_total_views == 0
        
        new_pages = new_state.get('pages', [])
        new_total_views = sum(len(page.get('views', [])) for page in new_pages)
        new_has_content = new_total_views > 0
        
        if current_is_empty and new_has_content:
            # Current state is empty but new state has content
            # CRITICAL: If server is empty, NEVER accept state with views - this is always old cached state
            # Even if timestamp is newer, if server was just initialized as empty, any state with views is stale
            # Only accept if new state is ALSO empty (user cleared their local state)
            if new_total_views > 0:
                print(f"🚨 REJECTED state update from {username}: server is EMPTY but client sent {new_total_views} views")
                print(f"   Server was just initialized as empty - any state with views is OLD CACHED STATE")
                print(f"   This prevents old cached state from overwriting fresh empty state")
                # Send back the empty state to the client so they sync
                emit('dashboard_state', {
                    'dashboard_id': dashboard_id,
                    'state': current_state,
                    'message': f'Your state was REJECTED - server has empty state, but you sent {new_total_views} views. This is old cached state. Please clear browser cache and reload.'
                })
                return
            else:
                print(f"✅ Accepted empty state update: server empty -> client also empty (synchronized)")
        
        # CRITICAL: Check if a deletion just happened (within last 5 seconds)
        # If so, be extra strict about accepting full_state updates to prevent overwriting deletions
        # This prevents race conditions where a user's periodic save sends stale state right after a deletion
        # Must be longer than periodic save interval (3s) to catch stale saves
        deletion_protection_window = 5000  # 5 seconds
        current_timestamp_ms = current_state.get('timestamp', 0)
        time_since_last_update = int(time.time() * 1000) - current_timestamp_ms
        
        # Only update if new state is newer (has higher timestamp)
        # This ensures latest state always wins and prevents older states from overwriting newer ones
        if new_timestamp > current_timestamp:
            # If a deletion just happened (recent timestamp update), be extra careful
            # Only accept if new state is significantly newer or if it doesn't restore deleted views
            if time_since_last_update < deletion_protection_window:
                # Check if the new state still has the deleted view(s)
                # If current state has fewer views than new state, new state might be stale
                current_view_count = sum(len(page.get('views', [])) for page in current_state.get('pages', []))
                new_view_count = sum(len(page.get('views', [])) for page in new_state.get('pages', []))
                
                if new_view_count > current_view_count:
                    # New state has more views - might be stale state trying to restore deleted views
                    # Only accept if timestamp is significantly newer (more than protection window)
                    timestamp_diff = new_timestamp - current_timestamp
                    if timestamp_diff < deletion_protection_window:
                        print(f"🚨 REJECTED full_state update from {username}: deletion just happened ({time_since_last_update}ms ago), but new state has {new_view_count} views vs current {current_view_count} views")
                        print(f"   Timestamp diff: {timestamp_diff}ms (need > {deletion_protection_window}ms to overwrite recent deletion)")
                        # Send back current state to sync the client
                        emit('dashboard_state', {
                            'dashboard_id': dashboard_id,
                            'state': current_state,
                            'message': 'Your state update was rejected - a deletion just occurred. Please sync to latest state.'
                        })
                        return
            
            # CRITICAL: Replace entire state, don't merge - prevents partial updates
            # This ensures we always have a complete, consistent state
            current_state = {
                'pages': new_state.get('pages', current_state.get('pages', [])),
                'idCounters': new_state.get('idCounters', current_state.get('idCounters', {'view': 0, 'page': 1})),
                'timestamp': new_timestamp
            }
            # Preserve currentPageId if it exists in new_state (though it's per-user, not shared)
            if 'currentPageId' in new_state:
                current_state['currentPageId'] = new_state.get('currentPageId')
            save_shared_dashboard_state(dashboard_id, current_state)
            print(f"Accepted newer state update: new_timestamp={new_timestamp}, previous={current_timestamp}")
        elif new_timestamp == current_timestamp:
            # Same timestamp - this might be a duplicate
            # Only update if the new state has valid pages and is actually different
            # Compare state to avoid unnecessary writes
            if 'pages' in new_state and isinstance(new_state['pages'], list):
                # Check if state is actually different by comparing pages
                current_pages_str = json.dumps(current_state.get('pages', []), sort_keys=True)
                new_pages_str = json.dumps(new_state.get('pages', []), sort_keys=True)
                if current_pages_str != new_pages_str:
                    current_state = {
                        'pages': new_state.get('pages', current_state.get('pages', [])),
                        'idCounters': new_state.get('idCounters', current_state.get('idCounters', {'view': 0, 'page': 1})),
                        'timestamp': new_timestamp
                    }
                    if 'currentPageId' in new_state:
                        current_state['currentPageId'] = new_state.get('currentPageId')
                    save_shared_dashboard_state(dashboard_id, current_state)
                    print(f"Accepted state update with same timestamp (content changed): {new_timestamp}")
                else:
                    print(f"Ignored duplicate state update with same timestamp and content: {new_timestamp}")
        else:
            print(f"Rejected older state update from {username}: new_timestamp={new_timestamp}, current_timestamp={current_timestamp}")
            # Send back the current state to the client so they can sync
            # This ensures the client gets the latest state even if their update was rejected
            emit('dashboard_state', {
                'dashboard_id': dashboard_id,
                'state': current_state,
                'message': 'Your state was rejected as it was older than server state'
            })
    elif change_type == 'view_add':
        # Add a new view to current page
        # CRITICAL: View additions are independent - multiple users can add views simultaneously
        # No conflict checking needed - each view has unique ID
        page_id = change_data.get('page_id')
        view = change_data.get('view')
        if page_id and view:
            if 'pages' not in current_state:
                current_state['pages'] = []
            
            view_id = view.get('id')
            view_found_in_any_page = False
            
            # Check if view with this ID already exists (prevent duplicates)
            for page in current_state['pages']:
                if 'views' in page:
                    if any(v.get('id') == view_id for v in page['views']):
                        view_found_in_any_page = True
                        print(f"⚠️ View {view_id} already exists - skipping duplicate add")
                        break
            
            if not view_found_in_any_page:
                # View doesn't exist - add it
                for page in current_state['pages']:
                    if page.get('id') == page_id:
                        if 'views' not in page:
                            page['views'] = []
                        # Initialize version for new view
                        if '_version' not in view:
                            view['_version'] = 0
                        page['views'].append(view)
                        
                        # Update idCounters to ensure next ID is higher
                        if 'idCounters' not in current_state:
                            current_state['idCounters'] = {'view': 0, 'page': 1}
                        if view_id and isinstance(view_id, (int, float)):
                            # Ensure counter is at least as high as the new view ID
                            current_state['idCounters']['view'] = max(
                                current_state['idCounters'].get('view', 0),
                                int(view_id)
                            )
                        break
                
                # Update timestamp when view is added
                current_state['timestamp'] = int(time.time() * 1000)
                save_shared_dashboard_state(dashboard_id, current_state)
                print(f"✅ Added view {view_id} to page {page_id} for dashboard {dashboard_id}")
            else:
                # View already exists - just update timestamp and send current state
                current_state['timestamp'] = int(time.time() * 1000)
                save_shared_dashboard_state(dashboard_id, current_state)
                print(f"⚠️ View {view_id} already exists - sending current state")
            
            # CRITICAL: Always send back the updated state to confirm
            # This ensures all clients sync, even if view was duplicate
            emit('dashboard_state', {
                'dashboard_id': dashboard_id,
                'state': current_state
            })
    elif change_type == 'view_update':
        # Update an existing view with conflict resolution and lock checking
        page_id = change_data.get('page_id')
        view_id = change_data.get('view_id')
        updates = change_data.get('updates', {})
        client_version = change_data.get('version')  # Client's version of the view
        if page_id and view_id:
            if 'pages' not in current_state:
                current_state['pages'] = []
            view_found = False
            for page in current_state['pages']:
                if page.get('id') == page_id:
                    if 'views' in page:
                        for view in page['views']:
                            if view.get('id') == view_id:
                                view_found = True
                                
                                # CRITICAL: Check if view is locked by another user for content updates
                                # Position/size updates can proceed even if locked (they use version-based resolution)
                                is_content_update = 'content' in updates
                                if is_content_update:
                                    # Check if view is locked by another user
                                    if dashboard_id in locked_views and view_id in locked_views[dashboard_id]:
                                        lock_info = locked_views[dashboard_id][view_id]
                                        if lock_info['username'] != username:
                                            # View is locked by another user - reject content update
                                            print(f"🔒 LOCKED: View {view_id} content update rejected - locked by {lock_info['username']}")
                                            emit('dashboard_state', {
                                                'dashboard_id': dashboard_id,
                                                'state': current_state,
                                                'conflict': True,
                                                'locked': True,
                                                'message': f'View "{view.get("title", view_id)}" is being edited by {lock_info["username"]}. Please wait until they finish.'
                                            })
                                            return
                                
                                # CRITICAL: Conflict resolution using version numbers for position/size
                                # Each view has a version that increments on each change
                                server_version = view.get('_version', 0)
                                
                                # Separate updates into different categories
                                position_fields = {'x', 'y'}
                                size_fields = {'width', 'height'}
                                content_fields = {'content'}
                                
                                # Get what fields are being updated
                                update_keys = set(updates.keys())
                                position_updates = update_keys & position_fields
                                size_updates = update_keys & size_fields
                                content_updates = update_keys & content_fields
                                
                                # For position/size updates, check version conflicts
                                if position_updates or size_updates:
                                    if client_version is not None:
                                        if client_version < server_version:
                                            # Client's version is older - conflict detected
                                            print(f"⚠️ CONFLICT: View {view_id} position/size update rejected - client version {client_version} < server version {server_version}")
                                            # Send back current state so client can sync
                                            emit('dashboard_state', {
                                                'dashboard_id': dashboard_id,
                                                'state': current_state,
                                                'conflict': True,
                                                'message': f'View "{view.get("title", view_id)}" was moved/resized by another user. Your changes were not applied.'
                                            })
                                            return
                                
                                # No conflict - proceed with update
                                # Increment version for this update
                                new_version = server_version + 1
                                
                                # CRITICAL: Intelligent field-level merging to prevent overwrites
                                # If updating position or size, check if another user just updated it
                                # Use timestamp-based resolution: if server's lastUpdate is newer, prefer server's values
                                if position_updates or size_updates:
                                    server_last_update = view.get('lastUpdatedAt', 0)
                                    client_last_update = updates.get('lastUpdatedAt', 0)
                                    
                                    # If server was updated more recently, preserve server's position/size
                                    if server_last_update > client_last_update and server_last_update > 0:
                                        # Merge: keep server's position/size, apply client's other changes
                                        if position_updates:
                                            # Don't overwrite position if server is newer
                                            updates = {k: v for k, v in updates.items() if k not in position_fields}
                                            print(f"⚠️ Preserved server's position for view {view_id} (server updated {server_last_update}ms ago)")
                                        if size_updates:
                                            # Don't overwrite size if server is newer
                                            updates = {k: v for k, v in updates.items() if k not in size_fields}
                                            print(f"⚠️ Preserved server's size for view {view_id} (server updated {server_last_update}ms ago)")
                                
                                # Deep merge content if it exists in updates
                                if 'content' in updates and 'content' in view:
                                    # Merge nested content objects - this allows concurrent content edits to different fields
                                    view['content'] = {**view.get('content', {}), **updates.get('content', {})}
                                    # Update other properties
                                    for key, value in updates.items():
                                        if key != 'content' and key != '_version':
                                            view[key] = value
                                else:
                                    # Simple update for non-content changes
                                    for key, value in updates.items():
                                        if key != '_version':
                                            view[key] = value
                                
                                # Update version
                                view['_version'] = new_version
                                
                                # Update lastUpdatedBy and lastUpdatedAt if provided
                                if 'lastUpdatedBy' in updates:
                                    view['lastUpdatedBy'] = updates['lastUpdatedBy']
                                if 'lastUpdatedAt' in updates:
                                    view['lastUpdatedAt'] = updates['lastUpdatedAt']
                                
                                break
                    break
            
            if not view_found:
                print(f"⚠️ View {view_id} not found on page {page_id} for dashboard {dashboard_id}")
                emit('error', {'message': f'View {view_id} not found'})
                return
            
            # Update timestamp when view is updated
            current_state['timestamp'] = int(time.time() * 1000)
            save_shared_dashboard_state(dashboard_id, current_state)
            print(f"✅ Updated view {view_id} on page {page_id} for dashboard {dashboard_id} (version: {new_version})")
            # CRITICAL: Send back the updated state to confirm the update was saved
            # This ensures the client's lastServerPagesRef is updated with the server's confirmed state
            emit('dashboard_state', {
                'dashboard_id': dashboard_id,
                'state': current_state
            })
    elif change_type == 'view_delete':
        # Delete a view
        page_id = change_data.get('page_id')
        view_id = change_data.get('view_id')
        if not page_id or not view_id:
            emit('error', {'message': 'page_id and view_id are required for view_delete'})
            return
        
        if 'pages' not in current_state:
            current_state['pages'] = []
        
        view_found = False
        views_before = 0
        for page in current_state['pages']:
            if page.get('id') == page_id:
                if 'views' in page:
                    views_before = len(page['views'])
                    # Check if view exists before deletion
                    view_exists = any(v.get('id') == view_id for v in page['views'])
                    if view_exists:
                        view_found = True
                        page['views'] = [v for v in page['views'] if v.get('id') != view_id]
                        views_after = len(page['views'])
                        print(f"🗑️ Deleting view {view_id} from page {page_id}: {views_before} views → {views_after} views")
                    else:
                        print(f"⚠️ View {view_id} not found on page {page_id} - may have already been deleted")
                break
        
        if not view_found:
            print(f"⚠️ View {view_id} not found on page {page_id} for dashboard {dashboard_id}")
            # Still send back current state to sync client
            emit('dashboard_state', {
                'dashboard_id': dashboard_id,
                'state': current_state,
                'message': f'View {view_id} was not found - may have already been deleted'
            })
            return
        
        # Update timestamp when view is deleted
        current_state['timestamp'] = int(time.time() * 1000)
        save_shared_dashboard_state(dashboard_id, current_state)
        print(f"✅ Deleted view {view_id} from page {page_id} for dashboard {dashboard_id} (timestamp: {current_state['timestamp']})")
        
        # CRITICAL: Broadcast deletion to ALL users in the dashboard room
        # This ensures all users see the deletion immediately
        emit('dashboard_change', {
            'change_type': 'view_delete',
            'change_data': {
                'page_id': page_id,
                'view_id': view_id
            },
            'username': username
        }, room=dashboard_id)
        print(f"📡 Broadcasted view_delete for view {view_id} to all users in dashboard {dashboard_id}")
        
        # CRITICAL: Send back the updated state to confirm the deletion was saved
        # This ensures the client's lastServerPagesRef is updated with the server's confirmed state
        emit('dashboard_state', {
            'dashboard_id': dashboard_id,
            'state': current_state
        })
        print(f"✅ Sent dashboard_state confirmation for deleted view {view_id}")
    elif change_type == 'page_add':
        # Add a new page
        # CRITICAL: Page additions are independent - multiple users can add pages simultaneously
        # No conflict checking needed - each page has unique ID
        page = change_data.get('page')
        if page:
            if 'pages' not in current_state:
                current_state['pages'] = []
            
            page_id = page.get('id')
            # Check if page already exists to avoid duplicates
            if not any(p.get('id') == page_id for p in current_state['pages']):
                current_state['pages'].append(page)
                
                # Update idCounters to ensure next ID is higher
                if 'idCounters' not in current_state:
                    current_state['idCounters'] = {'view': 0, 'page': 1}
                if page_id and isinstance(page_id, (int, float)):
                    # Ensure counter is at least as high as the new page ID
                    current_state['idCounters']['page'] = max(
                        current_state['idCounters'].get('page', 1),
                        int(page_id)
                    )
                
                # Update timestamp when page is added
                current_state['timestamp'] = int(time.time() * 1000)
                save_shared_dashboard_state(dashboard_id, current_state)
                print(f"✅ Added page {page_id} to dashboard {dashboard_id}")
            else:
                # Page already exists - just update timestamp
                current_state['timestamp'] = int(time.time() * 1000)
                save_shared_dashboard_state(dashboard_id, current_state)
                print(f"⚠️ Page {page_id} already exists - sending current state")
            
            if 'currentPageId' in change_data:
                current_state['currentPageId'] = change_data.get('currentPageId')
            
            # CRITICAL: Always send back the updated state to confirm
            # This ensures all clients sync, even if page was duplicate
            emit('dashboard_state', {
                'dashboard_id': dashboard_id,
                'state': current_state
            })
    elif change_type == 'page_update':
        # Update a page (e.g., rename)
        page_id = change_data.get('page_id')
        updates = change_data.get('updates', {})
        if page_id:
            if 'pages' not in current_state:
                current_state['pages'] = []
            for page in current_state['pages']:
                if page.get('id') == page_id:
                    page.update(updates)
                    break
            # Update timestamp when page is updated
            current_state['timestamp'] = int(time.time() * 1000)
            save_shared_dashboard_state(dashboard_id, current_state)
            print(f"✅ Updated page {page_id} for dashboard {dashboard_id}")
            # CRITICAL: Send back the updated state to confirm the update was saved
            emit('dashboard_state', {
                'dashboard_id': dashboard_id,
                'state': current_state
            })
    elif change_type == 'page_delete':
        # Delete a page
        page_id = change_data.get('page_id')
        if page_id:
            if 'pages' not in current_state:
                current_state['pages'] = []
            current_state['pages'] = [p for p in current_state['pages'] if p.get('id') != page_id]
            if 'currentPageId' in change_data:
                current_state['currentPageId'] = change_data.get('currentPageId')
            # Update timestamp when page is deleted
            current_state['timestamp'] = int(time.time() * 1000)
            save_shared_dashboard_state(dashboard_id, current_state)
            print(f"✅ Deleted page {page_id} from dashboard {dashboard_id}")
            # CRITICAL: Send back the updated state to confirm the deletion was saved
            emit('dashboard_state', {
                'dashboard_id': dashboard_id,
                'state': current_state
            })
    elif change_type == 'page_change':
        # Change current page
        current_state['currentPageId'] = change_data.get('currentPageId')
        save_shared_dashboard_state(dashboard_id, current_state)
    elif change_type == 'pan_zoom':
        # Update pan/zoom
        if 'panOffset' in change_data:
            current_state['panOffset'] = change_data['panOffset']
        if 'zoom' in change_data:
            current_state['zoom'] = change_data['zoom']
        save_shared_dashboard_state(dashboard_id, current_state)

    # Broadcast change to all other users in the room
    emit('dashboard_change', {
        'username': username,
        'change_type': change_type,
        'change_data': change_data,
        'timestamp': time.time()
    }, room=dashboard_id, include_self=False)


@socketio.on('request_dashboard_state')
def handle_request_dashboard_state(data):
    """Handle request for current dashboard state."""
    dashboard_id = data.get('dashboard_id')
    username = data.get('username')

    if not dashboard_id:
        emit('error', {'message': 'dashboard_id is required'})
        return

    # CRITICAL: Always reload from file to get latest state (never use stale cache)
    # Use force_reload=True to bypass cache and get absolute latest from disk
    state = load_shared_dashboard_state(dashboard_id, force_reload=True)
    if state:
        # Ensure state has a timestamp
        if 'timestamp' not in state:
            state['timestamp'] = int(time.time() * 1000)
            save_shared_dashboard_state(dashboard_id, state)
        
        timestamp = state.get('timestamp', 'unknown')
        pages_count = len(state.get('pages', []))
        total_views = sum(len(page.get('views', [])) for page in state.get('pages', []))
        print(f"📤 Sending dashboard state to {username} via request (dashboard_id={dashboard_id}, timestamp={timestamp}, pages={pages_count}, views={total_views})")
        print(f"   State content: {json.dumps({k: v for k, v in state.items() if k != 'pages'}, indent=2)}")
        emit('dashboard_state', {
            'dashboard_id': dashboard_id,
            'state': state
        })
    else:
        # Initialize empty shared state if none exists
        # CRITICAL: Use very recent timestamp to prevent old cached state from overwriting
        current_timestamp = int(time.time() * 1000)
        initial_state = {
            'pages': [{'id': 1, 'name': 'Main Dashboard', 'views': []}],
            # zoom, panOffset, and currentPageId are NOT stored - they're per-user preferences
            'idCounters': {'view': 0, 'page': 1},
            'timestamp': current_timestamp
        }
        save_shared_dashboard_state(dashboard_id, initial_state)
        print(f"Initialized empty shared state for {dashboard_id} via request_dashboard_state with timestamp {current_timestamp}")
        emit('dashboard_state', {
            'dashboard_id': dashboard_id,
            'state': initial_state,
            'message': 'No shared state found, initialized fresh state'
        })


@app.route("/api/dashboard/share", methods=['POST'])
def share_dashboard():
    """
    Create or get a shared dashboard ID.

    POST JSON Body:
    {
        "username": "user123",
        "dashboard_id": "optional_existing_id"  // If provided, joins existing; if not, creates new
    }

    Returns:
    {
        "dashboard_id": "shared_dashboard_123",
        "message": "Dashboard shared successfully"
    }
    """
    try:
        data = request.get_json()
        username = data.get('username')
        existing_dashboard_id = data.get('dashboard_id')

        if not username:
            return jsonify({
                "error": "username is required"
            }), 400

        # If dashboard_id provided, use it; otherwise generate new one
        if existing_dashboard_id:
            dashboard_id = existing_dashboard_id
        else:
            # Generate a unique dashboard ID
            dashboard_id = f"shared_{username}_{int(time.time())}"

        return jsonify({
            "success": True,
            "dashboard_id": dashboard_id,
            "message": "Dashboard shared successfully"
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# @app.route("/api/dashboard/cursor", methods=['POST'])
# def update_cursor():
#     """
#     Update cursor position (for polling fallback).

#     POST JSON Body:
#     {
#         "dashboard_id": "shared_123",
#         "username": "user123",
#         "cursor": {"x": 100, "y": 200}
#     }
#     """
#     try:
#         data = request.get_json()
#         dashboard_id = data.get('dashboard_id')
#         username = data.get('username')
#         cursor = data.get('cursor', {})

#         if not dashboard_id or not username:
#             return jsonify({"error": "dashboard_id and username are required"}), 400

#         # Update cursor position
#         active_users[dashboard_id][username] = {
#             'cursor': cursor,
#             'timestamp': time.time()
#         }

#         return jsonify({"success": True})

#     except Exception as e:
#         return jsonify({"error": str(e)}), 500

# Track locked views: dashboard_id -> { view_id: { username, timestamp } }
locked_views = {}

@socketio.on('view_lock')
def handle_view_lock(data):
    """Handle view locking when a user starts editing."""
    dashboard_id = data.get('dashboard_id')
    username = data.get('username')
    view_id = data.get('view_id')
    
    if not dashboard_id or not username or view_id is None:
        emit('error', {'message': 'dashboard_id, username, and view_id are required'})
        return
    
    # Initialize dashboard lock tracking if needed
    if dashboard_id not in locked_views:
        locked_views[dashboard_id] = {}
    
    # Lock the view
    locked_views[dashboard_id][view_id] = {
        'username': username,
        'timestamp': int(time.time() * 1000)
    }
    
    # Broadcast to all users in the dashboard (except the one who locked it)
    emit('view_locked', {
        'view_id': view_id,
        'username': username,
        'timestamp': locked_views[dashboard_id][view_id]['timestamp']
    }, room=dashboard_id, include_self=False)
    
    # Also send to the locking user to confirm
    emit('view_locked', {
        'view_id': view_id,
        'username': username,
        'timestamp': locked_views[dashboard_id][view_id]['timestamp']
    })


@socketio.on('view_unlock')
def handle_view_unlock(data):
    """Handle view unlocking when a user finishes editing."""
    dashboard_id = data.get('dashboard_id')
    username = data.get('username')
    view_id = data.get('view_id')
    
    if not dashboard_id or not username or view_id is None:
        emit('error', {'message': 'dashboard_id, username, and view_id are required'})
        return
    
    # Only unlock if the view is locked by this user
    if dashboard_id in locked_views and view_id in locked_views[dashboard_id]:
        lock_info = locked_views[dashboard_id][view_id]
        if lock_info['username'] == username:
            # Remove the lock
            del locked_views[dashboard_id][view_id]
            
            # Clean up empty dashboard entries
            if not locked_views[dashboard_id]:
                del locked_views[dashboard_id]
            
            # Broadcast to all users in the dashboard
            emit('view_unlocked', {
                'view_id': view_id,
                'username': username
            }, room=dashboard_id)


@socketio.on('request_view_lock_state')
def handle_request_view_lock_state(data):
    """Send current view lock state to a user (e.g., on connect)."""
    dashboard_id = data.get('dashboard_id')
    
    if not dashboard_id:
        emit('error', {'message': 'dashboard_id is required'})
        return
    
    # Send current lock state for this dashboard
    if dashboard_id in locked_views:
        emit('view_lock_state', {
            'dashboard_id': dashboard_id,
            'locked_views': locked_views[dashboard_id]
        })
    else:
        emit('view_lock_state', {
            'dashboard_id': dashboard_id,
            'locked_views': {}
        })


@socketio.on('request_active_users')
def handle_request_active_users(data):
    """Handle request for current active users via Socket.IO."""
    dashboard_id = data.get('dashboard_id')
    username = data.get('username')

    if not dashboard_id:
        emit('error', {'message': 'dashboard_id is required'})
        return

    if dashboard_id in active_users:
        users = list(active_users[dashboard_id].keys())
        cursors = {user: data['cursor'] for user, data in active_users[dashboard_id].items()}
        emit('active_users', {
            'users': users,
            'cursors': cursors
        })
    else:
        emit('active_users', {
            'users': [],
            'cursors': {}
        })


@app.route("/api/dashboard/active-users", methods=['GET'])
def get_active_users():
    """
    Get active users for a dashboard.

    GET Parameters:
        dashboard_id: The shared dashboard ID
    """
    try:
        dashboard_id = request.args.get('dashboard_id')
        if not dashboard_id:
            return jsonify({
                "error": "dashboard_id parameter is required"
            }), 400

        if dashboard_id in active_users:
            users = list(active_users[dashboard_id].keys())
            cursors = {user: data['cursor'] for user, data in active_users[dashboard_id].items()}
            return jsonify({
                "success": True,
                "users": users,
                "cursors": cursors
            })
        else:
            return jsonify({
                "success": True,
                "users": [],
                "cursors": {}
            })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/login", methods=['POST'])
def login_api():
    """
    Login endpoint to validate user credentials.

    Request:
        {
            "username": "string",
            "password": "string"
        }

    Success Response (200 OK):
        {
            "success": true,
            "username": "string"
        }

    Failure Response (401 Unauthorized or 400 Bad Request):
        {
            "success": false,
            "error": "Invalid username or password"
        }
    """
    print("Login attempt received")
    try:
        # Get JSON data from request
        data = request.get_json()

        # Validate request data
        if not data:
            return jsonify({
                "success": False,
                "error": "Invalid request. JSON body required."
            }), 400

        username = data.get("username")
        password = data.get("password")

        # Validate required fields
        if not username or not password:
            return jsonify({
                "success": False,
                "error": "Invalid username or password"
            }), 400

        # TODO: Replace with database lookup and password hashing
        # For now, using a simple validation mechanism
        # This can be easily extended to:
        # 1. Query users collection from MongoDB
        # 2. Use password hashing (bcrypt, argon2, etc.)
        # 3. Implement session management/JWT tokens

        # Simple validation (can be moved to config file or database)
        # This is a placeholder that can be extended
        # Example account for trying out the dashboard. Add your own users here.
        valid_credentials = {
            "TestUser": "daimon123"
        }

        # Validate credentials
        if username in valid_credentials and valid_credentials[username] == password:
            return jsonify({
                "success": True,
                "username": username
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Invalid username or password"
            }), 401

    except Exception as e:
        print(f"Error in login endpoint: {e}")
        return jsonify({
            "success": False,
            "error": "An error occurred during login"
        }), 500
@app.route("/debug/routes", methods=['GET'])
def debug_routes():
    """Debug endpoint to show all available routes."""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            "methods": list(rule.methods),
            "rule": rule.rule,
            "endpoint": rule.endpoint
        })
    return jsonify({"routes": routes})


def cleanup_stale_users():
    """Background task to remove users who haven't sent any activity in a while."""
    while True:
        try:
            current_time = time.time()
            stale_threshold = 30  # Remove users inactive for 30 seconds
            
            for dashboard_id, users in list(active_users.items()):
                users_to_remove = []
                for username, user_data in users.items():
                    last_activity = user_data.get('timestamp', 0)
                    if current_time - last_activity > stale_threshold:
                        users_to_remove.append(username)
                
                for username in users_to_remove:
                    print(f"Removing stale user {username} from dashboard {dashboard_id} (inactive for {current_time - users[username].get('timestamp', 0):.1f}s)")
                    del users[username]
                    socketio.emit('user_left', {'username': username}, room=dashboard_id, include_self=False)
                
                if not users:
                    del active_users[dashboard_id]
            
            # Sleep for 10 seconds before next cleanup
            eventlet.sleep(10)
        except Exception as e:
            print(f"Error in cleanup_stale_users: {e}")
            eventlet.sleep(10)


# Start background task for cleaning up stale users when Socket.IO starts
@socketio.on('connect')
def handle_connect_with_cleanup():
    """Handle client connection and start cleanup task if not already running."""
    print(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to collaboration server'})


if __name__ == "__main__":
    socketio.run(app, debug=False, port=5050, allow_unsafe_werkzeug=True)
