// Component to display other users' cursors on the dashboard
import React, { useEffect, useState, useRef } from 'react';
import { collaborationClient, type ActiveUser } from '@/utils/collaborationClient';
import { motion, AnimatePresence } from 'framer-motion';

interface CollaborativeCursorsProps {
  dashboardId: string | null;
  username: string | null;
  panOffset: { x: number; y: number };
  zoom: number;
  canvasRef: React.RefObject<HTMLDivElement>;
}

// Generate avatar initials from username
const getInitials = (username: string): string => {
  const parts = username.split(/[\s_-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
};

// Generate colors for users (consistent with backend)
// Expanded palette with more distinct colors for better user differentiation
const getUserColor = (userUsername: string): string => {
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
  for (let i = 0; i < userUsername.length; i++) {
    const char = userUsername.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function CollaborativeCursors({
  dashboardId,
  username,
  panOffset,
  zoom,
  canvasRef
}: CollaborativeCursorsProps) {
  const [activeUsers, setActiveUsers] = useState<Map<string, ActiveUser>>(new Map());
  const cursorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCursorPositions = useRef<Map<string, { x: number; y: number; timestamp: number }>>(new Map());

  // Set up WebSocket event handlers
  useEffect(() => {
    if (!dashboardId || !username) {
      return;
    }

    const handleUserJoined = (data: { username: string; active_users: string[] }) => {
      console.log('User joined:', data);
      setActiveUsers(prev => {
        const newMap = new Map(prev);
        // Add all active users (except self)
        data.active_users.forEach(user => {
          if (user !== username && !newMap.has(user)) {
            newMap.set(user, {
              username: user,
              cursor: { x: 0, y: 0 },
              color: getUserColor(user)
            });
          }
        });
        return newMap;
      });
    };

    const handleUserLeft = (data: { username: string }) => {
      console.log('User left:', data);
      setActiveUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.username);
        return newMap;
      });
    };

    const handleCursorUpdate = (data: { username: string; cursor: { x: number; y: number } }) => {
      if (data.username === username) return; // Don't update own cursor
      
      // Update last cursor position timestamp
      lastCursorPositions.current.set(data.username, {
        x: data.cursor.x,
        y: data.cursor.y,
        timestamp: Date.now()
      });
      
      setActiveUsers(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(data.username);
        if (existing) {
          newMap.set(data.username, {
            ...existing,
            cursor: data.cursor
          });
        } else {
          newMap.set(data.username, {
            username: data.username,
            cursor: data.cursor,
            color: getUserColor(data.username)
          });
        }
        return newMap;
      });
    };

    const handleActiveUsers = (data: { users: string[]; cursors: Record<string, { x: number; y: number }> }) => {
      setActiveUsers(prev => {
        const newMap = new Map(prev);
        data.users.forEach(user => {
          if (user !== username) {
            newMap.set(user, {
              username: user,
              cursor: data.cursors[user] || { x: 0, y: 0 },
              color: getUserColor(user)
            });
          }
        });
        return newMap;
      });
    };

    collaborationClient.on('user_joined', handleUserJoined);
    collaborationClient.on('user_left', handleUserLeft);
    collaborationClient.on('cursor_update', handleCursorUpdate);
    collaborationClient.on('active_users', handleActiveUsers);

    return () => {
      collaborationClient.off('user_joined', handleUserJoined);
      collaborationClient.off('user_left', handleUserLeft);
      collaborationClient.off('cursor_update', handleCursorUpdate);
      collaborationClient.off('active_users', handleActiveUsers);
    };
  }, [dashboardId, username]);

  // Track mouse movement and send cursor updates
  useEffect(() => {
    if (!dashboardId || !username || !canvasRef.current) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Only send cursor updates if WebSocket is connected
      if (!collaborationClient.isConnected()) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert to world coordinates (accounting for pan and zoom)
      // The canvas is panned by panOffset, so we need to subtract it first
      const worldX = (mouseX - panOffset.x) / zoom;
      const worldY = (mouseY - panOffset.y) / zoom;

      // Throttle cursor updates (every 50ms)
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current);
      }

      cursorUpdateTimeoutRef.current = setTimeout(() => {
        collaborationClient.updateCursor({ x: worldX, y: worldY });
      }, 50);
    };

    const canvas = canvasRef.current;
    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current);
      }
    };
  }, [dashboardId, username, panOffset, zoom, canvasRef]);

  // Clean up inactive cursors (users who haven't moved in 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const inactiveThreshold = 5000; // 5 seconds
      
      setActiveUsers(prev => {
        const newMap = new Map(prev);
        let hasChanges = false;
        
        newMap.forEach((user, username) => {
          const lastPos = lastCursorPositions.current.get(username);
          if (lastPos && (now - lastPos.timestamp) > inactiveThreshold) {
            // User hasn't moved in a while, but keep them in the list
            // (they might still be viewing, just not moving cursor)
          }
        });
        
        return hasChanges ? newMap : prev;
      });
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Render other users' cursors
  if (activeUsers.size === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {Array.from(activeUsers.values()).map((user) => {
          // Convert world coordinates to screen coordinates
          const screenX = user.cursor.x * zoom + panOffset.x;
          const screenY = user.cursor.y * zoom + panOffset.y;
          
          // Check if cursor is visible on screen
          const isVisible = screenX >= -50 && screenX <= window.innerWidth + 50 &&
                           screenY >= -50 && screenY <= window.innerHeight + 50;

          if (!isVisible) return null;

          return (
            <motion.div
              key={user.username}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="absolute"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translate(-20px, -20px)',
              }}
            >
              {/* User avatar/mascot */}
              <div
                className="relative w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-semibold text-sm"
                style={{
                  backgroundColor: user.color,
                }}
              >
                {getInitials(user.username)}
              </div>
              
              {/* Cursor pointer */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                className="absolute top-6 left-6 drop-shadow-lg"
                style={{ color: user.color }}
              >
                <path
                  d="M3 3 L3 14 L7.5 9.5 L11.5 17.5 L15 16 L11.5 9.5 L15.5 9.5 Z"
                  fill={user.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
              
              {/* Username label */}
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-12 left-0 px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-md"
                style={{
                  backgroundColor: user.color,
                }}
              >
                {user.username}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

