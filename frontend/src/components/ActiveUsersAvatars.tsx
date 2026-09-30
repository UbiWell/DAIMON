// Compact component to display active user avatars next to zoom controls
import React, { useEffect, useState } from 'react';
import { collaborationClient, type ActiveUser } from '@/utils/collaborationClient';
import { motion, AnimatePresence } from 'framer-motion';

interface ActiveUsersAvatarsProps {
  dashboardId: string | null;
  currentUsername: string | null;
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

export default function ActiveUsersAvatars({
  dashboardId,
  currentUsername
}: ActiveUsersAvatarsProps) {
  const [activeUsers, setActiveUsers] = useState<Map<string, ActiveUser>>(new Map());

  useEffect(() => {
    if (!dashboardId || !currentUsername) {
      return;
    }

    const handleUserJoined = (data: { username: string; active_users: string[] }) => {
      setActiveUsers(prev => {
        const newMap = new Map(prev);
        // Add all active users
        data.active_users.forEach(user => {
          if (!newMap.has(user)) {
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
      setActiveUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.username);
        return newMap;
      });
    };

    const handleActiveUsers = (data: { users: string[]; cursors: Record<string, { x: number; y: number }> }) => {
      setActiveUsers(prev => {
        const newMap = new Map(prev);
        data.users.forEach(user => {
          newMap.set(user, {
            username: user,
            cursor: data.cursors[user] || { x: 0, y: 0 },
            color: getUserColor(user)
          });
        });
        return newMap;
      });
    };

    collaborationClient.on('user_joined', handleUserJoined);
    collaborationClient.on('user_left', handleUserLeft);
    collaborationClient.on('active_users', handleActiveUsers);

    return () => {
      collaborationClient.off('user_joined', handleUserJoined);
      collaborationClient.off('user_left', handleUserLeft);
      collaborationClient.off('active_users', handleActiveUsers);
    };
  }, [dashboardId, currentUsername]);

  // Include current user in the list
  const allUsers = Array.from(activeUsers.values());
  if (currentUsername && !allUsers.find(u => u.username === currentUsername)) {
    allUsers.push({
      username: currentUsername,
      cursor: { x: 0, y: 0 },
      color: getUserColor(currentUsername)
    });
  }

  if (allUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 ml-2">
      <AnimatePresence>
        {allUsers.map((user) => {
          const isCurrentUser = user.username === currentUsername;
          
          return (
            <motion.div
              key={user.username}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="relative group"
              title={isCurrentUser ? `${user.username} (You)` : user.username}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-white font-semibold text-xs shadow-sm transition-all ${
                  isCurrentUser 
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' 
                    : 'border-white dark:border-gray-800 hover:scale-110'
                }`}
                style={{
                  backgroundColor: user.color,
                }}
              >
                {getInitials(user.username)}
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {user.username}
                {isCurrentUser && ' (You)'}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

