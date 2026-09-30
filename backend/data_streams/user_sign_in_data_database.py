"""
Activity Database - Phone activity detection data
Converted to use the new database registry system
"""

import sys
import os
from typing import Dict, Any, Callable

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

# Import function metadata from the original activity_data.py
from data_streams.user_sign_in_data import functions

# Import all the actual function implementations from activity_data.py
from data_streams.user_sign_in_data import get_unused_sign_in_codes, get_user_data_by_uid, ensure_uid_in_code_mappings

# Database metadata for registry
database_info = {
    "name": "user sign-in database",
    "info": "Contains information about user sign-in which include login time, access codes, last time their phone pinged our servers. Pings happens every minute. Can create new access codes too.",
    "device": "Phone",
    "additional_instructions": "Use this database to check provide access codes or check last time phone pinged when debugging issues"
}

# Create function references mapping (function name -> actual function)
function_refs = {
    "get_unused_sign_in_codes": get_unused_sign_in_codes,
    "get_user_data_by_uid": get_user_data_by_uid,
    "ensure_uid_in_code_mappings": ensure_uid_in_code_mappings
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
        import_path="\nUse following import for ema survey database functions (USER)\nfrom data_streams.user_sign_in_data import function_name"
    )
