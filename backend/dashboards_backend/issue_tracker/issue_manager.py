"""
Issue Manager - High-level interface for issue tracking operations
Provides convenient methods for common issue management tasks
"""

import sys
import os
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import re

# Add paths for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from dashboards_backend.issue_tracker.issue import Issue, IssueStatus, IssuePriority, IssueType
from dashboards_backend.issue_tracker.issue_tracker_database import (
    create_issue, get_issue, update_issue, delete_issue, search_issues,
    find_similar_issues, get_issue_statistics, add_issue_note
)

# File to store the issue counter
ISSUE_COUNTER_FILE = os.path.join(os.path.dirname(__file__), "issue_counter.txt")

def _read_issue_counter() -> int:
    """Read the current issue counter from file."""
    try:
        if os.path.exists(ISSUE_COUNTER_FILE):
            with open(ISSUE_COUNTER_FILE, 'r') as f:
                return int(f.read().strip())
        return 0
    except (ValueError, IOError):
        return 0

def _write_issue_counter(counter: int) -> None:
    """Write the issue counter to file."""
    try:
        with open(ISSUE_COUNTER_FILE, 'w') as f:
            f.write(str(counter))
    except IOError:
        pass  # If we can't write, continue without error

class IssueManager:
    """
    High-level manager for issue tracking operations.
    Provides convenient methods for common issue management tasks.
    """
    
    def __init__(self):
        """Initialize the IssueManager."""
        self.issue_counter = _read_issue_counter()
    
    def _get_next_issue_number(self) -> int:
        """Get the next available issue number from file."""
        current_counter = _read_issue_counter()
        next_counter = current_counter + 1
        _write_issue_counter(next_counter)
        return next_counter
    
    def generate_issue_id(self, prefix: str = "ISSUE") -> str:
        """
        Generate a unique issue ID.
        
        Args:
            prefix: Prefix for the issue ID (default: "ISSUE")
            
        Returns:
            Unique issue ID in format ISSUE_<NUMBER>
        """
        issue_number = self._get_next_issue_number()
        issue_id = f"{prefix}_{issue_number}"
        return issue_id
    
    def create_bug_report(self, summary: str, troubleshooting_steps: str = "", 
                         priority: str = "medium", assignee: str = "",
                         reporter: str = "") -> Issue:
        """
        Create a bug report issue.
        
        Args:
            summary: Brief description of the bug
            troubleshooting_steps: Steps to troubleshoot the issue
            priority: Priority level
            assignee: Person assigned to fix the bug
            reporter: Person who reported the bug
            
        Returns:
            Created Issue object
        """
        issue_id = self.generate_issue_id("ISSUE")
        
        issue = create_issue(
            issue_id=issue_id,
            summary=summary,
            status=IssueStatus.NOT_STARTED.value,
            priority=priority,
            issue_type=IssueType.BUG.value,
            assignee=assignee,
            reporter=reporter
        )
        
        # Set troubleshooting steps
        if troubleshooting_steps:
            issue.set_troubleshooting_steps(troubleshooting_steps)
        
        # Update in database
        update_issue(issue_id, {})
        
        return issue
    
    def create_feature_request(self, summary: str, troubleshooting_steps: str = "",
                              priority: str = "medium", assignee: str = "",
                              reporter: str = "") -> Issue:
        """
        Create a feature request issue.
        
        Args:
            summary: Brief description of the feature
            troubleshooting_steps: Steps to troubleshoot the issue
            priority: Priority level
            assignee: Person assigned to implement the feature
            reporter: Person who requested the feature
            
        Returns:
            Created Issue object
        """
        issue_id = self.generate_issue_id("ISSUE")
        
        issue = create_issue(
            issue_id=issue_id,
            summary=summary,
            status=IssueStatus.NOT_STARTED.value,
            priority=priority,
            issue_type=IssueType.FEATURE.value,
            assignee=assignee,
            reporter=reporter
        )
        
        # Set troubleshooting steps
        if troubleshooting_steps:
            issue.set_troubleshooting_steps(troubleshooting_steps)
        
        return issue
    
    def create_task(self, summary: str, troubleshooting_steps: str = "",
                   priority: str = "medium", assignee: str = "",
                   reporter: str = "") -> Issue:
        """
        Create a task issue.
        
        Args:
            summary: Brief description of the task
            troubleshooting_steps: Steps to troubleshoot the issue
            priority: Priority level
            assignee: Person assigned to the task
            reporter: Person who created the task
            
        Returns:
            Created Issue object
        """
        issue_id = self.generate_issue_id("ISSUE")
        
        issue = create_issue(
            issue_id=issue_id,
            summary=summary,
            status=IssueStatus.NOT_STARTED.value,
            priority=priority,
            issue_type=IssueType.TASK.value,
            assignee=assignee,
            reporter=reporter
        )
        
        # Set troubleshooting steps
        if troubleshooting_steps:
            issue.set_troubleshooting_steps(troubleshooting_steps)
        
        return issue
    
    def assign_issue(self, issue_id: str, assignee: str) -> bool:
        """
        Assign an issue to a person.
        
        Args:
            issue_id: ID of the issue to assign
            assignee: Person to assign the issue to
            
        Returns:
            True if assignment was successful
        """
        result = update_issue(issue_id, {"assignee": assignee})
        return result is not None
    
    def start_work(self, issue_id: str, assignee: str = None) -> bool:
        """
        Start work on an issue (set status to in progress).
        
        Args:
            issue_id: ID of the issue to start work on
            assignee: Person starting the work (optional)
            
        Returns:
            True if status was updated successfully
        """
        updates = {"status": IssueStatus.IN_PROGRESS.value}
        if assignee:
            updates["assignee"] = assignee
        
        result = update_issue(issue_id, updates)
        return result is not None
    
    def resolve_issue(self, issue_id: str, resolution: str = "", 
                     resolution_type: str = "fixed") -> bool:
        """
        Resolve an issue.
        
        Args:
            issue_id: ID of the issue to resolve
            resolution: Description of the resolution
            resolution_type: Type of resolution (fixed, won't fix, duplicate, etc.)
            
        Returns:
            True if issue was resolved successfully
        """
        updates = {
            "status": IssueStatus.RESOLVED.value,
            "resolution": resolution
        }
        
        result = update_issue(issue_id, updates)
        if result:
            # Add a note about the resolution
            note_id = f"RES-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            add_issue_note(issue_id, note_id, f"Issue resolved: {resolution_type}. {resolution}")
        
        return result is not None
    
    def close_issue(self, issue_id: str, reason: str = "") -> bool:
        """
        Close an issue.
        
        Args:
            issue_id: ID of the issue to close
            reason: Reason for closing
            
        Returns:
            True if issue was closed successfully
        """
        updates = {"status": IssueStatus.CLOSED.value}
        if reason:
            updates["resolution"] = reason
        
        result = update_issue(issue_id, updates)
        if result:
            # Add a note about the closure
            note_id = f"CLOSE-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            add_issue_note(issue_id, note_id, f"Issue closed: {reason}")
        
        return result is not None
    
    def add_comment(self, issue_id: str, comment: str, author: str = "") -> bool:
        """
        Add a comment/note to an issue.
        
        Args:
            issue_id: ID of the issue
            comment: Comment text
            author: Author of the comment (optional)
            
        Returns:
            True if comment was added successfully
        """
        note_id = f"NOTE-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        note_content = f"[{author}] {comment}" if author else comment
        
        return add_issue_note(issue_id, note_id, note_content)
    
    def find_related_issues(self, issue_id: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Find issues related to a given issue.
        
        Args:
            issue_id: ID of the issue to find related issues for
            max_results: Maximum number of related issues to return
            
        Returns:
            List of related issues with similarity scores
        """
        return find_similar_issues(issue_id, similarity_threshold=0.2, limit=max_results)
    
    def get_my_issues(self, assignee: str, status: str = None) -> List[Issue]:
        """
        Get issues assigned to a specific person.
        
        Args:
            assignee: Person to get issues for
            status: Filter by status (optional)
            
        Returns:
            List of issues assigned to the person
        """
        return search_issues(assignee=assignee, status=status)
    
    def get_issues_by_priority(self, priority: str) -> List[Issue]:
        """
        Get issues by priority level.
        
        Args:
            priority: Priority level to filter by
            
        Returns:
            List of issues with the specified priority
        """
        return search_issues(priority=priority)
    
    def get_issues_by_type(self, issue_type: str) -> List[Issue]:
        """
        Get issues by type.
        
        Args:
            issue_type: Issue type to filter by
            
        Returns:
            List of issues of the specified type
        """
        return search_issues(issue_type=issue_type)
    
    def search_issues_by_text(self, search_text: str, limit: int = 20) -> List[Issue]:
        """
        Search issues by text in summary and description.
        
        Args:
            search_text: Text to search for
            limit: Maximum number of results
            
        Returns:
            List of matching issues
        """
        return search_issues(search_text=search_text, limit=limit)
    
    def get_overdue_issues(self, days_threshold: int = 7) -> List[Issue]:
        """
        Get issues that are overdue (in progress for more than threshold days).
        
        Args:
            days_threshold: Number of days to consider as overdue
            
        Returns:
            List of overdue issues
        """
        all_issues = search_issues(status=IssueStatus.IN_PROGRESS.value, limit=1000)
        overdue_issues = []
        
        cutoff_date = datetime.now() - timedelta(days=days_threshold)
        
        for issue in all_issues:
            if issue.get_updated_at() <= cutoff_date:
                overdue_issues.append(issue)
        
        return overdue_issues
    
    def get_issue_summary(self, time_period_days: int = 30) -> Dict[str, Any]:
        """
        Get a summary of issues for a time period.
        
        Args:
            time_period_days: Number of days to look back
            
        Returns:
            Dictionary containing issue summary statistics
        """
        stats = get_issue_statistics(time_period_days)
        
        # Add additional calculated metrics
        active_issues = search_issues(status=IssueStatus.IN_PROGRESS.value, limit=1000)
        high_priority_issues = search_issues(priority=IssuePriority.HIGH.value, limit=1000)
        critical_issues = search_issues(priority=IssuePriority.CRITICAL.value, limit=1000)
        
        stats.update({
            "active_issues_count": len(active_issues),
            "high_priority_count": len(high_priority_issues),
            "critical_issues_count": len(critical_issues),
            "overdue_issues_count": len(self.get_overdue_issues())
        })
        
        return stats
    
    def link_issues(self, issue_id_1: str, issue_id_2: str, relationship: str = "related") -> bool:
        """
        Link two issues together.
        
        Args:
            issue_id_1: First issue ID
            issue_id_2: Second issue ID
            relationship: Type of relationship (related, blocks, duplicates, etc.)
            
        Returns:
            True if linking was successful
        """
        issue1 = get_issue(issue_id_1)
        issue2 = get_issue(issue_id_2)
        
        if not issue1 or not issue2:
            return False
        
        # Add each issue to the other's related issues
        issue1.add_related_issue(issue_id_2)
        issue2.add_related_issue(issue_id_1)
        
        # Update both issues in database
        update_issue(issue_id_1, {})
        update_issue(issue_id_2, {})
        
        # Add notes about the relationship
        note_id_1 = f"LINK-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        note_id_2 = f"LINK-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        add_issue_note(issue_id_1, note_id_1, f"Linked to {issue_id_2} ({relationship})")
        add_issue_note(issue_id_2, note_id_2, f"Linked to {issue_id_1} ({relationship})")
        
        return True
    
    def get_issue_timeline(self, issue_id: str) -> List[Dict[str, Any]]:
        """
        Get the timeline of an issue (creation, updates, resolution).
        
        Args:
            issue_id: ID of the issue
            
        Returns:
            List of timeline events
        """
        issue = get_issue(issue_id)
        if not issue:
            return []
        
        timeline = []
        
        # Creation event
        timeline.append({
            "timestamp": issue.get_created_at(),
            "event": "created",
            "description": f"Issue created by {issue.get_reporter() or 'Unknown'}",
            "details": issue.get_summary()
        })
        
        # Update events (from notes)
        for note_id, note_content in issue.get_notes().items():
            # Try to extract timestamp from note ID if it follows the pattern
            if note_id.startswith(("RA-", "RES-", "CLOSE-", "NOTE-", "LINK-")):
                try:
                    # Extract timestamp from note ID if available
                    timestamp_str = note_id.split('-', 1)[1] if '-' in note_id else None
                    if timestamp_str and len(timestamp_str) >= 8:
                        timestamp = datetime.strptime(timestamp_str[:15], "%Y%m%d-%H%M%S")
                    else:
                        timestamp = issue.get_updated_at()
                except:
                    timestamp = issue.get_updated_at()
            else:
                timestamp = issue.get_updated_at()
            
            timeline.append({
                "timestamp": timestamp,
                "event": "note",
                "description": note_content,
                "note_id": note_id
            })
        
        # Resolution event
        if issue.get_resolved_at():
            timeline.append({
                "timestamp": issue.get_resolved_at(),
                "event": "resolved",
                "description": f"Issue resolved: {issue.get_resolution()}",
                "details": issue.get_resolution()
            })
        
        # Sort timeline by timestamp
        timeline.sort(key=lambda x: x["timestamp"])
        
        return timeline


# Example usage
if __name__ == "__main__":
    # Test the IssueManager
    print("Testing IssueManager...")
    
    manager = IssueManager()
    
    # Create a bug report
    bug = manager.create_bug_report(
        summary="Database connection timeout",
        troubleshooting_steps="1. Open the application\n2. Try to load user data\n3. Wait for 30 seconds\nExpected: Data should load within 5 seconds\nActual: Connection times out after 30 seconds",
        priority="high",
        assignee="john.doe",
        reporter="jane.smith"
    )
    print(f"Created bug: {bug.get_id()}")
    
    # Create a feature request
    feature = manager.create_feature_request(
        summary="Add dark mode support",
        troubleshooting_steps="Users have requested a dark mode theme for the application",
        priority="medium",
        assignee="ui.team",
        reporter="user.feedback"
    )
    print(f"Created feature: {feature.get_id()}")
    
    # Start work on the bug
    manager.start_work(bug.get_id(), "john.doe")
    print(f"Started work on {bug.get_id()}")
    
    # Add a comment
    manager.add_comment(bug.get_id(), "Investigating database connection pool settings", "john.doe")
    print(f"Added comment to {bug.get_id()}")
    
    # Find related issues
    related = manager.find_related_issues(bug.get_id())
    print(f"Found {len(related)} related issues")
    
    # Get issue summary
    summary = manager.get_issue_summary()
    print(f"Issue summary: {summary}")
    
    # Get timeline
    timeline = manager.get_issue_timeline(bug.get_id())
    print(f"Timeline for {bug.get_id()}: {len(timeline)} events")
    
    # Clean up
    delete_issue(bug.get_id())
    delete_issue(feature.get_id())
    print("Test completed and cleaned up")
