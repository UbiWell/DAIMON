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
from data_streams.real_time_ema import functions

# Import all the actual function implementations from activity_data.py
from data_streams.real_time_ema import get_real_time_ema_records

# Database metadata for registry
database_info = {
    "name": "real time ema database",
    "info": "Contains real time ema events  where we have ML models triggered EMA, a randomly sent ema, and retrospective ema (sent in morning)",
    "device": "Phone",
    "additional_instructions": "This database has event information , three types of ema, ml-triggered, random, and retrospective-ema. To check the exact data particioant replied to look at ema survey database.",
}

# Create function references mapping (function name -> actual function)
function_refs = {
    "get_real_time_ema_records": get_real_time_ema_records,
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
        import_path="\nUse following import for real time ema database functions (REMA1)\nfrom data_streams.real_time_ema import function_name"
    )
