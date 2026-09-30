"""
Study Docs Database - Study documents retrieval and management system
Following the project's database registry pattern
"""

import sys
import os
from typing import Dict, Any, Callable

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

# Import function metadata from the original study_docs.py
from data_streams.study_docs import functions

# Import all the actual function implementations from study_docs.py
from data_streams.study_docs import (
    get_relevant_information
)

# Database metadata for registry
database_info = {
    "name": "study docs database",
    "info": "Retrieves information from study documents including consent forms, onboarding guides, and study procedures. Use this when you need to find information about study protocols, participant information, or study-related documentation. Might help in troubleshooting issues sometimes",
    "device": "Study Documents",
    "additional_instructions": "Use this database for searching through study documents, finding information about study procedures, participant consent details, onboarding materials, and any study-related documentation. Might help in troubleshooting issues sometimes"
}

# Create function references mapping (function name -> actual function)
function_refs = {
    "get_relevant_information": get_relevant_information
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
        import_path="\nUse following import for study docs database functions (STUDY_DOCS)\nfrom data_streams.study_docs import function_name"
    )
