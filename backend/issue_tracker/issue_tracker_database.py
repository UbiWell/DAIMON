"""
Issue Tracker Database - Issue tracking and management system
Following the project's database registry pattern
"""

import sys
import os
import csv
import json
import time
from typing import Dict, Any, Callable, List, Optional
from datetime import datetime, timedelta

# Add paths for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'agents')))

from dashboards_backend.issue_tracker.issue import Issue, IssueStatus, IssuePriority, IssueType

# Function metadata/definitions for LLMs
functions = {
    "CREATE_ISSUE": {
        "name": "create_issue",
        "description": "Create a new issue in the issue tracker system.",
        "function_call_instructions": "Call this function when you need to create a new issue with all relevant details.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "issue_id": {"type": "str", "description": "Unique identifier for the issue (e.g., ISS-2024-001)."},
            "summary": {"type": "str", "description": "Brief title/summary of the issue."},
            "status": {"type": "str", "description": "Current status: 'not started', 'in progress', 'resolved', 'closed', 'cancelled'."},
            "priority": {"type": "str", "description": "Priority level: 'low', 'medium', 'high', 'critical'."},
            "assignee": {"type": "str", "description": "Person assigned to the issue (optional)."}
        },
        "returns": "The created Issue object with all details.",
        "example": "create_issue('ISS-2024-001', 'Database connection timeout', 'in progress', 'high', 'bug', 'john.doe', 'jane.smith')"
    },
    "GET_ISSUE": {
        "name": "get_issue",
        "description": "Retrieve a specific issue by its ID.",
        "function_call_instructions": "Call this function when you need to get details of a specific issue.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "issue_id": {"type": "str", "description": "The unique identifier of the issue to retrieve."}
        },
        "returns": "The Issue object if found, None otherwise.",
        "example": "get_issue('ISS-2024-001')"
    },
    "UPDATE_ISSUE": {
        "name": "update_issue",
        "description": "Update an existing issue with new information.",
        "function_call_instructions": "Call this function when you need to modify an existing issue.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "issue_id": {"type": "str", "description": "The unique identifier of the issue to update."},
            "updates": {"type": "dict", "description": "Dictionary containing the fields to update and their new values."}
        },
        "returns": "The updated Issue object if successful, None if issue not found.",
        "example": "update_issue('ISS-2024-001', {'status': 'resolved', 'resolution': 'Fixed database connection pool'})"
    },
    "DELETE_ISSUE": {
        "name": "delete_issue",
        "description": "Delete an issue from the system.",
        "function_call_instructions": "Call this function when you need to permanently remove an issue.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "issue_id": {"type": "str", "description": "The unique identifier of the issue to delete."}
        },
        "returns": "True if deletion was successful, False if issue not found.",
        "example": "delete_issue('ISS-2024-001')"
    },
    "SEARCH_ISSUES": {
        "name": "search_issues",
        "description": "Search for issues based on various criteria.",
        "function_call_instructions": "Call this function when you need to find issues matching specific criteria.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "status": {"type": "str", "description": "Filter by status (optional)."},
            "priority": {"type": "str", "description": "Filter by priority (optional)."},
            "issue_type": {"type": "str", "description": "Filter by issue type (optional)."},
            "assignee": {"type": "str", "description": "Filter by assignee (optional)."},
            "reporter": {"type": "str", "description": "Filter by reporter (optional)."},
            "search_text": {"type": "str", "description": "Search in summary and troubleshooting steps (optional)."},
            "limit": {"type": "int", "description": "Maximum number of results to return (default: 50)."}
        },
        "returns": "List of Issue objects matching the search criteria.",
        "example": "search_issues(status='in progress', priority='high', search_text='database', limit=10)"
    },
    "FIND_SIMILAR_ISSUES": {
        "name": "find_similar_issues",
        "description": "Find issues similar to a given issue based on content similarity.",
        "function_call_instructions": "Call this function when you need to find past issues that might be relevant to a current issue.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "issue_id": {"type": "str", "description": "The issue ID to find similar issues for."},
            "similarity_threshold": {"type": "float", "description": "Minimum similarity score (0.0 to 1.0, default: 0.3)."},
            "limit": {"type": "int", "description": "Maximum number of similar issues to return (default: 5)."}
        },
        "returns": "List of similar Issue objects with similarity scores.",
        "example": "find_similar_issues('ISS-2024-001', similarity_threshold=0.5, limit=3)"
    },
    "GET_ISSUE_STATISTICS": {
        "name": "get_issue_statistics",
        "description": "Get statistics about issues in the system.",
        "function_call_instructions": "Call this function when you need to get overview statistics about the issue tracker.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "time_period_days": {"type": "int", "description": "Number of days to look back for statistics (optional, default: 30)."}
        },
        "returns": "Dictionary containing various issue statistics.",
        "example": "get_issue_statistics(time_period_days=7)"
    },
    "ADD_ISSUE_NOTE": {
        "name": "add_issue_note",
        "description": "Add a note to an existing issue.",
        "function_call_instructions": "Call this function when you need to add additional information or updates to an issue.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "issue_id": {"type": "str", "description": "The unique identifier of the issue."},
            "note_id": {"type": "str", "description": "Unique identifier for the note (e.g., 'RA-001')."},
            "note_content": {"type": "str", "description": "The content of the note."}
        },
        "returns": "True if note was added successfully, False if issue not found.",
        "example": "add_issue_note('ISS-2024-001', 'RA-001', 'Initial investigation started')"
    }
}

# CSV file configuration - robust path resolution for both local and Docker environments
def _get_csv_file_path():
    """Get the CSV file path, trying multiple possible locations."""
    # Try the standard location first (same directory as this file)
    standard_path = os.path.join(os.path.dirname(__file__), "issues.csv")
    print(f"Checking standard path: {standard_path}")
    if os.path.exists(standard_path):
        print(f"Found CSV file at standard path: {standard_path}")
        return standard_path
    
    # Try Docker workspace path
    docker_path = "/workspace/dashboards_backend/issue_tracker/issues.csv"
    print(f"Checking Docker path: {docker_path}")
    if os.path.exists(docker_path):
        print(f"Found CSV file at Docker path: {docker_path}")
        return docker_path
    
    # Try relative path from current working directory
    relative_path = os.path.join(os.getcwd(), "dashboards_backend", "issue_tracker", "issues.csv")
    print(f"Checking relative path: {relative_path}")
    if os.path.exists(relative_path):
        print(f"Found CSV file at relative path: {relative_path}")
        return relative_path
    
    # Fall back to standard path (will create file if it doesn't exist)
    print(f"No existing CSV file found, will create at: {standard_path}")
    return standard_path

CSV_FILE_PATH = _get_csv_file_path()
CSV_FIELDS = [
    "id", "summary", "status", "priority", "assignee", "uid",
    "created_at", "updated_at", "resolved_at", "troubleshooting_steps", 
    "resolution", "severity", "notes", "potential_past_issues"
]

def _ensure_csv_file():
    """Ensure the CSV file exists with proper headers."""
    if not os.path.exists(CSV_FILE_PATH):
        with open(CSV_FILE_PATH, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=CSV_FIELDS, quoting=csv.QUOTE_ALL)
            writer.writeheader()

def _read_all_issues() -> List[Dict[str, Any]]:
    """Read all issues from CSV file."""
    _ensure_csv_file()
    issues = []
    with open(CSV_FILE_PATH, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            # Convert JSON strings back to objects
            if row.get('notes'):
                try:
                    # Handle both properly formatted JSON and malformed JSON
                    notes_str = row['notes'].strip()
                    if notes_str.startswith('{') and notes_str.endswith('}'):
                        row['notes'] = json.loads(notes_str)
                    else:
                        # If it's not valid JSON, try to fix common issues
                        # This handles cases where quotes might be missing
                        row['notes'] = {}
                except json.JSONDecodeError as e:
                    print(f"Warning: Could not parse notes JSON for issue {row.get('id', 'unknown')}: {e}")
                    row['notes'] = {}
                except Exception as e:
                    print(f"Warning: Error processing notes for issue {row.get('id', 'unknown')}: {e}")
                    row['notes'] = {}
            else:
                row['notes'] = {}
                
            if row.get('potential_past_issues'):
                try:
                    potential_issues_str = row['potential_past_issues'].strip()
                    if potential_issues_str.startswith('{') and potential_issues_str.endswith('}'):
                        row['potential_past_issues'] = json.loads(potential_issues_str)
                    else:
                        row['potential_past_issues'] = {}
                except json.JSONDecodeError as e:
                    print(f"Warning: Could not parse potential_past_issues JSON for issue {row.get('id', 'unknown')}: {e}")
                    row['potential_past_issues'] = {}
                except Exception as e:
                    print(f"Warning: Error processing potential_past_issues for issue {row.get('id', 'unknown')}: {e}")
                    row['potential_past_issues'] = {}
            else:
                row['potential_past_issues'] = {}
                
            issues.append(row)
    return issues

def _write_all_issues(issues: List[Dict[str, Any]]):
    """Write all issues to CSV file."""
    _ensure_csv_file()
    with open(CSV_FILE_PATH, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CSV_FIELDS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        for issue in issues:
            # Convert objects to JSON strings for CSV storage
            issue_copy = issue.copy()
            if isinstance(issue_copy.get('notes'), dict):
                # Use ensure_ascii=False and proper escaping
                issue_copy['notes'] = json.dumps(issue_copy['notes'], ensure_ascii=False, separators=(',', ':'))
            if isinstance(issue_copy.get('potential_past_issues'), dict):
                issue_copy['potential_past_issues'] = json.dumps(issue_copy['potential_past_issues'], ensure_ascii=False, separators=(',', ':'))
            writer.writerow(issue_copy)

def _issue_to_dict(issue: Issue) -> Dict[str, Any]:
    """Convert Issue object to dictionary for CSV storage."""
    return {
        "id": issue.get_id(),
        "summary": issue.get_summary(),
        "status": issue.get_status(),
        "priority": issue.get_priority(),
        "assignee": issue.get_assignee(),
        "uid": issue.get_uid(),
        "created_at": issue.get_created_at(),
        "updated_at": issue.get_updated_at(),
        "resolved_at": issue.get_resolved_at() if issue.get_resolved_at() else "",
        "troubleshooting_steps": issue.get_troubleshooting_steps(),
        "resolution": issue.get_resolution(),
        "severity": issue.get_severity(),
        "notes": issue.get_notes(),
        "potential_past_issues": issue.get_potential_past_issues()
    }

def _dict_to_issue(issue_dict: Dict[str, Any]) -> Issue:
    """Convert dictionary from CSV to Issue object."""
    # Create issue with basic fields
    issue = Issue(
        issue_id=issue_dict["id"],
        summary=issue_dict["summary"],
        status=issue_dict["status"],
        priority=issue_dict.get("priority", "medium"),
        assignee=issue_dict.get("assignee", ""),
        severity=issue_dict.get("severity", "green"),
        uid=issue_dict.get("uid", "")
    )
    
    # Set additional fields if they exist
    if issue_dict.get("created_at"):
        issue._created_at = int(issue_dict["created_at"])
    if issue_dict.get("updated_at"):
        issue._updated_at = int(issue_dict["updated_at"])
    if issue_dict.get("resolved_at"):
        issue._resolved_at = int(issue_dict["resolved_at"])
    
    # Set other fields
    issue._troubleshooting_steps = issue_dict.get("troubleshooting_steps", "")
    issue._resolution = issue_dict.get("resolution", "")
    issue._notes = issue_dict.get("notes", {})
    issue._potential_past_issues = issue_dict.get("potential_past_issues", {})
    
    return issue

# Function implementations
def create_issue(issue_id: str, summary: str, status: str = "not started", 
                priority: str = "medium", assignee: str = "", severity: str = "green", uid: str = "") -> Issue:
    """
    Create a new issue in the issue tracker system.

    Args:
        issue_id: Unique identifier for the issue
        summary: Brief title/summary of the issue
        status: Current status
        priority: Priority level
        assignee: Person assigned to the issue
        severity: Severity level ('green', 'yellow', 'red')
        uid: User ID who reported the issue

    Returns:
        The created Issue object
    """
    # Read all issues to check for duplicates
    all_issues = _read_all_issues()
    existing_ids = [issue["id"] for issue in all_issues]
    if issue_id in existing_ids:
        raise ValueError(f"Issue with ID {issue_id} already exists")
    
    # Create the issue
    issue = Issue(
        issue_id=issue_id,
        summary=summary,
        status=status,
        priority=priority,
        assignee=assignee,
        severity=severity,
        uid=uid
    )
    
    # Add to issues list and write back to CSV
    all_issues.append(_issue_to_dict(issue))
    _write_all_issues(all_issues)
    
    return issue

def get_issue(issue_id: str) -> Optional[Issue]:
    """
    Retrieve a specific issue by its ID.

    Args:
        issue_id: The unique identifier of the issue to retrieve

    Returns:
        The Issue object if found, None otherwise
    """
    all_issues = _read_all_issues()
    for issue_dict in all_issues:
        if issue_dict["id"] == issue_id:
            return _dict_to_issue(issue_dict)
    return None

def update_issue(issue_id: str, updates: Dict[str, Any]) -> Optional[Issue]:
    """
    Update an existing issue with new information.

    Args:
        issue_id: The unique identifier of the issue to update
        updates: Dictionary containing the fields to update and their new values

    Returns:
        The updated Issue object if successful, None if issue not found
    """
    # Get the existing issue
    issue = get_issue(issue_id)
    if not issue:
        return None
    
    # Apply updates
    for field, value in updates.items():
        if hasattr(issue, f"set_{field}"):
            getattr(issue, f"set_{field}")(value)
        elif hasattr(issue, f"_{field}"):
            setattr(issue, f"_{field}", value)
            issue._updated_at = int(time.time())
    
    # Update in CSV file
    all_issues = _read_all_issues()
    for i, issue_dict in enumerate(all_issues):
        if issue_dict["id"] == issue_id:
            all_issues[i] = _issue_to_dict(issue)
            _write_all_issues(all_issues)
            break
    
    return issue

def delete_issue(issue_id: str) -> bool:
    """
    Delete an issue from the system.

    Args:
        issue_id: The unique identifier of the issue to delete

    Returns:
        True if deletion was successful, False if issue not found
    """
    all_issues = _read_all_issues()
    original_count = len(all_issues)
    all_issues = [issue for issue in all_issues if issue["id"] != issue_id]
    
    if len(all_issues) < original_count:
        _write_all_issues(all_issues)
        return True
    return False

def search_issues(status: str = None, priority: str = None,
                 assignee: str = None, search_text: str = None, limit: int = 50) -> List[Issue]:
    """
    Search for issues based on various criteria.

    Args:
        status: Filter by status
        priority: Filter by priority
        assignee: Filter by assignee
        search_text: Search in summary and troubleshooting steps
        limit: Maximum number of results to return

    Returns:
        List of Issue objects matching the search criteria
    """
    # Read all issues and filter
    all_issues = _read_all_issues()
    filtered_issues = []
    
    for issue_dict in all_issues:
        # Apply filters
        if status and issue_dict.get("status") != status:
            continue
        if priority and issue_dict.get("priority") != priority:
            continue
        if assignee and issue_dict.get("assignee") != assignee:
            continue
        if search_text:
            search_lower = search_text.lower()
            summary_match = search_lower in issue_dict.get("summary", "").lower()
            troubleshooting_match = search_lower in issue_dict.get("troubleshooting_steps", "").lower()
            if not (summary_match or troubleshooting_match):
                continue
        
        filtered_issues.append(_dict_to_issue(issue_dict))
        
        # Apply limit
        if len(filtered_issues) >= limit:
            break
    
    return filtered_issues

def find_similar_issues(issue_id: str, similarity_threshold: float = 0.3, 
                       limit: int = 5) -> List[Dict[str, Any]]:
    """
    Find issues similar to a given issue based on content similarity.

    Args:
        issue_id: The issue ID to find similar issues for
        similarity_threshold: Minimum similarity score (0.0 to 1.0)
        limit: Maximum number of similar issues to return

    Returns:
        List of dictionaries containing similar Issue objects and similarity scores
    """
    # Get the target issue
    target_issue = get_issue(issue_id)
    if not target_issue:
        return []
    
    # Get all other issues
    all_issues = search_issues(limit=1000)  # Get a large number for comparison
    similar_issues = []
    
    target_text = f"{target_issue.get_summary()} {target_issue.get_troubleshooting_steps()}".lower()
    
    for issue in all_issues:
        if issue.get_id() == issue_id:
            continue
            
        # Calculate similarity based on text
        issue_text = f"{issue.get_summary()} {issue.get_troubleshooting_steps()}".lower()
        
        # Simple text similarity (word overlap)
        target_words = set(target_text.split())
        issue_words = set(issue_text.split())
        text_similarity = len(target_words & issue_words) / len(target_words | issue_words) if target_words | issue_words else 0
        
        # Use text similarity as the combined similarity
        combined_similarity = text_similarity
        
        if combined_similarity >= similarity_threshold:
            similar_issues.append({
                "issue": issue,
                "similarity_score": combined_similarity,
                "text_similarity": text_similarity
            })
    
    # Sort by similarity score and return top results
    similar_issues.sort(key=lambda x: x["similarity_score"], reverse=True)
    return similar_issues[:limit]

def get_issue_statistics(time_period_days: int = 30) -> Dict[str, Any]:
    """
    Get statistics about issues in the system.

    Args:
        time_period_days: Number of days to look back for statistics

    Returns:
        Dictionary containing various issue statistics
    """
    cutoff_timestamp = int(time.time()) - (time_period_days * 24 * 60 * 60)
    
    # Get all issues
    all_issues = _read_all_issues()
    
    # Calculate statistics
    total_issues = len(all_issues)
    
    # Status breakdown
    status_counts = {}
    priority_counts = {}
    type_counts = {}
    
    recent_issues = 0
    resolved_issues = 0
    
    for issue_dict in all_issues:
        # Status counts
        status = issue_dict.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
        
        # Priority counts
        priority = issue_dict.get("priority", "unknown")
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
        
        # Type counts
        issue_type = issue_dict.get("issue_type", "unknown")
        type_counts[issue_type] = type_counts.get(issue_type, 0) + 1
        
        # Recent issues
        created_at_timestamp = issue_dict.get("created_at", 0)
        if created_at_timestamp and isinstance(created_at_timestamp, (int, str)):
            try:
                created_at = int(created_at_timestamp)
                if created_at >= cutoff_timestamp:
                    recent_issues += 1
            except:
                pass
        
        # Resolved issues
        if status in ["resolved", "closed"]:
            resolved_issues += 1
    
    return {
        "total_issues": total_issues,
        "recent_issues": recent_issues,
        "resolved_issues": resolved_issues,
        "resolution_rate": resolved_issues / total_issues if total_issues > 0 else 0,
        "status_breakdown": status_counts,
        "priority_breakdown": priority_counts,
        "type_breakdown": type_counts,
        "time_period_days": time_period_days
    }

def add_issue_note(issue_id: str, note_id: str, note_content: str) -> bool:
    """
    Add a note to an existing issue.

    Args:
        issue_id: The unique identifier of the issue
        note_id: Unique identifier for the note
        note_content: The content of the note

    Returns:
        True if note was added successfully, False if issue not found
    """
    issue = get_issue(issue_id)
    if not issue:
        return False
    
    issue.add_note(note_id, note_content)
    
    # Update in CSV file
    all_issues = _read_all_issues()
    for i, issue_dict in enumerate(all_issues):
        if issue_dict["id"] == issue_id:
            all_issues[i] = _issue_to_dict(issue)
            _write_all_issues(all_issues)
            break
    
    return True

# Function references mapping (function name -> actual function)
function_refs = {
    "create_issue": create_issue,
    "get_issue": get_issue,
    "update_issue": update_issue,
    "delete_issue": delete_issue,
    "search_issues": search_issues,
    "find_similar_issues": find_similar_issues,
    "get_issue_statistics": get_issue_statistics,
    "add_issue_note": add_issue_note
}

# Database info for registration
database_info = {
    "name": "issue_tracker",
    "info": "Issue tracking and management system for handling bugs, features, and tasks",
    "device": "local",
    "additional_instructions": "Use this database for creating, updating, and managing issues in the system"
}

# Optional: Custom registration function
def register_database(registry):
    """
    Custom registration function for the issue tracker database.

    Args:
        registry: The database registry instance
    """
    registry.register_database(
        name=database_info["name"],
        info=database_info["info"],
        device=database_info["device"],
        additional_instructions=database_info["additional_instructions"],
        functions=functions,
        function_refs=function_refs,
        import_path="\nUse following import for issue tracker database functions (ISSUE)\nfrom dashboards_backend.issue_tracker.issue_tracker_database import function_name"
    )

# Example usage
if __name__ == "__main__":
    # Test the functions
    print("Testing Issue Tracker Database...")
    
    # Create a test issue
    test_issue = create_issue(
        issue_id="TEST-001",
        summary="Test issue for database functionality",
        status="in progress",
        priority="medium",
        issue_type="bug",
        assignee="test.user",
        reporter="admin"
    )
    print(f"Created issue: {test_issue}")
    
    # Retrieve the issue
    retrieved = get_issue("TEST-001")
    print(f"Retrieved issue: {retrieved}")
    
    # Update the issue
    updated = update_issue("TEST-001", {"status": "resolved", "resolution": "Test completed successfully"})
    print(f"Updated issue: {updated}")
    
    # Search for issues
    results = search_issues(status="resolved", limit=5)
    print(f"Found {len(results)} resolved issues")
    
    # Get statistics
    stats = get_issue_statistics()
    print(f"Statistics: {stats}")
    
    # Clean up
    delete_issue("TEST-001")
    print("Test completed and cleaned up")
