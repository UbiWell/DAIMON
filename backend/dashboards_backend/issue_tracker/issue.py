import json
import time
from enum import Enum
from datetime import datetime

class IssueStatus(Enum):
    NOT_STARTED = "not started"
    IN_PROGRESS = "in progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

class IssuePriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class IssueType(Enum):
    BUG = "bug"
    FEATURE = "feature"
    TASK = "task"

class Issue:
    def __init__(self, issue_id, summary="", status="not started", priority="medium", 
                 assignee="", troubleshooting_steps="", resolution="", severity="green", uid=""):
        """
        Initialize an Issue instance.

        Args:
            issue_id: Unique identifier for the issue
            summary: Text description of the issue
            status: Current status ('not started', 'in progress', 'resolved')
            priority: Priority level ('low', 'medium', 'high', 'critical')
            assignee: Person assigned to the issue
            troubleshooting_steps: Steps to troubleshoot the issue
            resolution: Resolution description
            severity: Severity level ('green', 'yellow', 'red')
            uid: User ID who reported the issue
        """
        self._id = issue_id
        self._summary = summary
        self._status = status
        self._priority = priority
        self._assignee = assignee
        self._uid = uid
        self._troubleshooting_steps = troubleshooting_steps
        self._resolution = resolution
        self._severity = severity
        self._potential_past_issues = {}  # {issue_id: Issue instance}
        self._notes = {}  # {RA_ID: "note content"}
        self._created_at = int(time.time())
        self._updated_at = int(time.time())
        self._resolved_at = None

        # Validate initial status
        self._validate_status(status)

    def _validate_status(self, status):
        """Validate that status is one of the allowed values."""
        valid_statuses = ["not started", "in progress", "resolved"]
        if status not in valid_statuses:
            raise ValueError(f"Status must be one of: {valid_statuses}")

    # ID getter and setter
    def get_id(self):
        return self._id

    def set_id(self, issue_id):
        self._id = issue_id

    # Summary getter and setter
    def get_summary(self):
        return self._summary

    def set_summary(self, summary):
        self._summary = summary

    # Status getter and setter
    def get_status(self):
        return self._status

    def set_status(self, status):
        self._validate_status(status)
        self._status = status

    # Potential past issues getter and setter
    def get_potential_past_issues(self):
        return self._potential_past_issues.copy()  # Return copy to prevent direct modification

    def set_potential_past_issues(self, past_issues_dict):
        if not isinstance(past_issues_dict, dict):
            raise TypeError("Potential past issues must be a dictionary")
        self._potential_past_issues = past_issues_dict.copy()

    def add_potential_past_issue(self, issue_id, issue_info):
        """Add a single past issue to the dictionary."""
        self._potential_past_issues[issue_id] = issue_info

    def remove_potential_past_issue(self, issue_id):
        """Remove a past issue from the dictionary."""
        if issue_id in self._potential_past_issues:
            del self._potential_past_issues[issue_id]

    # Notes getter and setter
    def get_notes(self):
        return self._notes.copy()  # Return copy to prevent direct modification

    def set_notes(self, notes_dict):
        if not isinstance(notes_dict, dict):
            raise TypeError("Notes must be a dictionary")
        self._notes = notes_dict.copy()

    def add_note(self, ra_id, note_content):
        """Add a single note to the notes dictionary."""
        self._notes[ra_id] = note_content

    def remove_note(self, ra_id):
        """Remove a note from the notes dictionary."""
        if ra_id in self._notes:
            del self._notes[ra_id]

    def get_note(self, ra_id):
        """Get a specific note by RA_ID."""
        return self._notes.get(ra_id)

    # Priority getter and setter
    def get_priority(self):
        return self._priority

    def set_priority(self, priority):
        self._priority = priority
        self._updated_at = int(time.time())

    # Assignee getter and setter
    def get_assignee(self):
        return self._assignee

    def set_assignee(self, assignee):
        self._assignee = assignee
        self._updated_at = int(time.time())

    # UID getter and setter
    def get_uid(self):
        return self._uid

    def set_uid(self, uid):
        self._uid = uid
        self._updated_at = int(time.time())

    # Troubleshooting steps getter and setter
    def get_troubleshooting_steps(self):
        return self._troubleshooting_steps

    def set_troubleshooting_steps(self, troubleshooting_steps):
        self._troubleshooting_steps = troubleshooting_steps
        self._updated_at = int(time.time())

    # Resolution getter and setter
    def get_resolution(self):
        return self._resolution

    def set_resolution(self, resolution):
        self._resolution = resolution
        self._updated_at = int(time.time())

    # Severity getter and setter
    def get_severity(self):
        return self._severity

    def set_severity(self, severity):
        self._severity = severity
        self._updated_at = int(time.time())

    # Timestamp getters
    def get_created_at(self):
        return self._created_at

    def get_updated_at(self):
        return self._updated_at

    def get_resolved_at(self):
        return self._resolved_at

    def set_resolved_at(self, resolved_at=None):
        if resolved_at is None:
            resolved_at = int(time.time())
        self._resolved_at = resolved_at
        self._updated_at = int(time.time())

    # Utility methods
    def __str__(self):
        return f"Issue(ID: {self._id}, Status: {self._status}, Summary: {self._summary[:50]}...)"

    def __repr__(self):
        return (f"Issue(issue_id={self._id!r}, summary={self._summary!r}, "
                f"status={self._status!r})")

    def to_json(self):
        """
        Convert this Issue object to JSON string.

        Returns:
            str: JSON string representation of the issue
        """
        # Create a dictionary with all issue data
        issue_dict = {
            "id": self.get_id(),
            "summary": self.get_summary(),
            "status": self.get_status(),
            "priority": self.get_priority(),
            "assignee": self.get_assignee(),
            "uid": self.get_uid(),
            "severity": self.get_severity(),
            "resolution": self.get_resolution(),
            "notes": self.get_notes(),
            "potential_past_issues": {}
        }

        # Handle potential past issues - they might be Issue objects or other data
        past_issues = self.get_potential_past_issues()
        for issue_id, issue_info in past_issues.items():
            if isinstance(issue_info, Issue):
                # If it's an Issue object, recursively convert it
                issue_dict["potential_past_issues"][issue_id] = {
                    "type": "Issue",
                    "data": {
                        "id": issue_info.get_id(),
                        "summary": issue_info.get_summary(),
                        "status": issue_info.get_status(),
                        "notes": issue_info.get_notes(),
                        "potential_past_issues": {}  # Avoid deep nesting for simplicity
                    }
                }
            else:
                # If it's other data (string, dict, etc.), store it directly
                issue_dict["potential_past_issues"][issue_id] = {
                    "type": "other",
                    "data": issue_info
                }

        return json.dumps(issue_dict, indent=2)


    

# Example usage:
if __name__ == "__main__":
    # Create a new issue
    issue = Issue("ISS-001", "Database connection timeout", "not started")

    # Use getters
    print(f"Issue ID: {issue.get_id()}")
    print(f"Summary: {issue.get_summary()}")
    print(f"Status: {issue.get_status()}")

    # Use setters
    issue.set_status("in progress")
    issue.set_summary("Database connection timeout - investigating root cause")

    # Add notes
    issue.add_note("RA-001", "Initial investigation started")
    issue.add_note("RA-002", "Found potential network issue")

    # Add past issues
    past_issue = Issue("ISS-000", "Similar database issue from last month", "resolved")
    issue.add_potential_past_issue("ISS-000", past_issue)

    print(f"\nUpdated issue: {issue}")
    print(f"Notes: {issue.get_notes()}")
    print(f"Past issues: {list(issue.get_potential_past_issues().keys())}")