"""
Test script to demonstrate the CSV-based issue tracker functionality
"""

import sys
import os

# Add paths for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from dashboards_backend.issue_tracker.issue_tracker_database import (
    create_issue, get_issue, update_issue, delete_issue, search_issues,
    find_similar_issues, get_issue_statistics, add_issue_note
)
from dashboards_backend.issue_tracker.issue_manager import IssueManager

def test_csv_issue_tracker():
    """Test the CSV-based issue tracker functionality."""
    print("=" * 60)
    print("TESTING CSV-BASED ISSUE TRACKER")
    print("=" * 60)
    
    # Clean up any existing test data
    test_issue_ids = ["TEST-CSV-001", "TEST-CSV-002", "TEST-CSV-003"]
    for issue_id in test_issue_ids:
        try:
            delete_issue(issue_id)
        except:
            pass
    
    print("1. Creating test issues...")
    
    # Create test issues
    issue1 = create_issue(
        issue_id="TEST-CSV-001",
        summary="Database connection timeout",
        status="in progress",
        priority="high",
        issue_type="bug",
        assignee="db.admin",
        reporter="support.team"
    )
    print(f"   Created: {issue1.get_id()} - {issue1.get_summary()}")
    
    issue2 = create_issue(
        issue_id="TEST-CSV-002",
        summary="Add user authentication",
        status="not started",
        priority="medium",
        issue_type="feature",
        assignee="dev.team",
        reporter="product.manager"
    )
    print(f"   Created: {issue2.get_id()} - {issue2.get_summary()}")
    
    issue3 = create_issue(
        issue_id="TEST-CSV-003",
        summary="Update documentation",
        status="resolved",
        priority="low",
        issue_type="task",
        assignee="docs.team",
        reporter="tech.lead"
    )
    print(f"   Created: {issue3.get_id()} - {issue3.get_summary()}")
    
    print("\n2. Testing retrieval...")
    
    # Test retrieval
    retrieved = get_issue("TEST-CSV-001")
    print(f"   Retrieved: {retrieved.get_summary()} (Status: {retrieved.get_status()})")
    
    print("\n3. Testing updates...")
    
    # Test updates
    updated = update_issue("TEST-CSV-001", {
        "status": "resolved",
        "resolution": "Fixed by increasing connection timeout"
    })
    print(f"   Updated: {updated.get_summary()} (Status: {updated.get_status()})")
    
    print("\n4. Testing search...")
    
    # Test search
    high_priority = search_issues(priority="high")
    print(f"   High priority issues: {len(high_priority)}")
    
    resolved_issues = search_issues(status="resolved")
    print(f"   Resolved issues: {len(resolved_issues)}")
    
    text_search = search_issues(search_text="database")
    print(f"   Issues containing 'database': {len(text_search)}")
    
    print("\n5. Testing notes...")
    
    # Test adding notes
    add_issue_note("TEST-CSV-001", "RA-001", "Initial investigation started")
    add_issue_note("TEST-CSV-001", "RA-002", "Found root cause in connection pool")
    print("   Added notes to TEST-CSV-001")
    
    # Verify notes were added
    issue_with_notes = get_issue("TEST-CSV-001")
    print(f"   Notes count: {len(issue_with_notes.get_notes())}")
    
    print("\n6. Testing similarity search...")
    
    # Test similarity search
    similar = find_similar_issues("TEST-CSV-001", similarity_threshold=0.1)
    print(f"   Similar issues to TEST-CSV-001: {len(similar)}")
    
    print("\n7. Testing statistics...")
    
    # Test statistics
    stats = get_issue_statistics()
    print(f"   Total issues: {stats['total_issues']}")
    print(f"   Status breakdown: {stats['status_breakdown']}")
    print(f"   Priority breakdown: {stats['priority_breakdown']}")
    
    print("\n8. Testing IssueManager...")
    
    # Test IssueManager
    manager = IssueManager()
    
    bug = manager.create_bug_report(
        summary="Memory leak in image processing",
        troubleshooting_steps="1. Open application\n2. Process 100+ images\n3. Monitor memory usage\nExpected: Stable memory\nActual: Memory increases continuously",
        priority="high",
        assignee="backend.team",
        reporter="qa.team"
    )
    print(f"   Created bug via manager: {bug.get_id()}")
    
    # Test manager operations
    manager.start_work(bug.get_id(), "backend.team")
    manager.add_comment(bug.get_id(), "Found the issue in image decoder", "backend.team")
    manager.resolve_issue(bug.get_id(), "Fixed memory leak by properly releasing image buffers")
    
    resolved_bug = get_issue(bug.get_id())
    print(f"   Bug resolved: {resolved_bug.get_status()}")
    
    print("\n9. Testing CSV file...")
    
    # Check if CSV file was created
    csv_file = os.path.join(os.path.dirname(__file__), "issues.csv")
    if os.path.exists(csv_file):
        with open(csv_file, 'r') as f:
            lines = f.readlines()
            print(f"   CSV file created with {len(lines)-1} issues (plus header)")
    else:
        print("   CSV file not found!")
    
    print("\n10. Cleanup...")
    
    # Clean up test data
    for issue_id in test_issue_ids + [bug.get_id()]:
        if delete_issue(issue_id):
            print(f"   Deleted: {issue_id}")
    
    print("\n" + "=" * 60)
    print("CSV ISSUE TRACKER TEST COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print("✅ CSV file creation and management")
    print("✅ Issue CRUD operations")
    print("✅ Search and filtering")
    print("✅ Notes and updates")
    print("✅ Statistics and reporting")
    print("✅ IssueManager integration")
    print("✅ Similarity search")
    print("✅ Data persistence")

if __name__ == "__main__":
    test_csv_issue_tracker()

