#!/usr/bin/env python3
"""
Quick test to verify the update route is available.
"""

import requests
import json

def test_route_availability():
    """Test if the update route is available."""
    try:
        # Test with a simple request to see if route exists
        response = requests.post("http://localhost:5050/api/issues/update", 
                               json={"issueId": "test"}, 
                               timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 404:
            print("❌ Route not found - Flask app needs restart")
        elif response.status_code == 400:
            print("✅ Route found! (400 is expected for invalid data)")
        else:
            print(f"✅ Route found! Status: {response.status_code}")
            
        print(f"Response: {response.text}")
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to Flask app - is it running?")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing if /api/issues/update route is available...")
    test_route_availability()
