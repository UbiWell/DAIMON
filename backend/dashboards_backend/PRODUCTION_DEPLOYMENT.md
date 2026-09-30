# Production Deployment Guide for Flask-SocketIO

## Overview

For production deployment with Flask-SocketIO, you need to use an async worker class with gunicorn. The `threading` async mode is fine for development but not recommended for production.

## Options

### Option 1: Gunicorn with Eventlet (Recommended)

**Pros:**
- Good performance
- Easy to set up
- Works well with Flask-SocketIO

**Requirements:**
```bash
pip install gunicorn eventlet
```

**Run:**
```bash
cd GLOSS/dashboards_backend
gunicorn --worker-class eventlet --workers 4 --bind 0.0.0.0:8000 wsgi:application
```

Or use the config file (recommended):
```bash
cd GLOSS/dashboards_backend
gunicorn --config gunicorn_config.py wsgi:application
```

**Note**: The config file is set to use port 8000. Gunicorn defaults to port 8000 if no bind address is specified.

### Option 2: Gunicorn with Gevent

**Pros:**
- Good performance
- Alternative to eventlet

**Requirements:**
```bash
pip install gunicorn gevent gevent-websocket
```

**Run:**
```bash
gunicorn --worker-class gevent --workers 4 --bind 0.0.0.0:5050 wsgi:application
```

### Option 3: uWSGI with Gevent Plugin

**Pros:**
- Very high performance
- More configuration options

**Requirements:**
```bash
pip install uwsgi gevent
```

**Run:**
```bash
uwsgi --http :5050 --gevent 1000 --http-websockets --master --wsgi-file wsgi.py --callable application
```

## Important Notes

1. **You MUST use async workers**: Flask-SocketIO requires eventlet, gevent, or threading. For production, use eventlet or gevent.

2. **Threading mode is NOT recommended for production**: The current `async_mode='threading'` works but doesn't scale well. It's fine for development.

3. **Auto-detection**: Flask-SocketIO will automatically detect eventlet or gevent if available, even if you specify `async_mode='threading'`.

4. **Worker count**: Start with 4 workers and adjust based on your load. Each worker can handle multiple Socket.IO connections.

5. **WebSocket support**: Both eventlet and gevent support WebSockets, which is required for Socket.IO.

## Recommended Production Setup

### 1. Update app.py (Optional - auto-detection works)

You can keep `async_mode='threading'` for development, and Flask-SocketIO will auto-detect eventlet/gevent in production when running with gunicorn.

Or explicitly set it:
```python
import eventlet
eventlet.monkey_patch()

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
```

### 2. Install Dependencies

```bash
pip install gunicorn eventlet
```

### 3. Run with Gunicorn

```bash
cd GLOSS/dashboards_backend
gunicorn --worker-class eventlet --workers 4 --bind 0.0.0.0:8000 wsgi:application
```

### 4. Using the Config File (Recommended)

```bash
cd GLOSS/dashboards_backend
gunicorn --config gunicorn_config.py wsgi:application
```

**Note**: If you get "Address already in use" error, check what's using port 8000:
```bash
# Find process using port 8000
lsof -i :8000
# Or
ss -tuln | grep :8000

# Kill the process if needed (replace PID with actual process ID)
kill -9 <PID>
```

## Systemd Service Example

Create `/etc/systemd/system/gloss-dashboard.service`:

```ini
[Unit]
Description=GLOSS Dashboard Gunicorn Application Server
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/GLOSS/dashboards_backend
Environment="PATH=/path/to/conda/env/bin"
ExecStart=/path/to/conda/env/bin/gunicorn --config gunicorn_config.py wsgi:application

Restart=always

[Install]
WantedBy=multi-user.target
```
[Service]
User=gloss
Group=www-data
WorkingDirectory=/path/to/GLOSS/dashboards_backend
Environment="PATH=/path/to/miniconda3/envs/gloss-sensemaking/bin"
Environment="TMPDIR=/path/to/tmp"
EnvironmentFile=/path/to/.env_vars

ExecStart=/path/to/miniconda3/envs/gloss-sensemaking/bin/gunicorn \
    --workers 3 \
    --timeout 300 \
    --graceful-timeout 300 \
    --bind unix:/var/sockets/gloss.sock \
    --umask 007 \
--config gunicorn_config.py\
    wsgi:app \
    --access-logfile /path/to/logs/access.log \
    --error-logfile /path/to/logs/error.log \
    --log-level info

[Install]
WantedBy=multi-user.target

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gloss-dashboard
sudo systemctl start gloss-dashboard
```

## Nginx Reverse Proxy Example

```nginx
upstream flask_socketio {
    server 127.0.0.1:5050;
}

server {
    listen 80;
    server_name your-domain.example.com;
    
    location / {
        proxy_pass http://flask_socketio;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_buffering off;
    }

    location /socket.io/ {
        proxy_pass http://flask_socketio;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_buffering off;
    }
}
```

## Testing

After deployment, test the Socket.IO connection:
1. Open browser console
2. Check for Socket.IO connection logs
3. Test dashboard sharing and cursor tracking

## Troubleshooting

- **Connection fails**: Check that gunicorn is using eventlet/gevent workers
- **WebSocket errors**: Ensure nginx/proxy is configured for WebSocket upgrade
- **Performance issues**: Increase worker count or adjust worker_connections

