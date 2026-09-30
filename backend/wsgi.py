"""
WSGI entry point for the dashboards Flask application.
This file is used for production deployment with WSGI servers like Gunicorn, uWSGI, etc.
"""

import sys
import os

# Add the parent directory to the Python path to ensure imports work correctly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the Flask application instance
from dashboards_backend.app import app

# This is the WSGI application object that WSGI servers will use
application = app

if __name__ == "__main__":
    # For development/testing, you can run this directly
    app.run(host='0.0.0.0', port=5050, debug=False)
