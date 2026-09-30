# Gunicorn configuration for Flask-SocketIO
# Use this with: gunicorn --config gunicorn_config.py wsgi:application

# Server socket
# Note: bind address is set by systemd service (--bind unix:/var/sockets/gloss.sock)
# If running manually without systemd, uncomment and set bind address:
# bind = "0.0.0.0:8000"
backlog = 2048

# Worker processes
# For Flask-SocketIO, you MUST use eventlet or gevent workers
workers = 4
worker_class = "eventlet"  # or "gevent" - both work with Flask-SocketIO
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "gloss"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (if needed)
# keyfile = None
# certfile = None

