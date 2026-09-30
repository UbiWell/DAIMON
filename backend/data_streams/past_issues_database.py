"""
Past Issues Database - Past issues retrieval and management system
Converted to use the new database registry system
"""

import sys
import os
from typing import Dict, Any, Callable

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

# Import function metadata from the original past_issues.py
from data_streams.past_issues import functions

# Import all the actual function implementations from past_issues.py
from data_streams.past_issues import (
    get_past_issue_by_id,
    get_three_relevant_issues,
    get_all_past_issues
)

# Database metadata for registry
database_info = {
    "name": "past issues database",
    "info": "Retrieves information about past issues. Use this when you need to debug an issue user is facing",
    "device": "Phone",
    "additional_instructions": "Use this database for retrieving past issues, finding similar issues"
}

# Create function references mapping (function name -> actual function)
function_refs = {
    "get_past_issue_by_id": get_past_issue_by_id,
    "get_three_relevant_issues": get_three_relevant_issues,
    "get_all_past_issues": get_all_past_issues
}

# Optional: Custom registration function
def register_database(registry):
    """Register this database with the registry"""
    from agents.database_registry import DatabaseRegistry
    registry.register_database(
        name=database_info["name"],
        info=database_info["info"],
        device=database_info["device"],
        additional_instructions=database_info["additional_instructions"],
        functions=functions,  # Function metadata/definitions for LLMs
        function_refs=function_refs,  # Actual function references
        import_path="\nUse following import for past issues database functions (PAST_ISSUE)\nfrom data_streams.past_issues import function_name"
    )
