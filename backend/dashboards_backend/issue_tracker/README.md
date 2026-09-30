# Issue Tracking System

A comprehensive issue tracking system designed for the AI-in-Dashboards project. This system provides full CRUD operations, advanced search capabilities, and intelligent issue relationship management.

## Features

### Core Functionality
- **Issue Creation**: Create bugs, features, tasks, and enhancements
- **Issue Management**: Full lifecycle management from creation to resolution
- **Search & Filtering**: Advanced search by multiple criteria
- **Similarity Matching**: Find related past issues automatically
- **Issue Relationships**: Link related issues together
- **Timeline Tracking**: Complete audit trail of issue changes
- **Statistics & Reporting**: Comprehensive issue analytics

### Issue Types
- **Bug**: Software defects and issues
- **Feature**: New functionality requests
- **Enhancement**: Improvements to existing features
- **Task**: General work items
- **Investigation**: Research and analysis tasks

### Priority Levels
- **Low**: Minor issues, nice-to-have features
- **Medium**: Standard priority issues
- **High**: Important issues requiring attention
- **Critical**: Urgent issues requiring immediate attention

### Status Workflow
- **Not Started**: Newly created issue
- **In Progress**: Work has begun on the issue
- **Resolved**: Issue has been fixed/completed
- **Closed**: Issue is closed (may be different from resolved)
- **Cancelled**: Issue was cancelled/abandoned

## Architecture

The system consists of three main components:

### 1. Issue Class (`issue.py`)
Enhanced Issue class with comprehensive fields:
- Basic information (ID, summary, description)
- Metadata (priority, type, status, assignee, reporter)
- Timestamps (created, updated, resolved)
- Technical details (environment, steps to reproduce)
- Relationships (related issues, components, tags)
- Notes and attachments

### 2. Database Module (`issue_tracker_database.py`)
MongoDB-based storage following the project's database registry pattern:
- CRUD operations for issues
- Advanced search and filtering
- Similarity matching algorithms
- Statistics and reporting functions
- Integration with the project's database registry

### 3. Issue Manager (`issue_manager.py`)
High-level interface for common operations:
- Issue creation helpers (bug reports, feature requests, tasks)
- Workflow management (assign, start work, resolve, close)
- Search and filtering convenience methods
- Issue relationship management
- Timeline and statistics access

## Usage Examples

### Basic Issue Creation

```python
from dashboards_backend.issue_tracker.issue import Issue, IssueStatus, IssuePriority, IssueType

# Create a new issue
issue = Issue(
    issue_id="ISS-2024-001",
    summary="Application crashes on startup",
    status=IssueStatus.NOT_STARTED.value,
    priority=IssuePriority.HIGH.value,
    issue_type=IssueType.BUG.value,
    assignee="john.doe",
    reporter="jane.smith",
    description="The application crashes immediately after startup",
    tags=["crash", "startup", "critical"]
)
```

### Using the Issue Manager

```python
from dashboards_backend.issue_tracker.issue_manager import IssueManager

manager = IssueManager()

# Create a bug report
bug = manager.create_bug_report(
    summary="Database connection timeout",
    description="Users experiencing timeout errors",
    priority="high",
    assignee="db.admin",
    reporter="support.team",
    environment="Production",
    steps_to_reproduce=[
        "1. Open application",
        "2. Try to load data",
        "3. Wait for timeout"
    ],
    expected_behavior="Data should load within 5 seconds",
    actual_behavior="Connection times out after 30 seconds",
    tags=["database", "timeout"]
)

# Start work on the issue
manager.start_work(bug.get_id(), "db.admin")

# Add comments
manager.add_comment(bug.get_id(), "Found the issue in connection pool settings", "db.admin")

# Resolve the issue
manager.resolve_issue(bug.get_id(), "Increased connection pool size from 10 to 50")
```

### Database Operations

```python
from dashboards_backend.issue_tracker.issue_tracker_database import (
    create_issue, get_issue, search_issues, find_similar_issues
)

# Create issue in database
issue = create_issue(
    issue_id="ISS-2024-002",
    summary="Feature request: Dark mode",
    status="not started",
    priority="medium",
    issue_type="feature",
    assignee="ui.team",
    reporter="user.feedback"
)

# Search for issues
high_priority_issues = search_issues(priority="high")
database_issues = search_issues(tags=["database"])
text_search = search_issues(search_text="timeout")

# Find similar issues
similar = find_similar_issues("ISS-2024-001", similarity_threshold=0.3)
```

### Advanced Features

```python
# Find related issues
related = manager.find_related_issues("ISS-2024-001")

# Link issues together
manager.link_issues("ISS-2024-001", "ISS-2024-002", "related")

# Get issue timeline
timeline = manager.get_issue_timeline("ISS-2024-001")

# Get statistics
stats = manager.get_issue_summary(time_period_days=30)

# Search by multiple criteria
results = search_issues(
    status="in progress",
    priority="high",
    assignee="john.doe",
    tags=["database", "performance"],
    limit=10
)
```

## Database Schema

Issues are stored in MongoDB with the following structure:

```json
{
  "id": "ISS-2024-001",
  "summary": "Issue summary",
  "status": "in progress",
  "priority": "high",
  "issue_type": "bug",
  "assignee": "john.doe",
  "reporter": "jane.smith",
  "description": "Detailed description",
  "tags": ["tag1", "tag2"],
  "created_at": "2024-01-01T10:00:00",
  "updated_at": "2024-01-01T10:00:00",
  "resolved_at": null,
  "attachments": [],
  "related_issues": [],
  "components": [],
  "environment": "Production",
  "steps_to_reproduce": [],
  "expected_behavior": "",
  "actual_behavior": "",
  "resolution": "",
  "notes": {
    "RA-001": "Note content"
  },
  "potential_past_issues": {}
}
```

## Integration with Project Database Registry

The issue tracker integrates with the project's database registry system:

```python
# The issue tracker database is automatically registered
from agents.database_registry import get_database

issue_db = get_database("issue tracker database")
```

This allows the issue tracker to be used by other agents and systems in the project.

## Similarity Matching Algorithm

The system uses a hybrid similarity matching approach:

1. **Text Similarity**: Word overlap between summaries and descriptions
2. **Tag Similarity**: Common tags between issues
3. **Combined Score**: Weighted combination (70% text, 30% tags)

This helps find relevant past issues that might provide solutions or context for new issues.

## Error Handling

The system includes comprehensive error handling:

- Validation of issue statuses, priorities, and types
- Duplicate issue ID prevention
- Graceful handling of missing issues
- Database connection error handling

## Performance Considerations

- Database queries are optimized with proper indexing
- Search results are limited to prevent performance issues
- Similarity matching is performed in-memory for small datasets
- Large-scale deployments may need additional optimization

## Testing

Run the example usage to test the system:

```bash
cd dashboards_backend/issue_tracker
python example_usage.py
```

This will demonstrate all features and create/clean up test data.

## Future Enhancements

Potential improvements for the system:

1. **Advanced Analytics**: More sophisticated reporting and analytics
2. **Integration APIs**: REST API for external integrations
3. **Notification System**: Email/Slack notifications for issue updates
4. **File Attachments**: Support for file uploads and attachments
5. **Workflow Automation**: Automated status transitions based on conditions
6. **Advanced Search**: Full-text search with Elasticsearch integration
7. **Issue Templates**: Predefined templates for common issue types
8. **Bulk Operations**: Bulk update and management capabilities

## Contributing

When adding new features:

1. Follow the existing code patterns
2. Add comprehensive docstrings
3. Include example usage
4. Update this README
5. Add appropriate error handling
6. Consider database registry integration

## Dependencies

- MongoDB (via pymongo)
- Python datetime and typing modules
- Project's database configuration system
- Project's database registry system

