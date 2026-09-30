"""
Example Usage of the Issue Tracking System
Demonstrates how to use the enhanced Issue class, IssueTracker database, and IssueManager
"""

import sys
import os
from datetime import datetime

# Add paths for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from dashboards_backend.issue_tracker.issue import Issue, IssueStatus, IssuePriority, IssueType
from dashboards_backend.issue_tracker.issue_tracker_database import (
    create_issue, get_issue, update_issue, delete_issue, search_issues,
    find_similar_issues, get_issue_statistics, add_issue_note
)
from dashboards_backend.issue_tracker.issue_manager import IssueManager


def demonstrate_basic_issue_operations():
    """Demonstrate basic issue creation and management."""
    print("=" * 60)
    print("DEMONSTRATING BASIC ISSUE OPERATIONS")
    print("=" * 60)
    
    # Create a new issue using the enhanced Issue class
    issue = Issue(
        issue_id="DEMO-001",
        summary="Application crashes on startup",
        status=IssueStatus.NOT_STARTED.value,
        priority=IssuePriority.HIGH.value,
        issue_type=IssueType.BUG.value,
        assignee="john.doe",
        reporter="jane.smith",
        description="The application crashes immediately after startup with a segmentation fault",
        tags=["crash", "startup", "critical"]
    )
    
    # Set additional fields
    issue.set_environment("Production - Ubuntu 20.04")
    issue.set_steps_to_reproduce([
        "1. Launch the application",
        "2. Wait for splash screen",
        "3. Application crashes immediately"
    ])
    issue.set_expected_behavior("Application should start normally and show main window")
    issue.set_actual_behavior("Application crashes with segmentation fault")
    
    print(f"Created issue: {issue}")
    print(f"Priority: {issue.get_priority()}")
    print(f"Type: {issue.get_issue_type()}")
    print(f"Environment: {issue.get_environment()}")
    print(f"Steps to reproduce: {issue.get_steps_to_reproduce()}")
    
    # Add some notes
    issue.add_note("RA-001", "Initial bug report received from user")
    issue.add_note("RA-002", "Reproduced the issue in development environment")
    issue.add_note("RA-003", "Found potential memory leak in initialization code")
    
    print(f"Notes: {len(issue.get_notes())} notes added")
    
    # Convert to JSON and back
    json_str = issue.to_json()
    print(f"JSON representation length: {len(json_str)} characters")
    
    # Create from JSON
    issue_from_json = Issue.from_json(json_str)
    print(f"Recreated from JSON: {issue_from_json.get_summary()}")
    
    return issue


def demonstrate_database_operations():
    """Demonstrate database operations."""
    print("\n" + "=" * 60)
    print("DEMONSTRATING DATABASE OPERATIONS")
    print("=" * 60)
    
    # Create issues in the database
    issue1 = create_issue(
        issue_id="DB-DEMO-001",
        summary="Database connection pool exhausted",
        status="in progress",
        priority="critical",
        issue_type="bug",
        assignee="db.admin",
        reporter="monitoring.system",
        description="Database connection pool is being exhausted, causing application failures",
        tags=["database", "connection-pool", "critical"]
    )
    
    issue2 = create_issue(
        issue_id="DB-DEMO-002",
        summary="Add database connection monitoring",
        status="not started",
        priority="medium",
        issue_type="feature",
        assignee="dev.team",
        reporter="db.admin",
        description="Need to add monitoring for database connection pool usage",
        tags=["monitoring", "database", "feature"]
    )
    
    issue3 = create_issue(
        issue_id="DB-DEMO-003",
        summary="Database query optimization needed",
        status="resolved",
        priority="high",
        issue_type="enhancement",
        assignee="db.admin",
        reporter="performance.team",
        description="Optimize slow database queries to improve application performance",
        tags=["database", "performance", "optimization"]
    )
    
    print(f"Created 3 issues in database")
    
    # Retrieve an issue
    retrieved = get_issue("DB-DEMO-001")
    print(f"Retrieved issue: {retrieved.get_summary()}")
    
    # Update an issue
    updated = update_issue("DB-DEMO-001", {
        "status": "resolved",
        "resolution": "Increased connection pool size from 10 to 50"
    })
    print(f"Updated issue status: {updated.get_status()}")
    
    # Search for issues
    critical_issues = search_issues(priority="critical")
    print(f"Found {len(critical_issues)} critical issues")
    
    database_issues = search_issues(tags=["database"])
    print(f"Found {len(database_issues)} database-related issues")
    
    # Find similar issues
    similar = find_similar_issues("DB-DEMO-001", similarity_threshold=0.3)
    print(f"Found {len(similar)} similar issues to DB-DEMO-001")
    
    # Get statistics
    stats = get_issue_statistics()
    print(f"Total issues: {stats['total_issues']}")
    print(f"Status breakdown: {stats['status_breakdown']}")
    
    # Add notes
    add_issue_note("DB-DEMO-001", "RA-001", "Issue resolved by increasing connection pool size")
    print("Added resolution note")
    
    return ["DB-DEMO-001", "DB-DEMO-002", "DB-DEMO-003"]


def demonstrate_issue_manager():
    """Demonstrate the IssueManager high-level interface."""
    print("\n" + "=" * 60)
    print("DEMONSTRATING ISSUE MANAGER")
    print("=" * 60)
    
    manager = IssueManager()
    
    # Create different types of issues
    bug = manager.create_bug_report(
        summary="Memory leak in image processing module",
        description="Application memory usage increases continuously when processing images",
        priority="high",
        assignee="backend.team",
        reporter="qa.team",
        environment="Development - Windows 10",
        steps_to_reproduce=[
            "1. Open application",
            "2. Load 100+ images",
            "3. Process images in batch",
            "4. Monitor memory usage"
        ],
        expected_behavior="Memory usage should remain stable",
        actual_behavior="Memory usage increases by 50MB per image processed",
        tags=["memory", "image-processing", "leak"]
    )
    
    feature = manager.create_feature_request(
        summary="Add batch image processing",
        description="Allow users to process multiple images at once",
        priority="medium",
        assignee="ui.team",
        reporter="user.feedback",
        tags=["ui", "batch-processing", "feature"]
    )
    
    task = manager.create_task(
        summary="Update documentation for API v2",
        description="Update all API documentation to reflect v2 changes",
        priority="low",
        assignee="docs.team",
        reporter="api.team",
        tags=["documentation", "api", "v2"]
    )
    
    print(f"Created bug: {bug.get_id()}")
    print(f"Created feature: {feature.get_id()}")
    print(f"Created task: {task.get_id()}")
    
    # Work with issues
    manager.start_work(bug.get_id(), "backend.team")
    print(f"Started work on {bug.get_id()}")
    
    manager.add_comment(bug.get_id(), "Found the issue in the image decoder - not releasing memory properly", "backend.team")
    print(f"Added comment to {bug.get_id()}")
    
    # Find related issues
    related = manager.find_related_issues(bug.get_id())
    print(f"Found {len(related)} related issues")
    
    # Get issues by assignee
    backend_issues = manager.get_my_issues("backend.team")
    print(f"Backend team has {len(backend_issues)} assigned issues")
    
    # Get high priority issues
    high_priority = manager.get_issues_by_priority("high")
    print(f"Found {len(high_priority)} high priority issues")
    
    # Search by text
    memory_issues = manager.search_issues_by_text("memory")
    print(f"Found {len(memory_issues)} issues related to 'memory'")
    
    # Get overdue issues
    overdue = manager.get_overdue_issues(days_threshold=1)
    print(f"Found {len(overdue)} overdue issues")
    
    # Get issue summary
    summary = manager.get_issue_summary()
    print(f"Issue summary: {summary['total_issues']} total, {summary['active_issues_count']} active")
    
    # Link issues
    manager.link_issues(bug.get_id(), feature.get_id(), "related")
    print(f"Linked {bug.get_id()} and {feature.get_id()}")
    
    # Get timeline
    timeline = manager.get_issue_timeline(bug.get_id())
    print(f"Timeline for {bug.get_id()}: {len(timeline)} events")
    
    return [bug.get_id(), feature.get_id(), task.get_id()]


def demonstrate_advanced_features():
    """Demonstrate advanced features like similarity search and issue relationships."""
    print("\n" + "=" * 60)
    print("DEMONSTRATING ADVANCED FEATURES")
    print("=" * 60)
    
    manager = IssueManager()
    
    # Create a series of related issues to demonstrate similarity
    issues = []
    
    # Network-related issues
    network_issue1 = manager.create_bug_report(
        summary="Network timeout errors on mobile connections",
        description="Users on mobile networks experience frequent timeout errors",
        priority="high",
        tags=["network", "mobile", "timeout"]
    )
    
    network_issue2 = manager.create_bug_report(
        summary="WiFi connection drops during large file uploads",
        description="WiFi connections are dropping when uploading files larger than 100MB",
        priority="medium",
        tags=["network", "wifi", "upload"]
    )
    
    # Database-related issues
    db_issue1 = manager.create_bug_report(
        summary="Database connection timeout under load",
        description="Database connections timeout when system is under heavy load",
        priority="critical",
        tags=["database", "connection", "timeout"]
    )
    
    db_issue2 = manager.create_bug_report(
        summary="Slow database queries affecting performance",
        description="Several database queries are taking too long to execute",
        priority="high",
        tags=["database", "performance", "queries"]
    )
    
    issues.extend([network_issue1.get_id(), network_issue2.get_id(), 
                   db_issue1.get_id(), db_issue2.get_id()])
    
    print(f"Created {len(issues)} issues for similarity testing")
    
    # Test similarity search
    print("\nTesting similarity search:")
    similar_to_network = find_similar_issues(network_issue1.get_id(), similarity_threshold=0.2)
    print(f"Issues similar to '{network_issue1.get_summary()}': {len(similar_to_network)}")
    
    for similar in similar_to_network:
        print(f"  - {similar['issue'].get_summary()} (similarity: {similar['similarity_score']:.2f})")
    
    similar_to_db = find_similar_issues(db_issue1.get_id(), similarity_threshold=0.2)
    print(f"Issues similar to '{db_issue1.get_summary()}': {len(similar_to_db)}")
    
    for similar in similar_to_db:
        print(f"  - {similar['issue'].get_summary()} (similarity: {similar['similarity_score']:.2f})")
    
    # Test issue relationships
    print("\nTesting issue relationships:")
    manager.link_issues(network_issue1.get_id(), network_issue2.get_id(), "related")
    manager.link_issues(db_issue1.get_id(), db_issue2.get_id(), "related")
    print("Linked related issues")
    
    # Test complex search
    print("\nTesting complex search:")
    timeout_issues = search_issues(search_text="timeout", limit=10)
    print(f"Issues containing 'timeout': {len(timeout_issues)}")
    
    high_priority_network = search_issues(priority="high", tags=["network"])
    print(f"High priority network issues: {len(high_priority_network)}")
    
    return issues


def demonstrate_issue_lifecycle():
    """Demonstrate a complete issue lifecycle from creation to resolution."""
    print("\n" + "=" * 60)
    print("DEMONSTRATING ISSUE LIFECYCLE")
    print("=" * 60)
    
    manager = IssueManager()
    
    # Create a bug report
    bug = manager.create_bug_report(
        summary="User authentication fails intermittently",
        description="Users are experiencing random authentication failures",
        priority="high",
        assignee="security.team",
        reporter="support.team",
        environment="Production",
        steps_to_reproduce=[
            "1. User attempts to log in",
            "2. Enters correct credentials",
            "3. Sometimes gets 'authentication failed' error"
        ],
        expected_behavior="Authentication should work consistently",
        actual_behavior="Authentication fails randomly for valid users",
        tags=["authentication", "security", "intermittent"]
    )
    
    print(f"1. Created bug report: {bug.get_id()}")
    print(f"   Status: {bug.get_status()}")
    print(f"   Assignee: {bug.get_assignee()}")
    
    # Start investigation
    manager.start_work(bug.get_id(), "security.team")
    manager.add_comment(bug.get_id(), "Starting investigation into authentication logs", "security.team")
    
    bug = get_issue(bug.get_id())
    print(f"2. Started work: {bug.get_status()}")
    
    # Add investigation notes
    manager.add_comment(bug.get_id(), "Found correlation with high server load", "security.team")
    manager.add_comment(bug.get_id(), "Authentication service is timing out under load", "security.team")
    
    # Update issue with findings
    update_issue(bug.get_id(), {
        "environment": "Production - High load conditions",
        "actual_behavior": "Authentication service times out when server load > 80%"
    })
    
    print(f"3. Added investigation findings")
    
    # Resolve the issue
    manager.resolve_issue(
        bug.get_id(),
        "Increased authentication service timeout from 5s to 15s and added retry logic",
        "fixed"
    )
    
    resolved_bug = get_issue(bug.get_id())
    print(f"4. Resolved issue: {resolved_bug.get_status()}")
    print(f"   Resolution: {resolved_bug.get_resolution()}")
    print(f"   Resolution time: {resolved_bug.get_resolution_time_days()} days")
    
    # Get timeline
    timeline = manager.get_issue_timeline(bug.get_id())
    print(f"5. Issue timeline: {len(timeline)} events")
    for event in timeline:
        print(f"   {event['timestamp'].strftime('%Y-%m-%d %H:%M')}: {event['event']} - {event['description']}")
    
    return bug.get_id()


def cleanup_demo_issues(issue_ids):
    """Clean up demo issues."""
    print("\n" + "=" * 60)
    print("CLEANING UP DEMO ISSUES")
    print("=" * 60)
    
    for issue_id in issue_ids:
        if delete_issue(issue_id):
            print(f"Deleted {issue_id}")
        else:
            print(f"Failed to delete {issue_id}")


def main():
    """Main demonstration function."""
    print("ISSUE TRACKING SYSTEM DEMONSTRATION")
    print("=" * 60)
    print("This demonstration shows the complete issue tracking system capabilities.")
    print("=" * 60)
    
    all_issue_ids = []
    
    try:
        # Run all demonstrations
        basic_issue = demonstrate_basic_issue_operations()
        db_issue_ids = demonstrate_database_operations()
        manager_issue_ids = demonstrate_issue_manager()
        advanced_issue_ids = demonstrate_advanced_features()
        lifecycle_issue_id = demonstrate_issue_lifecycle()
        
        all_issue_ids.extend(db_issue_ids)
        all_issue_ids.extend(manager_issue_ids)
        all_issue_ids.extend(advanced_issue_ids)
        all_issue_ids.append(lifecycle_issue_id)
        
        print("\n" + "=" * 60)
        print("DEMONSTRATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print("The issue tracking system provides:")
        print("✓ Enhanced Issue class with comprehensive fields")
        print("✓ Database operations with MongoDB integration")
        print("✓ High-level IssueManager for common operations")
        print("✓ Advanced search and similarity matching")
        print("✓ Complete issue lifecycle management")
        print("✓ Issue relationships and linking")
        print("✓ Timeline tracking and statistics")
        
    except Exception as e:
        print(f"Error during demonstration: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        if all_issue_ids:
            cleanup_demo_issues(all_issue_ids)


if __name__ == "__main__":
    main()

