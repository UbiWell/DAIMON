import sys
import os
import pytz
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

from datetime import datetime, timedelta
from data_processing.data_processing_utils import fetch_documents_between_timestamps
from data_streams.constants import time_zone_dict
# Import moved inside function to avoid circular import
from dashboards_backend.issue_tracker.issue_tracker_database import get_issue, update_issue



import pandas as pd
import json

def _get_issues_csv_path():
    """Get the issues CSV file path, trying multiple possible locations."""
    # Try the standard location first (relative to this file)
    standard_path = os.path.join(os.path.dirname(__file__), '..', 'dashboards_backend', 'issue_tracker', 'issues.csv')
    standard_path = os.path.abspath(standard_path)
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
    
    # Fall back to standard path (will raise error if file doesn't exist)
    print(f"No existing CSV file found, trying: {standard_path}")
    return standard_path

functions = {
    "PAST_ISSUE_1": {
        "name": "get_past_issue_by_id",
        "description": "Retrieves a specific past issue by its unique identifier from the issue tracker database.",
        "function_call_instructions": "Call this function when you need to get details of a specific past issue by its ID.",
        "code_generation_instructions": "Use this function to fetch complete information about a past issue including its summary, status, creation date, assignee, priority, severity, notes, and potential past issues.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "issue_id": {"type": "str", "description": "The unique identifier of the past issue to retrieve."}
        },
        "returns": "A dictionary containing id, summary, status, priority, assignee, uid, created_at, updated_at, resolved_at, troubleshooting_steps, resolution, severity, notes (dict of RA notes), and potential_past_issues (dict of related issues).",
        "example": "{'id': 'ISSUE_27', 'summary': 'High phone usage detected', 'status': 'resolved', 'priority': 'medium', 'assignee': 'Akshat', 'uid': 'test004', 'created_at': '2024-01-15 10:30:45', 'updated_at': '2024-01-15 14:20:30', 'resolved_at': '2024-01-15 16:45:00', 'troubleshooting_steps': 'Check app usage patterns', 'resolution': 'User reduced screen time', 'severity': 'yellow', 'notes': {'RA_John_1758562263': {'content': 'User reported connectivity issues', 'username': 'RA_John', 'timestamp': 1758562263}}, 'potential_past_issues': {}}"
    },
    "PAST_ISSUE_2": {
        "name": "get_three_relevant_issues",
        "description": "Finds the three most relevant past issues for a given issue using RAG-based similarity search with caching for performance optimization.",
        "function_call_instructions": "Call this function when you need to find similar past issues that might be relevant to a current issue. Uses intelligent caching to avoid repeated expensive RAG calls.",
        "code_generation_instructions": "Use this function to get contextually similar past issues that can help with troubleshooting or understanding patterns in issue resolution.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "issue_id": {"type": "str", "description": "The unique identifier of the current issue to find similar past issues for."},
            "query": {"type": "str", "description": "The search query or description to find similar past issues."}
        },
        "returns": "A list of up to 3 most relevant past issues, each containing id (string), summary (string), status (string), and created_at (formatted timestamp string).",
        "example": "[{'id': 'ISSUE_15', 'summary': 'Battery drain issue', 'status': 'resolved', 'created_at': '2024-01-10 09:15:20'}, {'id': 'ISSUE_22', 'summary': 'Phone usage spike', 'status': 'in progress', 'created_at': '2024-01-12 16:45:10'}]"
    },
    "PAST_ISSUE_3": {
        "name": "get_all_past_issues",
        "description": "Retrieves all past issues from the issue tracker database with processed timestamps and complete issue details.",
        "function_call_instructions": "Call this function when you need to get a complete list of all past issues in the system.",
        "code_generation_instructions": "Use this function to get a comprehensive view of all historical issues for analysis, reporting, or bulk operations.",
        "usecase": ["code_generation", "function_calling"],
        "params": {},
        "returns": "A list of all past issues with processed timestamps, each containing id (string), summary (string), status (string), priority (string), assignee (string), uid (string), created_at (formatted timestamp), updated_at (formatted timestamp), resolved_at (formatted timestamp or empty), troubleshooting_steps (string), resolution (string), severity (string), notes (dict of RA notes), and potential_past_issues (dict of related issues).",
        "example": "[{'id': 'ISSUE_1', 'summary': 'Database connection timeout', 'status': 'resolved', 'priority': 'high', 'assignee': 'John', 'uid': 'test001', 'created_at': '2024-01-01 08:00:00', 'updated_at': '2024-01-01 10:30:00', 'resolved_at': '2024-01-01 12:00:00', 'troubleshooting_steps': 'Check database connection', 'resolution': 'Restarted database service', 'severity': 'red', 'notes': {}, 'potential_past_issues': {}}, {'id': 'ISSUE_2', 'summary': 'User login issues', 'status': 'in progress', 'priority': 'medium', 'assignee': 'Jane', 'uid': 'test002', 'created_at': '2024-01-02 10:30:00', 'updated_at': '2024-01-02 14:20:00', 'resolved_at': '', 'troubleshooting_steps': 'Check authentication service', 'resolution': '', 'severity': 'yellow', 'notes': {'RA_Mike_1758562263': {'content': 'User reported login problems', 'username': 'RA_Mike', 'timestamp': 1758562263}}, 'potential_past_issues': {}}]"
    }
}


def get_all_past_issues():
    csv_path = _get_issues_csv_path()
    df = pd.read_csv(csv_path)
    return process_past_issues(df.to_dict(orient="records"))

def get_past_issue_by_id(issue_id):
    past_issue = get_all_past_issues()
    for issue in past_issue:
        if issue['id'] == issue_id:
            return issue
def get_three_relevant_issues(issue_id, query):
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
        past_issues_info = cached_results[:3]  # Limit to 3 as per function name
    else:
        # Run RAG agent to get new results
        from agents.past_issues_rag_agent import RAGBasedPastIssuesAgent
        agent = RAGBasedPastIssuesAgent()
        result = agent.invoke_rag_agent({'question': query})

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

        # Cache the results in the issue's potential_past_issues field
        if issue_id and past_issues_info:
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

    return past_issues_info[:3]


def process_past_issues(issue_records):
    records = []
    timezone = 'est' # Get UID-specific timezone or default to EST
    timezone = pytz.timezone("America/New_York") if timezone == "est" else pytz.utc
    for r in issue_records:
        rec = r
        rec[('created_at')] = datetime.fromtimestamp(r['created_at'], pytz.utc).astimezone(timezone).strftime('%Y-%m-%d %H:%M:%S')
        if rec['updated_at'] and not pd.isna(rec['updated_at']):
            rec[('updated_at')] = datetime.fromtimestamp(r['updated_at'], pytz.utc).astimezone(timezone).strftime('%Y-%m-%d %H:%M:%S')
        if rec['resolved_at'] and not pd.isna(rec['resolved_at']):
            rec[('resolved_at')] = datetime.fromtimestamp(r['resolved_at'], pytz.utc).astimezone(timezone).strftime('%Y-%m-%d %H:%M:%S')
        records.append(rec)
    return records


if __name__ == "__main__":
    print(get_past_issue_by_id("ISSUE_27"))


