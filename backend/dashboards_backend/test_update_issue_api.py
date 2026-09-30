#!/usr/bin/env python3
"""
Test script for the update issue API endpoint.
"""

import requests
import json

BASE_URL = "http://localhost:5050"

def test_update_issue_api():
    """Test the update issue API endpoint."""
    print("=" * 60)
    print("TESTING UPDATE ISSUE API")
    print("=" * 60)
    
    # First, create an issue to update
    print("1. Creating an issue to update...")
    create_data = {
        "userId": "test004",
        "reason": "Test issue for updating",
        "potentialPastIssues": [],
        "color": "yellow",
        "raName": "TestRA"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/issues/create", json=create_data)
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Response: {json.dumps(result, indent=2)}")
        
        if response.status_code == 200:
            issue_id = result.get("issueID")
            print(f"   ✅ Issue created successfully with ID: {issue_id}")
        else:
            print(f"   ❌ Failed to create issue")
            return
            
    except Exception as e:
        print(f"   Error creating issue: {e}")
        return
    
    # Now test updating the issue
    print(f"\n2. Testing update issue API with ID: {issue_id}")
    update_data = {
        "issueId": issue_id,
        "status": "in progress",
        "priority": "high",
        "resolution": "Fixed by updating configuration",
        "raNotes": ["Note 1: Initial investigation", "Note 2: Found root cause"],
        "raName": "Akshat"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/issues/update", json=update_data)
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Response: {json.dumps(result, indent=2)}")
        
        if response.status_code == 200:
            print(f"   ✅ Issue updated successfully")
        else:
            print(f"   ❌ Failed to update issue")
            
    except Exception as e:
        print(f"   Error updating issue: {e}")
    
    # Test updating with partial data
    print(f"\n3. Testing partial update...")
    partial_update_data = {
        "issueId": issue_id,
        "status": "resolved",
        "raNotes": ["Note 3: Issue resolved"]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/issues/update", json=partial_update_data)
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Response: {json.dumps(result, indent=2)}")
        
        if response.status_code == 200:
            print(f"   ✅ Partial update successful")
        else:
            print(f"   ❌ Failed partial update")
            
    except Exception as e:
        print(f"   Error in partial update: {e}")
    
    # Test updating non-existent issue
    print(f"\n4. Testing update of non-existent issue...")
    fake_update_data = {
        "issueId": "ISSUE_99999",
        "status": "in progress"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/issues/update", json=fake_update_data)
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Response: {json.dumps(result, indent=2)}")
        
        if response.status_code == 404:
            print(f"   ✅ Correctly returned 404 for non-existent issue")
        else:
            print(f"   ❌ Expected 404 but got {response.status_code}")
            
    except Exception as e:
        print(f"   Error testing non-existent issue: {e}")
    
    # Test missing issueId
    print(f"\n5. Testing missing issueId...")
    invalid_data = {
        "status": "in progress"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/issues/update", json=invalid_data)
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Response: {json.dumps(result, indent=2)}")
        
        if response.status_code == 400:
            print(f"   ✅ Correctly returned 400 for missing issueId")
        else:
            print(f"   ❌ Expected 400 but got {response.status_code}")
            
    except Exception as e:
        print(f"   Error testing missing issueId: {e}")

def show_api_documentation():
    """Show API documentation."""
    print("\n" + "=" * 60)
    print("UPDATE ISSUE API DOCUMENTATION")
    print("=" * 60)
    
    print("""
ENDPOINT: POST /api/issues/update

DESCRIPTION: Updates an existing issue with new values.

REQUEST BODY (JSON):
{
    "issueId": "ISSUE_1",                    // Required: Issue ID to update
    "status": "in progress",                 // Optional: New status
    "priority": "high",                      // Optional: New priority
    "resolution": "Fixed by updating...",    // Optional: Resolution description
    "raNotes": ["Note 1", "Note 2"],        // Optional: Array of RA notes
    "raName": "Akshat"                       // Optional: RA name for notes
}

RESPONSE (Success - 200):
{
    "message": "Issue updated successfully",
    "issueId": "ISSUE_1",
    "updatedFields": ["status", "priority", "resolution", "notes"],
    "timestamp": "2024-01-01T10:00:00"
}

RESPONSE (Error - 400):
{
    "error": "issueId is required",
    "message": "Please provide issueId in the request body"
}

RESPONSE (Error - 404):
{
    "error": "Issue not found",
    "message": "Issue with ID ISSUE_1 does not exist"
}

RESPONSE (Error - 500):
{
    "error": "Failed to update issue",
    "details": "Error details here",
    "timestamp": "2024-01-01T10:00:00"
}

FEATURES:
- Updates only provided fields (partial updates supported)
- Validates issue existence before updating
- Converts raNotes array to internal notes dictionary
- Updates assignee if raName is provided
- Returns list of updated fields
- Comprehensive error handling

CURL EXAMPLE:
curl -X POST http://localhost:5050/api/issues/update \\
  -H "Content-Type: application/json" \\
  -d '{
    "issueId": "ISSUE_1",
    "status": "in progress",
    "priority": "high",
    "resolution": "Fixed by updating configuration",
    "raNotes": ["Note 1", "Note 2"],
    "raName": "Akshat"
  }'
""")

if __name__ == "__main__":
    print("Testing update issue API endpoint...")
    print("Make sure the Flask app is running on http://localhost:5050")
    
    try:
        # Test if server is running
        response = requests.get(f"{BASE_URL}/api/nl/database-stats", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running!")
            test_update_issue_api()
            show_api_documentation()
        else:
            print("❌ Server responded with error")
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Please start the Flask app first:")
        print("   cd dashboards_backend")
        print("   python app.py")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("UPDATE ISSUE API TEST COMPLETED")
    print("=" * 60)
