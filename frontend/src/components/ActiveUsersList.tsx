// Component to display list of active users in a shared dashboard
import React, { useEffect, useState } from 'react';
import { collaborationClient, type ActiveUser } from '@/utils/collaborationClient';
import { motion, AnimatePresence } from 'framer-motion';

interface ActiveUsersListProps {
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
    hash = userUsername.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function ActiveUsersList({
  dashboardId,
  currentUsername
}: ActiveUsersListProps) {
  const [activeUsers, setActiveUsers] = useState<Map<string, ActiveUser>>(new Map());
  const [isOpen, setIsOpen] = useState(true);

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
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: isOpen ? 0 : -280 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed left-0 top-20 bottom-4 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg rounded-r-lg overflow-hidden"
      style={{ width: '280px' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Active Users ({allUsers.length})
          </h3>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${isOpen ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* User List */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <AnimatePresence>
          {allUsers.map((user) => {
            const isCurrentUser = user.username === currentUsername;
            
            return (
              <motion.div
                key={user.username}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className={`p-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 ${
                  isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                } transition-colors`}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-md flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                  style={{
                    backgroundColor: user.color,
                  }}
                >
                  {getInitials(user.username)}
                </div>
                
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                      {user.username}
                    </p>
                    {isCurrentUser && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        (You)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isCurrentUser ? 'Viewing' : 'Active'}
                  </p>
                </div>
                
                {/* Status indicator */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: user.color,
                    boxShadow: `0 0 8px ${user.color}40`,
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

