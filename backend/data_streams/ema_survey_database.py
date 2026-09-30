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
from data_streams.ema_survey import functions

# Import all the actual function implementations from activity_data.py
from data_streams.ema_survey import get_ema_records

# Database metadata for registry
database_info = {
    "name": "ema survey database",
    "info": "Contains EMA survey data which includes survey questions, answers, time of completion, and duration.",
    "device": "Phone",
    "additional_instructions": "Different EMA surveys can have different number of questions. Each EMA survey can have different set of questions"
}

# Create function references mapping (function name -> actual function)
function_refs = {
    "get_ema_records": get_ema_records,
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
        import_path="\nUse following import for ema survey database functions (EMA1)\nfrom data_streams.ema_survey import function_name"
    )
