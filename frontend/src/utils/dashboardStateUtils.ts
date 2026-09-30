// Utility functions for managing user-specific dashboard state persistence

import API_BASE_URL from '@/config/api';

export interface DashboardState {
  panOffset: { x: number; y: number };
  zoom: number;
  currentPageId: number;
  lastUpdated: number;
}

export interface DashboardFullState {
  pages?: any[];
  panOffset?: { x: number; y: number };
  zoom?: number;
  currentPageId?: number;
  idCounters?: { view: number; page: number };
  lastUpdated?: number;
}

const DASHBOARD_STATE_KEY_PREFIX = 'dashboard_state_';
const DASHBOARD_PAGES_KEY_PREFIX = 'dashboard_pages_';
const ID_COUNTER_KEY_PREFIX = 'dashboard_id_counter_';

/**
 * Get the storage key for a specific user's dashboard state
 */
export const getUserDashboardStateKey = (username: string): string => {
  return `${DASHBOARD_STATE_KEY_PREFIX}${username}`;
};

/**
 * Save dashboard state to backend API (with localStorage fallback)
 */
export const saveDashboardStateToServer = async (
  username: string, 
  state: Partial<DashboardState>
): Promise<boolean> => {
  if (!username) return false;
  
  try {
    // Use relative URL if API_BASE_URL is empty (same origin), otherwise use full URL
    const url = API_BASE_URL && API_BASE_URL.length > 0
      ? `${API_BASE_URL}/api/dashboard/state`
      : '/api/dashboard/state';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        state: {
          ...state,
          lastUpdated: Date.now()
        }
      })
    });
    
    if (response.ok) {
      console.log(`Dashboard state saved to server for user ${username}`);
      return true;
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`Failed to save dashboard state to server (${response.status}): ${errorText}`);
      return false;
    }
  } catch (error) {
    // Network error or server not reachable - this is expected if server is down
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn(`Cannot reach server at ${API_BASE_URL} - state saved to localStorage only`);
    } else {
      console.warn('Error saving dashboard state to server:', error);
    }
    return false;
  }
};

/**
 * Save dashboard state for a specific user (localStorage + server)
 */
export const saveDashboardState = async (
  username: string, 
  state: Partial<DashboardState>
): Promise<void> => {
  if (!username) return;
  
  const key = getUserDashboardStateKey(username);
  // Use sync version for immediate localStorage access
  const currentState = loadDashboardStateSync(username);
  
  const newState: DashboardState = {
    ...currentState,
    ...state,
    lastUpdated: Date.now()
  };
  
  // Save to localStorage immediately
  try {
    localStorage.setItem(key, JSON.stringify(newState));
    console.log(`Dashboard state saved locally for user ${username}:`, newState);
  } catch (error) {
    console.error('Failed to save dashboard state to localStorage:', error);
  }
  
  // Also try to save to server (non-blocking)
  saveDashboardStateToServer(username, state).catch(err => {
    console.warn('Background save to server failed:', err);
  });
};

/**
 * Load dashboard state from server API
 */
export const loadDashboardStateFromServer = async (
  username: string
): Promise<DashboardState | null> => {
  if (!username) return null;
  
  try {
    // Use relative URL if API_BASE_URL is empty (same origin), otherwise use full URL
    const url = API_BASE_URL && API_BASE_URL.length > 0
      ? `${API_BASE_URL}/api/dashboard/state?username=${encodeURIComponent(username)}`
      : `/api/dashboard/state?username=${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.state) {
        console.log(`Dashboard state loaded from server for user ${username}`);
        return {
          ...getDefaultDashboardState(),
          ...data.state
        };
      }
    } else if (response.status === 404) {
      // No state found on server - this is OK, will use localStorage
      console.log(`No dashboard state found on server for user ${username}`);
    } else {
      console.warn(`Server returned error ${response.status} when loading dashboard state`);
    }
  } catch (error) {
    // Network error or server not reachable - this is expected if server is down
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn(`Cannot reach server at ${API_BASE_URL} - using localStorage fallback`);
    } else {
      console.warn('Error loading dashboard state from server:', error);
    }
  }
  
  return null;
};

/**
 * Load dashboard state from localStorage (synchronous, for immediate use)
 */
export const loadDashboardStateSync = (username: string): DashboardState => {
  if (!username) {
    return getDefaultDashboardState();
  }
  
  const key = getUserDashboardStateKey(username);
  
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...getDefaultDashboardState(),
        ...parsed
      };
    }
  } catch (error) {
    console.error('Failed to load dashboard state from localStorage:', error);
  }
  
  return getDefaultDashboardState();
};

/**
 * Load dashboard state for a specific user (server first, then localStorage)
 */
export const loadDashboardState = async (username: string): Promise<DashboardState> => {
  if (!username) {
    return getDefaultDashboardState();
  }
  
  // Try to load from server first
  const serverState = await loadDashboardStateFromServer(username);
  if (serverState) {
    // Also sync to localStorage for offline access
    const key = getUserDashboardStateKey(username);
    try {
      localStorage.setItem(key, JSON.stringify(serverState));
    } catch (error) {
      console.warn('Failed to sync server state to localStorage:', error);
    }
    return serverState;
  }
  
  // Fallback to localStorage
  return loadDashboardStateSync(username);
};

/**
 * Get default dashboard state
 */
export const getDefaultDashboardState = (): DashboardState => {
  return {
    panOffset: { x: 0, y: 0 },
    zoom: 1,
    currentPageId: 1,
    lastUpdated: Date.now()
  };
};

/**
 * Clear dashboard state for a specific user
 */
export const clearDashboardState = (username: string): void => {
  if (!username) return;
  
  const key = getUserDashboardStateKey(username);
  localStorage.removeItem(key);
  console.log(`Dashboard state cleared for user ${username}`);
};

/**
 * Get all users with saved dashboard states
 */
export const getAllUsersWithDashboardState = (): string[] => {
  const users: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DASHBOARD_STATE_KEY_PREFIX)) {
      const username = key.replace(DASHBOARD_STATE_KEY_PREFIX, '');
      users.push(username);
    }
  }
  
  return users;
};

/**
 * Save full dashboard state (pages + state) to server
 */
export const saveFullDashboardStateToServer = async (
  username: string,
  fullState: DashboardFullState
): Promise<boolean> => {
  if (!username) return false;
  
  try {
    // Use relative URL if API_BASE_URL is empty (same origin), otherwise use full URL
    const url = API_BASE_URL && API_BASE_URL.length > 0
      ? `${API_BASE_URL}/api/dashboard/full-state`
      : '/api/dashboard/full-state';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        ...fullState,
        lastUpdated: Date.now()
      })
    });
    
    if (response.ok) {
      console.log(`Full dashboard state saved to server for user ${username}`);
      return true;
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`Failed to save full dashboard state to server (${response.status}): ${errorText}`);
      return false;
    }
  } catch (error) {
    // Network error or server not reachable - this is expected if server is down
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn(`Cannot reach server at ${API_BASE_URL} - full state saved to localStorage only`);
    } else {
      console.warn('Error saving full dashboard state to server:', error);
    }
    return false;
  }
};

/**
 * Load full dashboard state (pages + state) from server
 */
export const loadFullDashboardStateFromServer = async (
  username: string
): Promise<DashboardFullState | null> => {
  if (!username) return null;
  
  try {
    // Use relative URL if API_BASE_URL is empty (same origin), otherwise use full URL
    const url = API_BASE_URL && API_BASE_URL.length > 0
      ? `${API_BASE_URL}/api/dashboard/full-state?username=${encodeURIComponent(username)}`
      : `/api/dashboard/full-state?username=${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // Check if we have any state data (pages, panOffset, zoom, etc.)
      if (data.success === false) {
        // No state found
        console.log(`No full dashboard state found on server for user ${username}`);
        return null;
      }
      // Check for pages or other state fields
      if (data.pages || data.panOffset || data.zoom || data.state) {
        console.log(`Full dashboard state loaded from server for user ${username}:`, {
          hasPages: !!data.pages,
          pagesCount: data.pages ? data.pages.length : 0,
          hasPanOffset: !!data.panOffset,
          hasZoom: !!data.zoom
        });
        return data;
      }
      // If response is OK but no data, return null
      console.log(`Server returned OK but no state data for user ${username}`);
      return null;
    } else if (response.status === 404) {
      // No state found on server - this is OK, will use localStorage
      console.log(`No full dashboard state found on server for user ${username}`);
    } else {
      console.warn(`Server returned error ${response.status} when loading full dashboard state`);
    }
  } catch (error) {
    // Network error or server not reachable - this is expected if server is down
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn(`Cannot reach server at ${API_BASE_URL} - using localStorage fallback`);
    } else {
      console.warn('Error loading full dashboard state from server:', error);
    }
  }
  
  return null;
};

/**
 * Debounced save function to avoid excessive writes
 */
export const createDebouncedSave = (username: string, delay: number = 500) => {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (state: Partial<DashboardState>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      saveDashboardState(username, state);
      timeoutId = null;
    }, delay);
  };
};
