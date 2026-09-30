// Socket.IO client for collaborative dashboard features
import { io, Socket } from 'socket.io-client';
import API_BASE_URL from '@/config/api';

export interface CursorPosition {
  x: number;
  y: number;
}

export interface ActiveUser {
  username: string;
  cursor: CursorPosition;
  color?: string;
}

export type CollaborationEventHandler = (data: any) => void;

class CollaborationClient {
  private socket: Socket | null = null;
  private dashboardId: string | null = null;
  private username: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, CollaborationEventHandler[]> = new Map();
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  // Generate Socket.IO URL from API base URL
  private getSocketUrl(): string {
    // Socket.IO runs on the same server as Flask
    // Always use same origin for Socket.IO to avoid port mismatches
    
    if (typeof window !== 'undefined') {
      // Always use the current page's origin for Socket.IO
      // This ensures Socket.IO connects to the same server that served the page
      const origin = window.location.origin;
      console.log('[Socket.IO] Using current origin:', origin);
      return origin;
    }
    
    // Fallback: use API_BASE_URL if window is not available (SSR)
    if (API_BASE_URL && API_BASE_URL.length > 0 && API_BASE_URL.startsWith('http')) {
      console.log('[Socket.IO] Using API_BASE_URL (fallback):', API_BASE_URL);
      return API_BASE_URL;
    }
    
    // Last resort: empty string (Socket.IO will try to infer)
    console.log('[Socket.IO] Using empty string (Socket.IO will infer)');
    return '';
  }

  // Generate a color for a user based on their username
  // Expanded palette with more distinct colors for better user differentiation
  private getUserColor(username: string): string {
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
      '#F97316', // orange
      '#14B8A6', // teal
      '#84CC16', // lime
      '#A855F7', // violet
      '#F43F5E', // rose
      '#0EA5E9', // sky
      '#6366F1', // indigo
      '#22C55E', // emerald
      '#EAB308', // yellow
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      const char = username.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // Connect to Socket.IO server
  connect(dashboardId: string, username: string): Promise<void> {
    // If already connected to the same dashboard, resolve immediately
    if (this.socket?.connected && this.dashboardId === dashboardId && this.username === username) {
      return Promise.resolve();
    }

    // If connection is in progress, wait for it to complete
    if (this.isConnecting && this.connectionPromise) {
      // If connecting to the same dashboard, return the existing promise
      if (this.dashboardId === dashboardId && this.username === username) {
        return this.connectionPromise;
      }
      // Otherwise, wait for current connection to finish, then connect to new dashboard
      return this.connectionPromise
        .then(() => {
          return this.connect(dashboardId, username);
        })
        .catch(() => {
          // If current connection failed, try connecting to new dashboard anyway
          return this.connect(dashboardId, username);
        });
    }

    // Start new connection
    this.isConnecting = true;
    this.dashboardId = dashboardId;
    this.username = username;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Disconnect existing socket if different dashboard
        if (this.socket && this.socket.connected) {
          if (this.dashboardId !== dashboardId || this.username !== username) {
            this.socket.disconnect();
          }
        }

        const socketUrl = this.getSocketUrl();
        // Log what we're connecting to
        const effectiveUrl = socketUrl || window.location.origin;
        console.log(`[Socket.IO] Connecting to: ${effectiveUrl}`);
        console.log(`[Socket.IO] Full path will be: ${effectiveUrl}/socket.io/`);
        console.log(`[Socket.IO] Current page origin: ${window.location.origin}`);
        console.log(`[Socket.IO] API_BASE_URL: ${API_BASE_URL}`);
        
        // Socket.IO automatically appends /socket.io/ to the base URL
        // If socketUrl is empty string, Socket.IO uses current origin
        this.socket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          // Explicitly set path (Socket.IO default is /socket.io/)
          path: '/socket.io/',
          // Force autoConnect to see connection attempts
          autoConnect: true,
        });

        let connectionResolved = false;

        this.socket.on('connect', () => {
          console.log('Socket.IO connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Join the dashboard room
          this.socket?.emit('join_dashboard', {
            dashboard_id: dashboardId,
            username: username
          });
          
          // Only resolve once on initial connection
          if (!connectionResolved) {
            connectionResolved = true;
            resolve();
          }
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket.IO disconnected:', reason);
          this.isConnecting = false;
          
          // Don't clear connectionPromise on disconnect - let Socket.IO handle reconnection
          // Only clear if it's a manual disconnect or server shutdown
          if (reason === 'io server disconnect' || reason === 'io client disconnect') {
            this.connectionPromise = null;
          }
        });

        this.socket.on('connect_error', (error) => {
          console.warn('Socket.IO connection error (will retry):', error.message || error);
          // Don't reject immediately - let Socket.IO retry automatically
          // Socket.IO will handle reconnection attempts
        });

        this.socket.on('reconnect_failed', () => {
          console.error('Socket.IO reconnection failed after all attempts');
          this.isConnecting = false;
          this.connectionPromise = null;
          if (!connectionResolved) {
            connectionResolved = true;
            reject(new Error('Failed to connect after all retry attempts'));
          }
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`Socket.IO reconnected after ${attemptNumber} attempts`);
          // Rejoin the dashboard room after reconnection
          if (this.dashboardId && this.username) {
            this.socket?.emit('join_dashboard', {
              dashboard_id: this.dashboardId,
              username: this.username
            });
          }
        });

        // Set up event handlers for collaboration events
        this.socket.on('user_joined', (data) => {
          this.handleMessage({ event: 'user_joined', data });
        });

        this.socket.on('user_left', (data) => {
          this.handleMessage({ event: 'user_left', data });
        });

        this.socket.on('cursor_update', (data) => {
          this.handleMessage({ event: 'cursor_update', data });
        });

        this.socket.on('active_users', (data) => {
          this.handleMessage({ event: 'active_users', data });
        });

        this.socket.on('connected', (data) => {
          this.handleMessage({ event: 'connected', data });
        });

        this.socket.on('error', (data) => {
          this.handleMessage({ event: 'error', data });
        });

        this.socket.on('dashboard_change', (data) => {
          this.handleMessage({ event: 'dashboard_change', data });
        });

        this.socket.on('dashboard_state', (data) => {
          this.handleMessage({ event: 'dashboard_state', data });
        });

      } catch (error) {
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(error);
      }
    });

    // Ensure we always return a Promise
    return this.connectionPromise || Promise.reject(new Error('Failed to create connection promise'));
  }

  // Disconnect from Socket.IO server
  disconnect(): void {
    if (this.socket) {
      if (this.dashboardId && this.username) {
        this.socket.emit('leave_dashboard', {
          dashboard_id: this.dashboardId,
          username: this.username
        });
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.dashboardId = null;
    this.username = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.connectionPromise = null;
  }

  // Send message to server
  send(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket.IO not connected, cannot send message:', event);
    }
  }

  // Update cursor position
  updateCursor(cursor: CursorPosition): void {
    if (this.dashboardId && this.username && this.socket?.connected) {
      this.send('cursor_move', {
        dashboard_id: this.dashboardId,
        username: this.username,
        cursor
      });
    }
  }

  // Handle incoming messages
  private handleMessage(data: { event: string; data: any }): void {
    const event = data.event;
    const payload = data.data;

    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  // Register event handler
  on(event: string, handler: CollaborationEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  // Remove event handler
  off(event: string, handler: CollaborationEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Singleton instance
export const collaborationClient = new CollaborationClient();
