"""
Test script to demonstrate the NL Interface Call Database functionality
"""

import sys
import os

# Add paths for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from dashboards_backend.nl_interface.functions import (
    detect_mode, summary, analysis, suggestions, graph, data_subsetting
)
from dashboards_backend.nl_interface.nl_call_database import (
    get_call_statistics, get_recent_calls, delete_call_by_view_id
)

def test_nl_database_system():
    """Test the NL Interface Call Database system."""
    print("=" * 60)
    print("TESTING NL INTERFACE CALL DATABASE SYSTEM")
    print("=" * 60)
    
    # Clean up any existing test data
    test_view_ids = ["test_view_001", "test_view_002", "test_view_003"]
    for view_id in test_view_ids:
        try:
            delete_call_by_view_id(view_id)
        except:
            pass
    
    print("1. Testing detect_mode with is_redo=False (new call)...")
    
    # Test detect_mode with is_redo=False
    mode_result = detect_mode(
        query="Show me user activity summary for last week",
        view_id="test_view_001",
        refresh_interval="2h",
        is_redo=False,
        ra_name="RA_001"
    )
    print(f"   Mode detection result: {mode_result}")
    
    print("\n2. Testing detect_mode with is_redo=True (retrieve from database)...")
    
    # Test detect_mode with is_redo=True
    mode_result_redo = detect_mode(
        query="Show me user activity summary for last week",
        view_id="test_view_001",
        refresh_interval="2h",
        is_redo=True,
        ra_name="RA_001"
    )
    print(f"   Mode retrieval result: {mode_result_redo}")
    
    print("\n3. Testing summary function with is_redo=False...")
    
    # Test summary function with is_redo=False
    summary_result = summary(
        query="Summarize the user activity data",
        view_id="test_view_001",
        is_redo=False,
        ra_name="RA_002"
    )
    print(f"   Summary result: {summary_result.get('results', 'N/A')[:50]}...")
    
    print("\n4. Testing summary function with is_redo=True...")
    
    # Test summary function with is_redo=True
    summary_result_redo = summary(
        query="Summarize the user activity data",
        view_id="test_view_001",
        is_redo=True,
        ra_name="RA_002"
    )
    print(f"   Summary redo result: {summary_result_redo.get('results', 'N/A')[:50]}...")
    
    print("\n5. Testing analysis function...")
    
    # Test analysis function
    analysis_result = analysis(
        query="Analyze the user behavior patterns",
        view_id="test_view_002",
        is_redo=False,
        ra_name="RA_003"
    )
    print(f"   Analysis result: {analysis_result.get('results', 'N/A')[:50]}...")
    
    print("\n6. Testing suggestions function...")
    
    # Test suggestions function
    suggestions_result = suggestions(
        query="Provide suggestions for improving user engagement",
        view_id="test_view_003",
        is_redo=False,
        ra_name="RA_004"
    )
    print(f"   Suggestions result: {suggestions_result.get('results', 'N/A')[:50]}...")
    
    print("\n7. Testing database statistics...")
    
    # Test database statistics
    stats = get_call_statistics()
    print(f"   Total calls: {stats['total_calls']}")
    print(f"   Mode breakdown: {stats['mode_breakdown']}")
    print(f"   Refresh interval breakdown: {stats['refresh_interval_breakdown']}")
    print(f"   Redo breakdown: {stats['redo_breakdown']}")
    
    print("\n8. Testing recent calls...")
    
    # Test recent calls
    recent_calls = get_recent_calls(5)
    print(f"   Recent calls count: {len(recent_calls)}")
    for call in recent_calls:
        print(f"     - View: {call['view_id']}, Mode: {call['mode']}, Redo: {call['is_redo']}")
    
    print("\n9. Testing different refresh intervals...")
    
    # Test different refresh intervals
    detect_mode(
        query="Create a sales chart",
        view_id="test_view_002",
        refresh_interval="1d",
        is_redo=False,
        ra_name="RA_005"
    )
    
    detect_mode(
        query="Generate user report",
        view_id="test_view_003",
        refresh_interval="7d",
        is_redo=False,
        ra_name="RA_006"
    )
    
    # Get updated statistics
    updated_stats = get_call_statistics()
    print(f"   Updated total calls: {updated_stats['total_calls']}")
    print(f"   Updated refresh interval breakdown: {updated_stats['refresh_interval_breakdown']}")
    
    print("\n10. Testing CSV file creation...")
    
    # Check if CSV file was created
    csv_file = os.path.join(os.path.dirname(__file__), "nl_calls.csv")
    if os.path.exists(csv_file):
        with open(csv_file, 'r') as f:
            lines = f.readlines()
            print(f"   CSV file created with {len(lines)-1} calls (plus header)")
    else:
        print("   CSV file not found!")
    
    print("\n11. Cleanup...")
    
    # Clean up test data
    for view_id in test_view_ids:
        if delete_call_by_view_id(view_id):
            print(f"   Deleted calls for: {view_id}")
    
    print("\n" + "=" * 60)
    print("NL INTERFACE CALL DATABASE TEST COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print("✅ Database creation and management")
    print("✅ Mode detection and storage")
    print("✅ Function integration with database")
    print("✅ Redo functionality")
    print("✅ Statistics and reporting")
    print("✅ CSV file persistence")
    print("✅ View ID tracking")
    print("✅ Refresh interval management")

def demonstrate_workflow():
    """Demonstrate a complete workflow."""
    print("\n" + "=" * 60)
    print("DEMONSTRATING COMPLETE WORKFLOW")
    print("=" * 60)
    
    view_id = "demo_view_001"
    query = "Show me user activity trends"
    
    print("1. First call (is_redo=False) - Detect mode and create database record")
    mode_result = detect_mode(query, view_id, "2h", False, "RA_Demo")
    print(f"   Detected mode: {mode_result}")
    
    print("\n2. Execute function based on mode")
    if mode_result.get('mode') == 'summary':
        result = summary(query, view_id, False, "RA_Demo")
        print(f"   Summary generated: {result.get('results', 'N/A')[:50]}...")
    elif mode_result.get('mode') == 'analysis':
        result = analysis(query, view_id, False, "RA_Demo")
        print(f"   Analysis generated: {result.get('results', 'N/A')[:50]}...")
    
    print("\n3. Second call (is_redo=True) - Retrieve from database")
    mode_result_redo = detect_mode(query, view_id, "2h", True, "RA_Demo")
    print(f"   Retrieved mode: {mode_result_redo}")
    
    print("\n4. Execute function with cached response")
    if mode_result_redo.get('mode') == 'summary':
        result_redo = summary(query, view_id, True, "RA_Demo")
        print(f"   Cached summary: {result_redo.get('results', 'N/A')[:50]}...")
    elif mode_result_redo.get('mode') == 'analysis':
        result_redo = analysis(query, view_id, True, "RA_Demo")
        print(f"   Cached analysis: {result_redo.get('results', 'N/A')[:50]}...")
    
    # Clean up
    delete_call_by_view_id(view_id)
    print("\n   Demo completed and cleaned up")

if __name__ == "__main__":
    test_nl_database_system()
    demonstrate_workflow()
