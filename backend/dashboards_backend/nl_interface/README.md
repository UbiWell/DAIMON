# NL Interface Call Database System

A comprehensive CSV-based database system for tracking Natural Language interface calls with view IDs, modes, refresh intervals, queries, responses, and timestamps.

## Overview

This system maintains a common database of NL interface calls indexed by view ID, providing:
- **Call tracking** with view IDs, modes, and refresh intervals
- **Response caching** for redo operations
- **Statistics and reporting** capabilities
- **CSV-based persistence** for easy backup and analysis

## Database Schema

The database stores the following information for each call:

| Field | Type | Description |
|-------|------|-------------|
| `view_id` | String | The ID of the view making the request |
| `mode` | String | The detected mode (summary, analysis, suggestions, graph, data_subsetting) |
| `refresh_interval` | String | The selected refresh interval ('none', '2h', '6h', '1d', '7d') |
| `query` | String | The user's search query |
| `response` | JSON/String | The response data from the function |
| `timestamp` | String | ISO timestamp of when the call was made |
| `is_redo` | Boolean | Flag indicating if this was a redo operation |

## Function Integration

All NL interface functions now support the database system:

### `detect_mode(query, view_id="default", refresh_interval="none", is_redo=False)`

**When `is_redo=False`:**
- Detects the mode using the ModeAgent
- Creates a new database record with view_id, mode, refresh_interval, query, and timestamp
- Returns mode information and database record

**When `is_redo=True`:**
- Retrieves the mode from the database for the given view_id
- Returns cached mode information

### `summary(query, view_id="default", is_redo=False)`
### `analysis(query, view_id="default", is_redo=False)`
### `suggestions(query, view_id="default", is_redo=False)`
### `graph(query, view_id="default", is_redo=False)`
### `data_subsetting(query, view_id="default", is_redo=False)`

**When `is_redo=False`:**
- Executes the function and generates new results
- Updates the database with the response
- Returns results with view_id and is_redo flag

**When `is_redo=True`:**
- Retrieves cached response from database
- Returns cached results without re-execution

## Usage Examples

### Basic Workflow

```python
from dashboards_backend.nl_interface.functions import detect_mode, summary

# First call - detect mode and create database record
view_id = "dashboard_view_001"
query = "Show me user activity summary"
refresh_interval = "2h"

mode_result = detect_mode(query, view_id, refresh_interval, is_redo=False)
print(f"Detected mode: {mode_result['mode']}")

# Execute function based on mode
if mode_result['mode'] == 'summary':
    result = summary(query, view_id, is_redo=False)
    print(f"Summary: {result['results']}")

# Second call - retrieve from database (redo=True)
mode_result_redo = detect_mode(query, view_id, refresh_interval, is_redo=True)
print(f"Retrieved mode: {mode_result_redo['mode']}")

# Execute function with cached response
if mode_result_redo['mode'] == 'summary':
    result_redo = summary(query, view_id, is_redo=True)
    print(f"Cached summary: {result_redo['results']}")
```

### Database Management

```python
from dashboards_backend.nl_interface.nl_call_database import (
    get_call_statistics, get_recent_calls, get_calls_by_mode
)

# Get statistics
stats = get_call_statistics()
print(f"Total calls: {stats['total_calls']}")
print(f"Mode breakdown: {stats['mode_breakdown']}")

# Get recent calls
recent = get_recent_calls(10)
for call in recent:
    print(f"View: {call['view_id']}, Mode: {call['mode']}")

# Get calls by mode
summary_calls = get_calls_by_mode('summary')
print(f"Summary calls: {len(summary_calls)}")
```

## Database Functions

### Core Functions

- `create_call_record(view_id, mode, refresh_interval, query, is_redo)` - Create new call record
- `update_call_response(view_id, response)` - Update response for a call
- `get_call_by_view_id(view_id)` - Get most recent call for view
- `get_mode_by_view_id(view_id)` - Get mode for view
- `get_response_by_view_id(view_id)` - Get response for view

### Query Functions

- `get_calls_by_mode(mode)` - Get all calls for a mode
- `get_calls_by_refresh_interval(refresh_interval)` - Get calls by refresh interval
- `get_recent_calls(limit)` - Get most recent calls
- `get_call_statistics()` - Get comprehensive statistics

### Management Functions

- `delete_call_by_view_id(view_id)` - Delete all calls for a view
- `clear_all_calls()` - Clear all call records

## File Structure

```
dashboards_backend/nl_interface/
├── functions.py              # Updated NL interface functions
├── nl_call_database.py       # Database management system
├── test_nl_database.py       # Test and demonstration script
├── nl_calls.csv              # CSV database file (auto-created)
└── README.md                 # This documentation
```

## CSV File Format

The `nl_calls.csv` file contains:

```csv
view_id,mode,refresh_interval,query,response,timestamp,is_redo
dashboard_view_001,summary,2h,"Show me user activity","User activity shows...","2024-01-01T10:00:00",false
dashboard_view_002,graph,1d,"Create sales chart","{""image_path"": ""/static/images/chart.png""}","2024-01-01T11:00:00",false
```

## Performance Characteristics

- **Fast for small to medium datasets** (< 10,000 calls)
- **No database server required** - runs locally
- **Simple backup** - just copy the CSV file
- **Human readable** - can open in Excel/Google Sheets
- **Version control friendly** - can track changes in Git

## Error Handling

The system includes comprehensive error handling:

- **Graceful fallbacks** when database operations fail
- **Default values** for missing parameters
- **JSON serialization** error handling
- **File I/O error** recovery

## Testing

Run the test script to verify functionality:

```bash
cd dashboards_backend/nl_interface
python test_nl_database.py
```

This will test:
- Database creation and management
- Mode detection and storage
- Function integration with database
- Redo functionality
- Statistics and reporting
- CSV file persistence

## Integration Notes

### Backward Compatibility

All functions maintain backward compatibility:
- Default parameters ensure existing code continues to work
- Optional parameters don't break existing function calls
- Database integration is transparent to existing workflows

### Performance Impact

- **Minimal overhead** for new calls
- **Significant speedup** for redo operations (cached responses)
- **Efficient CSV operations** with batch read/write
- **Memory efficient** - only loads data when needed

## Future Enhancements

Potential improvements:

1. **Advanced Analytics** - More sophisticated reporting
2. **Data Retention Policies** - Automatic cleanup of old records
3. **Export/Import** - Backup and restore functionality
4. **Search Capabilities** - Full-text search across queries
5. **API Integration** - REST endpoints for database access
6. **Real-time Updates** - Live statistics and monitoring

## Troubleshooting

### Common Issues

1. **CSV file not created** - Check file permissions
2. **Import errors** - Verify Python path configuration
3. **JSON serialization errors** - Check response data format
4. **Performance issues** - Consider data cleanup for large datasets

### Debug Mode

Enable debug logging by setting environment variable:
```bash
export NL_DATABASE_DEBUG=1
```

This will provide detailed logging of database operations.
