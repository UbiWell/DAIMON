#!/usr/bin/env python3
"""
Test script to verify that issues are being saved to CSV database.
"""

import sys
import os
import requests
import json

# Add the current directory to Python path
sys.path.append(os.path.dirname(__file__))

def test_csv_creation():
    """Test that issues are created and saved to CSV."""
    print("=" * 60)
    print("TESTING CSV DATABASE CREATION")
    print("=" * 60)
    
    # Check if CSV file exists before creating issue
    csv_path = os.path.join(os.path.dirname(__file__), "issue_tracker", "issues.csv")
    print(f"1. Checking CSV file before creation: {csv_path}")
    if os.path.exists(csv_path):
        print("   ✅ CSV file already exists")
        with open(csv_path, 'r') as f:
            content = f.read()
            print(f"   Current content length: {len(content)} characters")
    else:
        print("   ❌ CSV file does not exist yet")
    
    # Create an issue via API
    print("\n2. Creating an issue via API...")
    create_data = {
        "userId": "test004",
        "reason": "Test CSV database creation",
        "potentialPastIssues": [],
        "color": "green",
        "raName": "TestRA"
    }
    
    try:
        response = requests.post("http://localhost:5050/api/issues/create", json=create_data)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            issue_id = result.get("issueID")
            print(f"   ✅ Issue created successfully: {issue_id}")
        else:
            print(f"   ❌ Failed to create issue: {response.text}")
            return
            
    except Exception as e:
        print(f"   Error creating issue: {e}")
        return
    
    # Check if CSV file exists after creating issue
    print(f"\n3. Checking CSV file after creation...")
    if os.path.exists(csv_path):
        print("   ✅ CSV file now exists!")
        with open(csv_path, 'r') as f:
            content = f.read()
            print(f"   Content length: {len(content)} characters")
            print(f"   Content preview:")
            print("   " + "-" * 40)
            lines = content.split('\n')
            for i, line in enumerate(lines[:5]):  # Show first 5 lines
                if line.strip():
                    print(f"   {i+1}: {line}")
            if len(lines) > 5:
                print(f"   ... and {len(lines) - 5} more lines")
            print("   " + "-" * 40)
    else:
        print("   ❌ CSV file still does not exist")
    
    # Check issue counter file
    counter_path = os.path.join(os.path.dirname(__file__), "issue_tracker", "issue_counter.txt")
    print(f"\n4. Checking issue counter file: {counter_path}")
    if os.path.exists(counter_path):
        print("   ✅ Issue counter file exists!")
        with open(counter_path, 'r') as f:
            counter = f.read().strip()
            print(f"   Current counter: {counter}")
    else:
        print("   ❌ Issue counter file does not exist")
    
    # Test direct database access
    print(f"\n5. Testing direct database access...")
    try:
        from issue_tracker.issue_tracker_database import get_issue, search_issues
        
        # Try to get the issue we just created
        retrieved_issue = get_issue(issue_id)
        if retrieved_issue:
            print(f"   ✅ Issue retrieved from database: {retrieved_issue.get_summary()}")
            print(f"   Status: {retrieved_issue.get_status()}")
            print(f"   Priority: {retrieved_issue.get_priority()}")
            print(f"   Assignee: {retrieved_issue.get_assignee()}")
        else:
            print(f"   ❌ Could not retrieve issue from database")
        
        # Search for all issues
        all_issues = search_issues()
        print(f"   Total issues in database: {len(all_issues)}")
        
    except Exception as e:
        print(f"   Error accessing database: {e}")

if __name__ == "__main__":
    print("Testing CSV database creation for issues...")
    print("Make sure the Flask app is running on http://localhost:5050")
    
    try:
        # Test if server is running
        response = requests.get("http://localhost:5050/api/nl/database-stats", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running!")
            test_csv_creation()
        else:
            print("❌ Server responded with error")
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Please start the Flask app first:")
        print("   cd dashboards_backend")
        print("   python app.py")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("CSV DATABASE TEST COMPLETED")
    print("=" * 60)

