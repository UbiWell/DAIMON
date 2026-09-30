"""
Test script to demonstrate the view destruction API and updated NL interface endpoints
"""

import requests
import json
import time

# Base URL for the Flask app
BASE_URL = "http://localhost:5050"

def test_view_destroy_api():
    """Test the view destruction API endpoint."""
    print("=" * 60)
    print("TESTING VIEW DESTRUCTION API")
    print("=" * 60)
    
    view_id = "test_dashboard_view_001"
    
    print("1. Creating some test data for the view...")
    
    # Create some test data by making NL calls
    test_data = [
        {
            "query": "Show me user activity summary",
            "view_id": view_id,
            "refresh_interval": "2h",
            "is_redo": False
        },
        {
            "query": "Analyze user behavior patterns",
            "view_id": view_id,
            "refresh_interval": "1d",
            "is_redo": False
        }
    ]
    
    # Make some API calls to create data
    for data in test_data:
        try:
            response = requests.post(f"{BASE_URL}/api/nl/detect-mode", json=data)
            print(f"   Created mode detection for: {data['query']}")
        except Exception as e:
            print(f"   Error creating test data: {e}")
    
    print("\n2. Getting database statistics before destruction...")
    try:
        response = requests.get(f"{BASE_URL}/api/nl/database-stats")
        if response.status_code == 200:
            stats = response.json()
            print(f"   Total calls before: {stats['statistics']['total_calls']}")
        else:
            print(f"   Error getting stats: {response.status_code}")
    except Exception as e:
        print(f"   Error getting stats: {e}")
    
    print(f"\n3. Testing view destruction for view_id: {view_id}")
    
    # Test POST method
    print("   Testing POST method...")
    try:
        response = requests.post(f"{BASE_URL}/api/nl/destroy-view", json={"view_id": view_id})
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"   Error with POST method: {e}")
    
    print("\n4. Getting database statistics after destruction...")
    try:
        response = requests.get(f"{BASE_URL}/api/nl/database-stats")
        if response.status_code == 200:
            stats = response.json()
            print(f"   Total calls after: {stats['statistics']['total_calls']}")
        else:
            print(f"   Error getting stats: {response.status_code}")
    except Exception as e:
        print(f"   Error getting stats: {e}")
    
    print("\n5. Testing DELETE method...")
    # Create some more test data
    try:
        response = requests.post(f"{BASE_URL}/api/nl/detect-mode", json={
            "query": "Create a sales chart",
            "view_id": view_id,
            "refresh_interval": "6h",
            "is_redo": False
        })
        print(f"   Created more test data")
    except Exception as e:
        print(f"   Error creating test data: {e}")
    
    # Test DELETE method
    try:
        response = requests.delete(f"{BASE_URL}/api/nl/destroy-view?view_id={view_id}")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"   Error with DELETE method: {e}")
    
    print("\n6. Testing error handling...")
    
    # Test with missing view_id
    try:
        response = requests.post(f"{BASE_URL}/api/nl/destroy-view", json={})
        print(f"   Missing view_id - Status Code: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"   Error testing missing view_id: {e}")
    
    # Test with non-existent view_id
    try:
        response = requests.post(f"{BASE_URL}/api/nl/destroy-view", json={"view_id": "non_existent_view"})
        print(f"   Non-existent view_id - Status Code: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"   Error testing non-existent view_id: {e}")

def test_updated_nl_endpoints():
    """Test the updated NL endpoints with new parameters."""
    print("\n" + "=" * 60)
    print("TESTING UPDATED NL ENDPOINTS")
    print("=" * 60)
    
    view_id = "test_nl_endpoints_view"
    
    print("1. Testing detect-mode with new parameters...")
    
    # Test detect-mode with new parameters
    test_data = {
        "query": "Show me user activity summary",
        "view_id": view_id,
        "refresh_interval": "2h",
        "is_redo": False
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/nl/detect-mode", json=test_data)
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Detected mode: {result.get('mode', 'N/A')}")
    except Exception as e:
        print(f"   Error testing detect-mode: {e}")
    
    print("\n2. Testing summary with new parameters...")
    
    # Test summary with new parameters
    test_data = {
        "query": "Summarize the user activity data",
        "view_id": view_id,
        "is_redo": False
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/nl/summary", json=test_data)
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Summary result: {result.get('results', 'N/A')[:50]}...")
    except Exception as e:
        print(f"   Error testing summary: {e}")
    
    print("\n3. Testing redo functionality...")
    
    # Test redo functionality
    test_data_redo = {
        "query": "Summarize the user activity data",
        "view_id": view_id,
        "is_redo": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/nl/summary", json=test_data_redo)
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Cached summary: {result.get('results', 'N/A')[:50]}...")
    except Exception as e:
        print(f"   Error testing redo: {e}")
    
    print("\n4. Testing GET method with query parameters...")
    
    # Test GET method with query parameters
    try:
        response = requests.get(f"{BASE_URL}/api/nl/detect-mode?query=Create%20a%20chart&view_id={view_id}&refresh_interval=1d&is_redo=false")
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        print(f"   Detected mode: {result.get('mode', 'N/A')}")
    except Exception as e:
        print(f"   Error testing GET method: {e}")
    
    print("\n5. Testing database statistics...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/nl/database-stats")
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        stats = result.get('statistics', {})
        print(f"   Total calls: {stats.get('total_calls', 'N/A')}")
        print(f"   Mode breakdown: {stats.get('mode_breakdown', {})}")
    except Exception as e:
        print(f"   Error testing database stats: {e}")
    
    print("\n6. Cleaning up test data...")
    
    # Clean up test data
    try:
        response = requests.post(f"{BASE_URL}/api/nl/destroy-view", json={"view_id": view_id})
        print(f"   Cleanup Status Code: {response.status_code}")
        print(f"   Cleanup Response: {response.json().get('message', 'N/A')}")
    except Exception as e:
        print(f"   Error cleaning up: {e}")

def test_api_documentation():
    """Test and display API documentation."""
    print("\n" + "=" * 60)
    print("API DOCUMENTATION")
    print("=" * 60)
    
    print("""
NEW API ENDPOINTS:

1. DESTROY VIEW API:
   POST /api/nl/destroy-view
   DELETE /api/nl/destroy-view?view_id=<view_id>
   
   JSON Body (POST):
   {
       "view_id": "dashboard_view_001"
   }
   
   Response:
   {
       "success": true,
       "message": "Successfully destroyed view 'dashboard_view_001' and removed all associated data",
       "view_id": "dashboard_view_001",
       "timestamp": "2024-01-01T10:00:00"
   }

2. DATABASE STATISTICS API:
   GET /api/nl/database-stats
   
   Response:
   {
       "success": true,
       "statistics": {
           "total_calls": 10,
           "mode_breakdown": {"summary": 5, "analysis": 3, "graph": 2},
           "refresh_interval_breakdown": {"2h": 4, "1d": 3, "none": 3},
           "redo_breakdown": {"true": 2, "false": 8}
       },
       "timestamp": "2024-01-01T10:00:00"
   }

UPDATED NL ENDPOINTS:

All existing NL endpoints now support additional parameters:

POST /api/nl/summary
POST /api/nl/analysis  
POST /api/nl/suggestions
POST /api/nl/plotting
POST /api/nl/datasubsets
POST /api/nl/detect-mode

JSON Body:
{
    "query": "Your query here",
    "view_id": "dashboard_view_001",     // Optional, defaults to "default"
    "refresh_interval": "2h",            // Optional, defaults to "none"
    "is_redo": false                     // Optional, defaults to false
}

GET methods also support query parameters:
/api/nl/summary?query=test&view_id=view1&refresh_interval=1d&is_redo=true
""")

if __name__ == "__main__":
    print("Starting API tests...")
    print("Make sure the Flask app is running on http://localhost:5050")
    print("You can start it with: python dashboards_backend/app.py")
    
    try:
        # Test if server is running
        response = requests.get(f"{BASE_URL}/api/nl/database-stats", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running!")
            test_view_destroy_api()
            test_updated_nl_endpoints()
            test_api_documentation()
        else:
            print("❌ Server responded with error")
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Please start the Flask app first:")
        print("   cd dashboards_backend")
        print("   python app.py")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("API TESTING COMPLETED")
    print("=" * 60)
