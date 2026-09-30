"""
NL Interface Call Database - CSV-based tracking system for NL interface calls
Tracks view IDs, modes, refresh intervals, queries, responses, and timestamps
"""

import os
import csv
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

# CSV file configuration
CSV_FILE_PATH = os.path.join(os.path.dirname(__file__), "nl_calls.csv")
CSV_FIELDS = [
    "view_id", "mode", "refresh_interval", "query", "response", "timestamp", "is_redo", "ra_name"
]

def _ensure_csv_file():
    """Ensure the CSV file exists with proper headers."""
    if not os.path.exists(CSV_FILE_PATH):
        with open(CSV_FILE_PATH, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=CSV_FIELDS)
            writer.writeheader()

def _read_all_calls() -> List[Dict[str, Any]]:
    """Read all NL calls from CSV file."""
    _ensure_csv_file()
    calls = []
    with open(CSV_FILE_PATH, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            # Convert JSON strings back to objects
            if row.get('response'):
                try:
                    row['response'] = json.loads(row['response'])
                except:
                    row['response'] = row['response']  # Keep as string if not JSON
            calls.append(row)
    return calls

def _write_all_calls(calls: List[Dict[str, Any]]):
    """Write all NL calls to CSV file."""
    _ensure_csv_file()
    with open(CSV_FILE_PATH, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for call in calls:
            # Convert objects to JSON strings for CSV storage
            call_copy = call.copy()
            if isinstance(call_copy.get('response'), (dict, list)):
                call_copy['response'] = json.dumps(call_copy['response'])
            writer.writerow(call_copy)

def create_call_record(view_id: str, mode: str, refresh_interval: str, 
                      query: str, is_redo: bool = False, ra_name: str = "") -> Dict[str, Any]:
    """
    Create a new call record in the database.
    
    Args:
        view_id: The ID of the view making the request
        mode: The detected mode (summary, analysis, suggestions, graph, data_subsetting)
        refresh_interval: The selected refresh interval
        query: The user's search query
        is_redo: Boolean flag indicating if this is a redo operation
        ra_name: The name of the RA (Research Assistant) making the call
        
    Returns:
        Dictionary containing the created call record
    """
    call_record = {
        "view_id": view_id,
        "mode": mode,
        "refresh_interval": refresh_interval,
        "query": query,
        "response": "",  # Will be updated when response is available
        "timestamp": datetime.now().isoformat(),
        "is_redo": str(is_redo),
        "ra_name": ra_name
    }
    
    # Add to database
    all_calls = _read_all_calls()
    all_calls.append(call_record)
    _write_all_calls(all_calls)
    
    return call_record

def update_call_response(view_id: str, response: Any) -> bool:
    """
    Update the response for a call record.
    
    Args:
        view_id: The ID of the view
        response: The response data to store
        
    Returns:
        True if update was successful, False if view_id not found
    """
    all_calls = _read_all_calls()
    
    # Find the most recent call for this view_id without a response
    for i, call in enumerate(all_calls):
        if call["view_id"] == view_id and not call["response"]:
            all_calls[i]["response"] = response
            _write_all_calls(all_calls)
            return True
    
    return False

def get_call_by_view_id(view_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the most recent call record for a view ID.
    
    Args:
        view_id: The ID of the view
        
    Returns:
        The most recent call record if found, None otherwise
    """
    all_calls = _read_all_calls()
    
    # Find the most recent call for this view_id
    matching_calls = [call for call in all_calls if call["view_id"] == view_id]
    if matching_calls:
        # Sort by timestamp and return the most recent
        matching_calls.sort(key=lambda x: x["timestamp"], reverse=True)
        return matching_calls[0]
    
    return None

def get_mode_by_view_id(view_id: str) -> Optional[str]:
    """
    Get the mode for a specific view ID.
    
    Args:
        view_id: The ID of the view
        
    Returns:
        The mode if found, None otherwise
    """
    call_record = get_call_by_view_id(view_id)
    if call_record:
        return call_record["mode"]
    return None

def get_response_by_view_id(view_id: str) -> Optional[Any]:
    """
    Get the response for a specific view ID.
    
    Args:
        view_id: The ID of the view
        
    Returns:
        The response if found, None otherwise
    """
    call_record = get_call_by_view_id(view_id)
    if call_record and call_record["response"]:
        return call_record["response"]
    return None

def get_calls_by_mode(mode: str) -> List[Dict[str, Any]]:
    """
    Get all calls for a specific mode.
    
    Args:
        mode: The mode to filter by
        
    Returns:
        List of call records matching the mode
    """
    all_calls = _read_all_calls()
    return [call for call in all_calls if call["mode"] == mode]

def get_calls_by_refresh_interval(refresh_interval: str) -> List[Dict[str, Any]]:
    """
    Get all calls for a specific refresh interval.
    
    Args:
        refresh_interval: The refresh interval to filter by
        
    Returns:
        List of call records matching the refresh interval
    """
    all_calls = _read_all_calls()
    return [call for call in all_calls if call["refresh_interval"] == refresh_interval]

def get_recent_calls(limit: int = 10) -> List[Dict[str, Any]]:
    """
    Get the most recent calls.
    
    Args:
        limit: Maximum number of calls to return
        
    Returns:
        List of recent call records
    """
    all_calls = _read_all_calls()
    # Sort by timestamp and return the most recent
    all_calls.sort(key=lambda x: x["timestamp"], reverse=True)
    return all_calls[:limit]

def get_call_statistics() -> Dict[str, Any]:
    """
    Get statistics about NL calls.
    
    Returns:
        Dictionary containing call statistics
    """
    all_calls = _read_all_calls()
    
    total_calls = len(all_calls)
    
    # Mode breakdown
    mode_counts = {}
    refresh_interval_counts = {}
    redo_counts = {"true": 0, "false": 0}
    
    for call in all_calls:
        # Mode counts
        mode = call.get("mode", "unknown")
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
        
        # Refresh interval counts
        refresh_interval = call.get("refresh_interval", "unknown")
        refresh_interval_counts[refresh_interval] = refresh_interval_counts.get(refresh_interval, 0) + 1
        
        # Redo counts
        is_redo = call.get("is_redo", "false")
        redo_counts[is_redo] = redo_counts.get(is_redo, 0) + 1
    
    return {
        "total_calls": total_calls,
        "mode_breakdown": mode_counts,
        "refresh_interval_breakdown": refresh_interval_counts,
        "redo_breakdown": redo_counts
    }

def delete_call_by_view_id(view_id: str) -> bool:
    """
    Delete all calls for a specific view ID.
    
    Args:
        view_id: The ID of the view
        
    Returns:
        True if deletion was successful, False if no calls found
    """
    all_calls = _read_all_calls()
    original_count = len(all_calls)
    all_calls = [call for call in all_calls if call["view_id"] != view_id]
    
    if len(all_calls) < original_count:
        _write_all_calls(all_calls)
        return True
    return False

def clear_all_calls() -> bool:
    """
    Clear all call records from the database.
    
    Returns:
        True if successful
    """
    _write_all_calls([])
    return True

# Example usage and testing
if __name__ == "__main__":
    print("Testing NL Call Database...")
    
    # Test creating call records
    call1 = create_call_record("view_001", "summary", "2h", "Show me user activity summary", False)
    print(f"Created call: {call1}")
    
    call2 = create_call_record("view_002", "graph", "1d", "Create a chart of sales data", False)
    print(f"Created call: {call2}")
    
    # Test updating responses
    update_call_response("view_001", {"summary": "User activity shows 150 active users today"})
    update_call_response("view_002", {"image_path": "/static/images/chart.png"})
    
    # Test retrieving data
    mode = get_mode_by_view_id("view_001")
    print(f"Mode for view_001: {mode}")
    
    response = get_response_by_view_id("view_001")
    print(f"Response for view_001: {response}")
    
    # Test statistics
    stats = get_call_statistics()
    print(f"Statistics: {stats}")
    
    # Test recent calls
    recent = get_recent_calls(5)
    print(f"Recent calls: {len(recent)}")
    
    # Clean up test data
    delete_call_by_view_id("view_001")
    delete_call_by_view_id("view_002")
    print("Test completed and cleaned up")
