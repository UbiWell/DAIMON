import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import FridgeNote from '@/pages/FridgeNote';
import DataTable from "@/pages/DataTable.tsx"
import NLInterface from "@/pages/NLInterface.tsx";
import LoginPage from '@/components/LoginPage';
import IssueSummary from '@/components/IssueSummary';
import IssuesLog from '@/components/IssuesLog';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { removeLocalStorageItem } from '@/utils/localStorageUtils';
import { 
  saveDashboardState, 
  loadDashboardState, 
  createDebouncedSave,
  type DashboardState 
} from '@/utils/dashboardStateUtils';
import { collaborationClient } from '@/utils/collaborationClient';
import CollaborativeCursors from '@/components/CollaborativeCursors';
import ActiveUsersAvatars from '@/components/ActiveUsersAvatars';
import API_BASE_URL from '@/config/api';

import {
  Plus, GripHorizontal, X, Maximize2,
  BarChart3, Activity, BrainCircuit, LineChart, Wand2, OctagonAlert, FileText,
  Home, ZoomIn, ZoomOut, Edit2, Check, X as XIcon, Share2, Copy, Info,
  Lock, Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil } from 'lucide-react';

const GRID_SIZE = 120;
const GRID_GAP = 12;
const CANVAS_SIZE = 100; // Large canvas size
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

export const viewTypes = [
  { 
    id: 'stickies', 
    title: 'Stickies', 
    icon: Activity, 
    color: 'bg-blue-500/10 text-blue-500 border-blue-200', 
    size: [3, 3], 
    minSize: [3, 3], 
    maxSize: [8, 12],
    description: 'Create and manage sticky notes for quick thoughts, reminders, and information capture.'
  },
  { 
    id: 'issue-summary', 
    title: 'Create Issues', 
    icon: OctagonAlert, 
    color: 'bg-purple-500/10 text-purple-500 border-purple-200', 
    size: [4, 4], 
    minSize: [3, 3], 
    maxSize: [16, 16],
    description: 'Create and manage issues with status, priority, and resolution details.'
  },
  { 
    id: 'issues-log', 
    title: 'Issues Log', 
    icon: FileText, 
    color: 'bg-indigo-500/10 text-indigo-500 border-indigo-200', 
    size: [6, 4], 
    minSize: [4, 3], 
    maxSize: [20, 16],
    description: 'Browse and search through a detailed log of all issues with filtering and sorting capabilities.'
  },
  { 
    id: 'data-table', 
    title: 'Data Table', 
    icon: BarChart3, 
    color: 'bg-pink-500/10 text-pink-500 border-pink-200', 
    size: [8, 6], 
    minSize: [4, 3], 
    maxSize: [20, 12],
    description: 'Display and analyze data in a tabular format with  issue flagging capabilities.'
  },
  { 
    id: 'nl-interface', 
    title: 'Natural Language Interface', 
    icon: MessageCircle, 
    color: 'bg-indigo-500/10 text-indigo-500 border-indigo-200', 
    size: [7, 5], 
    minSize: [3, 3], 
    maxSize: [20, 16],
    description: 'Interact with your data using natural language queries and commands powered by AI.'
  },
];

// Demo content components
const DemoContent = ({ type, view, updateView, raName, isResizing, resizingViewId }) => {
  if (type === 'stickies') return <FridgeNote view={view} />;
  if (type === 'issue-summary') return <IssueSummary view={view} updateView={updateView} raName={raName} />;
  if (type === 'issues-log') return <IssuesLog view={view} updateView={updateView} raName={raName} />;
  if (type === 'data-table') return <DataTable raName={raName} view={view} updateView={updateView} isResizing={isResizing} resizingViewId={resizingViewId} />;
  if (type === 'nl-interface') return <NLInterface view={view} updateView={updateView} raName={raName} isResizing={isResizing} resizingViewId={resizingViewId} />;

  const viewType = viewTypes.find(v => v.id === type) || viewTypes[0];
  const Icon = viewType.icon;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-2xl leading-relaxed">
      <Icon className="w-12 h-12 mb-4 opacity-70" />
      <p className="text-2xl text-muted-foreground">
        {viewType.title} data visualization would appear here
      </p>
    </div>
  );
};

const initialViews = [
  {
    id: 1,
    title: 'Welcome Note',
    type: 'stickies',
    x: 100,
    y: 100,
    width: 2,
    height: 3,
    lastSize: { height: 3, width: 2 }
  }
];

const initialPages = [
  {
    id: 1,
    name: 'Main Dashboard',
    views: initialViews
  }
];

const STORAGE_KEY_PREFIX = "dashboard_pages_";
const ID_COUNTER_KEY_PREFIX = "dashboard_id_counter_";
const AUTO_HEIGHT_VIEW_TYPES = new Set(['nl-interface', 'data-table']);

// Helper functions for user-specific storage
const getPagesStorageKey = (username: string) => `${STORAGE_KEY_PREFIX}${username}`;
const getIdCounterStorageKey = (username: string) => `${ID_COUNTER_KEY_PREFIX}${username}`;

const getInitialPages = (username?: string) => {
  if (!username) return initialPages;
  const storageKey = getPagesStorageKey(username);
  const savedPages = localStorage.getItem(storageKey);
  return savedPages ? JSON.parse(savedPages) : initialPages;
};

const getNextId = (type: 'view' | 'page', username?: string) => {
  if (!username) {
    // Fallback for when user is not logged in yet
    const counterKey = type === 'view' ? 'view' : 'page';
    const stored = localStorage.getItem(`${ID_COUNTER_KEY_PREFIX}default`);
    const counters = stored ? JSON.parse(stored) : { view: 0, page: 0 };
    counters[counterKey] = (counters[counterKey] || 0) + 1;
    localStorage.setItem(`${ID_COUNTER_KEY_PREFIX}default`, JSON.stringify(counters));
    return counters[counterKey];
  }
  
  const counterKey = type === 'view' ? 'view' : 'page';
  const storageKey = getIdCounterStorageKey(username);
  const stored = localStorage.getItem(storageKey);
  const counters = stored ? JSON.parse(stored) : { view: 0, page: 0 };
  
  counters[counterKey] = (counters[counterKey] || 0) + 1;
  localStorage.setItem(storageKey, JSON.stringify(counters));
  
  return counters[counterKey];
};

export default function Dashboard() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [pages, setPages] = useState(() => getInitialPages());
  const [currentPageId, setCurrentPageId] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [renamingPageId, setRenamingPageId] = useState<number | null>(null);
  const [newPageName, setNewPageName] = useState('');
  const [showAddById, setShowAddById] = useState(false);
  const [viewIdInput, setViewIdInput] = useState('');
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  
  // Get current page and views
  const currentPage = pages.find(p => p.id === currentPageId) || pages[0];
  const views = currentPage?.views || [];
  const [draggingViewId, setDraggingViewId] = useState<number | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ x: number, y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [addingView, setAddingView] = useState(false);
  const [resizingViewId, setResizingViewId] = useState<number | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number, y: number } | null>(null);
  const [resizeCorner, setResizeCorner] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);
  const [currentCursor, setCurrentCursor] = useState('default');
  const [currentViewId, setCurrentViewId] = useState<String | null>(null);
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
  const [previewOccupied, setPreviewOccupied] = useState(false);
  const [placingView, setPlacingView] = useState<{ type: string; position: { x: number; y: number } } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ width: number; height: number; x: number; y: number } | null>(null);
  const [lastResizeUpdate, setLastResizeUpdate] = useState<number>(0);
  const [originalViewSize, setOriginalViewSize] = useState<{ width: number; height: number; x: number; y: number } | null>(null);
  const [lastManualResizeTime, setLastManualResizeTime] = useState<Record<number, number>>({});
  const [viewCreationTime, setViewCreationTime] = useState<Record<number, number>>({});

  // Canvas pan and zoom states
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number, y: number } | null>(null);
  
  // Debounced save function for dashboard state
  const debouncedSave = useRef<ReturnType<typeof createDebouncedSave> | null>(null);
  
  // ID counters ref for managing view/page IDs
  const idCounters = useRef<Record<string, number>>({});
  
  // Collaboration state
  const [sharedDashboardId, setSharedDashboardId] = useState<string | null>(null);
  const isApplyingRemoteChange = useRef(false); // Prevent loops when applying remote changes

  // Save ALL dashboard state when anything changes - debounced to avoid too many saves
  // This ensures pages, views (position, size, title), pan, zoom, currentPageId are all persisted
  useEffect(() => {
    if (!currentUser) return;
    
    const storageKey = getPagesStorageKey(currentUser);
    // Save to localStorage immediately
    localStorage.setItem(storageKey, JSON.stringify(pages));
    
    // Debounce server save to avoid excessive API calls
    // Always save to shared dashboard state - all users collaborate on the same dashboard
    const saveTimeout = setTimeout(() => {
      if (sharedDashboardId && currentUser) {
        // Always use shared dashboard - wait for connection if needed
        if (collaborationClient.isConnected()) {
          const idCounterKey = getIdCounterStorageKey(currentUser);
          const idCountersStr = localStorage.getItem(idCounterKey);
          const idCountersValue = idCountersStr ? JSON.parse(idCountersStr) : (idCounters.current || {});
          broadcastDashboardChange('full_state', {
            state: {
              pages, // Only share pages/content, not viewport state
              currentPageId,
              idCounters: idCountersValue
              // panOffset and zoom are excluded - each user maintains their own viewport
            }
          });
        } else {
          // Connection not ready yet, will save once connected
          console.log('Waiting for Socket.IO connection before saving shared state...');
        }
      }
    }, 1000); // 1 second debounce - saves all changes together
    
    return () => clearTimeout(saveTimeout);
  }, [pages, currentUser, panOffset, zoom, currentPageId, sharedDashboardId]);


  // Note: Pan/zoom/page changes are now saved via the main useEffect above
  // which saves all state together (pages + panOffset + zoom + currentPageId)
  // This ensures everything is saved atomically and prevents conflicts

  // Check if user is already logged in and restore their dashboard state
  useEffect(() => {
    const savedUser = localStorage.getItem('dashboard_user');
    
    if (savedUser) {
      setCurrentUser(savedUser);
      setIsLoggedIn(true);
      
      // Automatically connect to shared dashboard for all users
      // Use a fixed shared dashboard ID so all users collaborate on the same dashboard
      const globalDashboardId = 'shared_dashboard';
      setSharedDashboardId(globalDashboardId);
      localStorage.setItem('shared_dashboard_id', globalDashboardId);
      
      // Always load from shared dashboard state via Socket.IO
      // The shared state will be loaded when Socket.IO connects via dashboard_state event
      // DO NOT load individual user state - always use shared dashboard
    }
  }, []);

  // Connect to collaboration server when dashboard is shared
  useEffect(() => {
    if (sharedDashboardId && currentUser) {
      // Use a small delay to avoid race conditions with multiple rapid calls
      const connectTimeout = setTimeout(() => {
        const connectPromise = collaborationClient.connect(sharedDashboardId, currentUser);
        if (connectPromise && typeof connectPromise.catch === 'function') {
          connectPromise.catch(err => {
            // Only log meaningful errors - Socket.IO handles reconnection automatically
            if (err && err.message && 
                !err.message.includes('already connected') && 
                !err.message.includes('already in progress') &&
                !err.message.includes('Failed to connect after all retry attempts')) {
              console.warn('Initial connection attempt failed, Socket.IO will retry:', err.message);
            }
          });
        }
      }, 100);

      return () => {
        clearTimeout(connectTimeout);
        if (sharedDashboardId && currentUser) {
          collaborationClient.send('leave_dashboard', {
            dashboard_id: sharedDashboardId,
            username: currentUser
          });
        }
      };
    } else {
      collaborationClient.disconnect();
    }
  }, [sharedDashboardId, currentUser]);

  // Helper function to broadcast dashboard changes
  const broadcastDashboardChange = useCallback((changeType: string, changeData: any) => {
    if (!sharedDashboardId || !currentUser || isApplyingRemoteChange.current) return;
    if (!collaborationClient.isConnected()) return;

    collaborationClient.send('dashboard_change', {
      dashboard_id: sharedDashboardId,
      username: currentUser,
      change_type: changeType,
      change_data: changeData
    });
  }, [sharedDashboardId, currentUser]);

  // Handle real-time collaboration events
  useEffect(() => {
    if (!sharedDashboardId || !currentUser) return;

    const handleDashboardChange = (data: any) => {
      // Ignore changes from self
      if (data.username === currentUser) return;
      
      isApplyingRemoteChange.current = true;
      
      try {
        const { change_type, change_data } = data;
        
        if (change_type === 'full_state') {
          const state = change_data.state;
          if (state.pages) setPages(state.pages);
          if (state.panOffset) setPanOffset(state.panOffset);
          if (state.zoom) setZoom(state.zoom);
          if (state.currentPageId) setCurrentPageId(state.currentPageId);
          if (state.idCounters) {
            // Update ID counters to avoid conflicts
            Object.keys(state.idCounters).forEach((key) => {
              const counter = state.idCounters[key];
              if (counter > (idCounters.current[key] || 0)) {
                idCounters.current[key] = counter;
              }
            });
          }
        } else if (change_type === 'view_add') {
          const { page_id, view } = change_data;
          setPages(prevPages => prevPages.map(page => 
            page.id === page_id 
              ? { ...page, views: [...(page.views || []), view] }
              : page
          ));
        } else if (change_type === 'view_update') {
          const { page_id, view_id, updates } = change_data;
          setPages(prevPages => prevPages.map(page => 
            page.id === page_id 
              ? { 
                  ...page, 
                  views: (page.views || []).map((v: any) => 
                    v.id === view_id ? { ...v, ...updates } : v
                  )
                }
              : page
          ));
        } else if (change_type === 'view_delete') {
          const { page_id, view_id } = change_data;
          setPages(prevPages => prevPages.map(page => 
            page.id === page_id 
              ? { ...page, views: (page.views || []).filter((v: any) => v.id !== view_id) }
              : page
          ));
        } else if (change_type === 'page_change') {
          setCurrentPageId(change_data.currentPageId);
        }
        // Note: pan_zoom changes are NOT shared - each user has their own independent viewport
      } finally {
        // Reset flag after a short delay to allow state updates to complete
        setTimeout(() => {
          isApplyingRemoteChange.current = false;
        }, 100);
      }
    };

    const handleDashboardState = (data: any) => {
      if (data.state && data.dashboard_id === sharedDashboardId) {
        isApplyingRemoteChange.current = true;
        try {
          const state = data.state;
          if (state.pages) setPages(state.pages);
          // Note: panOffset and zoom are NOT applied from shared state - each user has their own viewport
          if (state.currentPageId) setCurrentPageId(state.currentPageId);
          if (state.idCounters) {
            idCounters.current = { ...idCounters.current, ...state.idCounters };
          }
        } finally {
          setTimeout(() => {
            isApplyingRemoteChange.current = false;
          }, 100);
        }
      }
    };

    collaborationClient.on('dashboard_change', handleDashboardChange);
    collaborationClient.on('dashboard_state', handleDashboardState);

    return () => {
      collaborationClient.off('dashboard_change', handleDashboardChange);
      collaborationClient.off('dashboard_state', handleDashboardState);
    };
  }, [sharedDashboardId, currentUser]);

  const handleLogin = async (username: string) => {
    setCurrentUser(username);
    setIsLoggedIn(true);
    localStorage.setItem('dashboard_user', username);
    
    // Automatically connect to shared dashboard for all users
    // Use a fixed shared dashboard ID so all users collaborate on the same dashboard
    const globalDashboardId = 'shared_dashboard';
    setSharedDashboardId(globalDashboardId);
    localStorage.setItem('shared_dashboard_id', globalDashboardId);
    
    // State will be loaded from shared dashboard via Socket.IO dashboard_state event
    // when the collaboration client connects
    // DO NOT load individual user state - always use shared dashboard
  };

  const handleLogout = () => {
    // Disconnect from collaboration
    if (sharedDashboardId && currentUser) {
      collaborationClient.disconnect();
    }
    
    setCurrentUser('');
    setIsLoggedIn(false);
    setSharedDashboardId(null);
    localStorage.removeItem('dashboard_user');
    localStorage.removeItem('shared_dashboard_id');
  };

  // Initialize ID counter on first load for current user
  useEffect(() => {
    if (!currentUser) return;
    
    const storageKey = getIdCounterStorageKey(currentUser);
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      // Initialize counters based on existing data
      const allViews = pages.flatMap(page => page.views);
      const maxViewId = allViews.length > 0 ? Math.max(...allViews.map(v => v.id)) : 0;
      const maxPageId = pages.length > 0 ? Math.max(...pages.map(p => p.id)) : 0;
      
      localStorage.setItem(storageKey, JSON.stringify({
        view: maxViewId,
        page: maxPageId
      }));
    }
  }, [currentUser, pages]);

  // Check if an element or its parents are scrollable
  const isScrollableElement = useCallback((element: HTMLElement | null): boolean => {
    if (!element) return false;
    
    // Check if element is a modal, popover, or has overflow scroll/auto
    const isModal = element.closest('[role="dialog"]') || 
                    element.closest('.fixed') || 
                    element.closest('[class*="modal"]') ||
                    element.closest('[class*="Modal"]') ||
                    element.closest('textarea') ||
                    element.closest('input') ||
                    element.closest('select');
    
    if (isModal) return true;
    
    // Check if element itself is scrollable
    const style = window.getComputedStyle(element);
    const isScrollable = style.overflow === 'auto' || 
                         style.overflow === 'scroll' || 
                         style.overflowY === 'auto' || 
                         style.overflowY === 'scroll' ||
                         style.overflowX === 'auto' || 
                         style.overflowX === 'scroll';
    
    if (isScrollable && (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)) {
      return true;
    }
    
    // Check parent elements
    return isScrollableElement(element.parentElement);
  }, []);

  // Handle mouse wheel for zooming and trackpad panning (only on canvas, not on scrollable content)
  const handleWheel = useCallback((e: WheelEvent) => {
    const target = e.target as HTMLElement;
    
    // If the wheel event is on a scrollable element (modal, textarea, etc.), allow normal scrolling
    if (isScrollableElement(target)) {
      return; // Don't prevent default, allow normal scrolling
    }
    
    // Check if this is a zoom gesture (Ctrl/Cmd held) or pan gesture (trackpad two-finger scroll)
    const isZoomGesture = e.ctrlKey || e.metaKey;
    const hasPanDelta = Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0;
    
    if (isZoomGesture) {
      // Zoom gesture (pinch-to-zoom on trackpad or Ctrl+scroll)
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta));
      
      if (newZoom !== zoom) {
        // Get mouse position relative to the canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          // Calculate the point in world coordinates before zoom
          const worldX = (mouseX - panOffset.x) / zoom;
          const worldY = (mouseY - panOffset.y) / zoom;
          
          // Calculate new pan offset to keep the same world point under the mouse
          const newPanX = mouseX - worldX * newZoom;
          const newPanY = mouseY - worldY * newZoom;
          
          setPanOffset({ x: newPanX, y: newPanY });
        }
        
        setZoom(newZoom);
        
        // Note: Pan/zoom changes are NOT broadcast - each user has their own independent viewport
      }
    } else if (hasPanDelta) {
      // Pan gesture (two-finger scroll on trackpad or regular scroll wheel)
      e.preventDefault();
      
      // Update pan offset based on scroll delta
      setPanOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  // If not a zoom gesture, allow normal scrolling
  }, [zoom, panOffset, isScrollableElement, sharedDashboardId, currentUser, broadcastDashboardChange]);

  // Helper function to zoom to center
  const zoomToCenter = useCallback((newZoom: number) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate the point in world coordinates before zoom
      const worldX = (centerX - panOffset.x) / zoom;
      const worldY = (centerY - panOffset.y) / zoom;
      
      // Calculate new pan offset to keep the same world point at center
      const newPanX = centerX - worldX * newZoom;
      const newPanY = centerY - worldY * newZoom;
      
      setPanOffset({ x: newPanX, y: newPanY });
      setZoom(newZoom);
      
      // Note: Pan/zoom changes are NOT broadcast - each user has their own independent viewport
    }
  }, [zoom, panOffset, sharedDashboardId, currentUser, broadcastDashboardChange]);

  // Touch/pinch gesture state
  const touchStateRef = useRef<{
    touches: Touch[];
    initialDistance: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    center: { x: number; y: number };
  } | null>(null);

  // Handle touch events for pinch-to-zoom
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const target = e.target as HTMLElement;
    
    // Don't handle pinch gestures on scrollable elements
    if (isScrollableElement(target)) {
      return;
    }
    
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
        
        touchStateRef.current = {
          touches: [touch1, touch2],
          initialDistance: distance,
          initialZoom: zoom,
          initialPan: { ...panOffset },
          center: { x: centerX, y: centerY }
        };
      }
    }
  }, [zoom, panOffset, isScrollableElement]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStateRef.current || e.touches.length !== 2) {
      return;
    }
    
    const target = e.target as HTMLElement;
    if (isScrollableElement(target)) {
      touchStateRef.current = null;
      return;
    }
    
    e.preventDefault();
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    
    const { initialDistance, initialZoom, initialPan, center } = touchStateRef.current;
    const scale = currentDistance / initialDistance;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom * scale));
    
    if (newZoom !== zoom) {
      // Calculate the point in world coordinates before zoom
      const worldX = (center.x - initialPan.x) / initialZoom;
      const worldY = (center.y - initialPan.y) / initialZoom;
      
      // Calculate new pan offset to keep the same world point under the pinch center
      const newPanX = center.x - worldX * newZoom;
      const newPanY = center.y - worldY * newZoom;
      
      setPanOffset({ x: newPanX, y: newPanY });
      setZoom(newZoom);
    }
  }, [zoom, panOffset, isScrollableElement]);

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
      
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Handle escape key to cancel placement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && placingView) {
        setPlacingView(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [placingView]);

  // Handle mouse move for view placement
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!placingView) return;
    
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Get mouse position relative to the canvas
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    setPlacingView(prev => prev ? { ...prev, position: { x: mouseX, y: mouseY } } : null);
  }, [placingView]);

  // Handle canvas click for view placement
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!placingView) return;
    
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Convert screen coordinates to world coordinates
    const screenX = e.clientX - canvasRect.left;
    const screenY = e.clientY - canvasRect.top;
    const worldX = (screenX - panOffset.x) / zoom;
    const worldY = (screenY - panOffset.y) / zoom;

    // Convert to grid coordinates, centered on cursor
    const viewType = viewTypes.find(v => v.id === placingView.type) || viewTypes[0];
    console.log('=== PLACING VIEW DEBUG ===');
    console.log('View type:', placingView.type);
    console.log('ViewType found:', viewType);
    console.log('ViewType size from array:', viewType.size);
    console.log('ViewType size[0] (width):', viewType.size[0]);
    console.log('ViewType size[1] (height):', viewType.size[1]);
    
    const gridX = Math.round(worldX / GRID_SIZE) - Math.floor(viewType.size[0] / 2);
    const gridY = Math.round(worldY / GRID_SIZE) - Math.floor(viewType.size[1] / 2);

    // Add the view at the clicked position
    const newId = getNextId('view', currentUser);

    const newView = {
      id: newId,
      title: viewType.title,
      type: placingView.type,
      x: gridX,
      y: gridY,
      width: viewType.size[0],
      height: viewType.size[1],
      lastSize: { height: viewType.size[1], width: viewType.size[0] },
      minSize: viewType.minSize
    };

    console.log('New view being created:', newView);
    console.log('New view width:', newView.width);
    console.log('New view height:', newView.height);
    console.log('=== END PLACING VIEW DEBUG ===');

    // Record creation time to prevent auto-resize from shrinking newly created views
    setViewCreationTime(prev => ({ ...prev, [newId]: Date.now() }));

    setPages(prevPages => prevPages.map(page => 
      page.id === currentPageId 
        ? { ...page, views: [...page.views, newView] }
        : page
    ));

    // Broadcast the change
    broadcastDashboardChange('view_add', {
      page_id: currentPageId,
      view: newView
    });

    // Stop placement mode
    setPlacingView(null);
    setAddingView(false);
  }, [placingView, panOffset, zoom, currentPageId, currentUser, broadcastDashboardChange]);

  // Canvas panning
  const handleCanvasPanStart = (e: React.MouseEvent) => {
    // Allow panning in both edit and non-edit modes, but not while dragging/resizing
    if (draggingViewId || resizingViewId || isResizing) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsPanning(true);
    setPanStart({
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y
    });
  };

  const handleCanvasPanMove = useCallback((e: MouseEvent) => {
    // Don't pan if resizing
    if (resizingViewId || isResizing) return;
    
    if (isPanning && panStart) {
      const newPanOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      };
      setPanOffset(newPanOffset);
      
      // Note: Pan/zoom changes are NOT broadcast - each user has their own independent viewport
    }
  }, [isPanning, panStart, resizingViewId, isResizing, sharedDashboardId, currentUser, broadcastDashboardChange]);

  const handleCanvasPanEnd = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleCanvasPanMove);
      window.addEventListener('mouseup', handleCanvasPanEnd);
      return () => {
        window.removeEventListener('mousemove', handleCanvasPanMove);
        window.removeEventListener('mouseup', handleCanvasPanEnd);
      };
    }
  }, [isPanning, handleCanvasPanMove, handleCanvasPanEnd]);

  // Calculate bounding box of all views
  const calculateViewBounds = () => {
    if (views.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    views.forEach(view => {
      const viewMinX = view.x * GRID_SIZE;
      const viewMinY = view.y * GRID_SIZE;
      const viewMaxX = viewMinX + (view.width * GRID_SIZE);
      const viewMaxY = viewMinY + (view.height * GRID_SIZE);

      minX = Math.min(minX, viewMinX);
      minY = Math.min(minY, viewMinY);
      maxX = Math.max(maxX, viewMaxX);
      maxY = Math.max(maxY, viewMaxY);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // Calculate optimal zoom to fit all views
  const calculateOptimalZoom = (bounds) => {
    if (bounds.width === 0 && bounds.height === 0) return 1;

    const canvas = canvasRef.current;
    if (!canvas) return 1;

    const canvasRect = canvas.getBoundingClientRect();
    const padding = 80; // Add some padding around the views
    
    // Calculate available space
    const availableWidth = canvasRect.width - (padding * 2);
    const availableHeight = canvasRect.height - (padding * 2);
    
    // Ensure we have positive dimensions
    if (availableWidth <= 0 || availableHeight <= 0 || bounds.width <= 0 || bounds.height <= 0) {
      return 1;
    }
    
    // Calculate scale factors
    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;
    
    // Use the smaller scale to ensure everything fits, but don't exceed MAX_ZOOM
    const optimalZoom = Math.min(scaleX, scaleY, MAX_ZOOM);
    
    // Ensure we don't go below MIN_ZOOM, but prefer a reasonable minimum
    const reasonableMinZoom = Math.max(MIN_ZOOM, 0.4); // At least 40% zoom
    return Math.max(optimalZoom, reasonableMinZoom);
  };

  // Reset view to home position - center all views on screen
  const resetView = () => {
    const bounds = calculateViewBounds();
    
    if (bounds.width === 0 && bounds.height === 0) {
      // No views, reset to default
      setPanOffset({ x: 0, y: 0 });
      setZoom(1);
      return;
    }

    const optimalZoom = calculateOptimalZoom(bounds);
    const canvas = canvasRef.current;
    
    if (canvas) {
      const canvasRect = canvas.getBoundingClientRect();
      
      // Calculate center of all views
      const centerX = bounds.minX + bounds.width / 2;
      const centerY = bounds.minY + bounds.height / 2;
      
      // Calculate pan offset to center the views on screen
      const newPanX = (canvasRect.width / 2) - (centerX * optimalZoom);
      const newPanY = (canvasRect.height / 2) - (centerY * optimalZoom);
      
      setPanOffset({ x: newPanX, y: newPanY });
      setZoom(optimalZoom);
    }
    
    // State will be automatically saved via useEffect
  };

  // Check if a position overlaps with existing views
  const isPositionOccupied = (x: number, y: number, width: number, height: number, excludeId?: number) => {
    const newViewBounds = {
      left: x,
      right: x + width,
      top: y,
      bottom: y + height
    };

    return views.some(view => {
      if (excludeId && view.id === excludeId) return false;
      
      const existingBounds = {
        left: view.x,
        right: view.x + view.width,
        top: view.y,
        bottom: view.y + view.height
      };

      // Check for overlap
      return !(
        newViewBounds.right <= existingBounds.left ||
        newViewBounds.left >= existingBounds.right ||
        newViewBounds.bottom <= existingBounds.top ||
        newViewBounds.top >= existingBounds.bottom
      );
    });
  };

  // Find the next available position for a new view
  const findAvailablePosition = (width: number, height: number) => {
    const viewportCenter = {
      x: (-panOffset.x + window.innerWidth / 2) / zoom,
      y: (-panOffset.y + window.innerHeight / 2) / zoom
    };

    // Convert to grid coordinates
    const startX = Math.max(0, Math.round((viewportCenter.x - (width * GRID_SIZE) / 2) / GRID_SIZE));
    const startY = Math.max(0, Math.round((viewportCenter.y - (height * GRID_SIZE) / 2) / GRID_SIZE));

    // First try the center position
    if (!isPositionOccupied(startX, startY, width, height)) {
      return { x: startX, y: startY };
    }

    // Search in expanding circles around the center
    const step = 1; // Grid step
    const maxRadius = Math.max(window.innerWidth, window.innerHeight) / zoom / GRID_SIZE;

    for (let radius = step; radius < maxRadius; radius += step) {
      // Try positions in a circle around the center
      const positions = [];
      const circumference = 2 * Math.PI * radius;
      const numPositions = Math.max(8, Math.floor(circumference / 2));

      for (let i = 0; i < numPositions; i++) {
        const angle = (2 * Math.PI * i) / numPositions;
        const x = Math.max(0, Math.round(startX + Math.cos(angle) * radius));
        const y = Math.max(0, Math.round(startY + Math.sin(angle) * radius));
        
        if (!isPositionOccupied(x, y, width, height)) {
          return { x, y };
        }
      }
    }

    // Fallback: grid search if circular search fails
    const searchArea = Math.round(2000 / GRID_SIZE); // Search area in grid units
    for (let y = Math.max(0, startY - searchArea); y < startY + searchArea; y += 1) {
      for (let x = Math.max(0, startX - searchArea); x < startX + searchArea; x += 1) {
        if (!isPositionOccupied(x, y, width, height)) {
          return { x, y };
        }
      }
    }

    // Last resort: place at a far offset
    return { x: startX + 25, y: startY + 25 };
  };

  const addNewView = (type: string) => {
    // Start placement mode - user will click to place the view
    setPlacingView({ type, position: { x: 0, y: 0 } });
    setAddingView(false);
  };

  const removeView = (id: number) => {
    console.log('removeView called with id:', id);
    const currentPage = pages.find(p => p.id === currentPageId);
    if (!currentPage) {
      console.log('No current page found');
      return;
    }
    
    const viewType = currentPage.views.find(v => v.id === id)?.type;
    console.log('Removing view type:', viewType);
    
    // Clean up localStorage for specific view types
    if (viewType === 'stickies') {
      removeLocalStorageItem(`stickies_${id}`);
    }
    
    setPages(prevPages => prevPages.map(page => 
      page.id === currentPageId 
        ? { ...page, views: page.views.filter(view => view.id !== id) }
        : page
    ));

    // Broadcast the change
    broadcastDashboardChange('view_delete', {
      page_id: currentPageId,
      view_id: id
    });
  };

  const updateView = (id: number, data: Partial<typeof views[0]>) => {
    // Debug logging for data-table view updates
    const view = views.find(v => v.id === id);
    if (view && view.type === 'data-table' && (data.width !== undefined || data.height !== undefined)) {
      console.log('=== UPDATE VIEW DEBUG ===');
      console.log('View ID:', id);
      console.log('View type:', view.type);
      console.log('Old width:', view.width);
      console.log('Old height:', view.height);
      console.log('New width:', data.width);
      console.log('New height:', data.height);
      console.log('Update data:', data);
      console.log('=== END UPDATE VIEW DEBUG ===');
    }
    
    setPages(prevPages => prevPages.map(page => 
      page.id === currentPageId 
        ? { ...page, views: page.views.map(view => view.id === id ? { ...view, ...data } : view) }
        : page
    ));

    // Broadcast the change
    broadcastDashboardChange('view_update', {
      page_id: currentPageId,
      view_id: id,
      updates: data
    });
  };

  // Automatically resize certain views vertically based on their content (e.g., NLInterface, DataTable)
  useEffect(() => {
    // Don't auto-resize if user is actively resizing
    if (isResizing || resizingViewId) return;

    const observers: Record<number, ResizeObserver> = {};

    views.forEach((view) => {
      if (!AUTO_HEIGHT_VIEW_TYPES.has(view.type)) return;
      
      // Skip auto-resize for the view being resized
      if (view.id === resizingViewId) return;

      const element = document.querySelector<HTMLDivElement>(`[data-dashboard-view-id="${view.id}"]`);
      if (!element) return;

      const observer = new ResizeObserver((entries) => {
        // Don't auto-resize if user is actively resizing
        if (isResizing || resizingViewId) return;
        
        // Check cooldown: don't auto-resize if view was manually resized recently (within 2 seconds)
        const lastResizeTime = lastManualResizeTime[view.id];
        if (lastResizeTime && Date.now() - lastResizeTime < 2000) {
          return;
        }
        
        // Prevent auto-resize from shrinking newly created views (within 5 seconds of creation)
        const creationTime = viewCreationTime[view.id];
        if (creationTime) {
          const timeSinceCreation = Date.now() - creationTime;
          if (timeSinceCreation < 5000) {
            // Only allow growing, not shrinking for newly created views
            const entry = entries[0];
            if (!entry) return;
            
            const contentHeight = entry.contentRect.height;
            const currentHeightPx = view.height * GRID_SIZE - GRID_GAP;
            const heightDiff = contentHeight - currentHeightPx;
            
            // Only grow if content is significantly larger, don't shrink
            if (heightDiff < 100) {
              return; // Don't resize if content is smaller or only slightly larger
            }
          }
        }
        
        const entry = entries[0];
        if (!entry) return;

        const contentHeight = entry.contentRect.height;
        const currentHeightPx = view.height * GRID_SIZE - GRID_GAP;
        const heightDiff = Math.abs(contentHeight - currentHeightPx);

        // Only adjust if the height differs significantly
        // Use larger threshold (100px) for recently resized views
        const threshold = lastResizeTime && Date.now() - lastResizeTime < 5000 ? 100 : 24;
        if (heightDiff < threshold) return;

        const minRows = view.minSize ? view.minSize[1] : 1;
        const maxRows = view.maxSize ? view.maxSize[1] : 20;
        const newGridHeight = Math.min(
          maxRows,
          Math.max(
            minRows,
            Math.ceil((contentHeight + GRID_GAP) / GRID_SIZE)
          )
        );

        // Don't shrink newly created views below their initial size
        if (creationTime && Date.now() - creationTime < 5000) {
          const initialHeight = view.lastSize?.height || view.height;
          if (newGridHeight < initialHeight) {
            console.log('=== AUTO-RESIZE BLOCKED (newly created) ===');
            console.log('View ID:', view.id);
            console.log('Initial height:', initialHeight);
            console.log('Requested height:', newGridHeight);
            console.log('=== END AUTO-RESIZE BLOCKED ===');
            return;
          }
        }

        if (newGridHeight !== view.height) {
          console.log('=== AUTO-RESIZE DEBUG ===');
          console.log('View ID:', view.id);
          console.log('View type:', view.type);
          console.log('Current view height (grid):', view.height);
          console.log('Current view width (grid):', view.width);
          console.log('Content height (px):', contentHeight);
          console.log('Current height (px):', currentHeightPx);
          console.log('Height diff:', heightDiff);
          console.log('Threshold:', threshold);
          console.log('New grid height:', newGridHeight);
          console.log('=== END AUTO-RESIZE DEBUG ===');
          
          updateView(view.id, {
            height: newGridHeight,
            lastSize: {
              ...(view.lastSize || { width: view.width, height: view.height }),
              height: newGridHeight
            }
          });
        }
      });

      observer.observe(element);
      observers[view.id] = observer;
    });

    return () => {
      Object.values(observers).forEach((observer) => observer.disconnect());
    };
  }, [views, updateView, isResizing, resizingViewId, lastManualResizeTime, viewCreationTime]);

  // Page management functions
  const addNewPage = () => {
    const newPageId = getNextId('page', currentUser);
    const newPage = {
      id: newPageId,
      name: `Page ${newPageId}`,
      views: []
    };
    setPages(prev => [...prev, newPage]);
    setCurrentPageId(newPageId);
    setNewPageName('');
    
    // Broadcast full state update (new page added)
    if (sharedDashboardId && currentUser && !isApplyingRemoteChange.current) {
      const updatedPages = [...pages, newPage];
      broadcastDashboardChange('full_state', {
        state: {
          pages: updatedPages, // Only share pages/content, not viewport state
          currentPageId: newPageId
          // panOffset and zoom are excluded - each user maintains their own viewport
        }
      });
    }
  };

  const renamePage = (pageId: number, newName: string) => {
    if (!newName.trim()) return;
    setPages(prevPages => prevPages.map(page => 
      page.id === pageId ? { ...page, name: newName.trim() } : page
    ));
    setRenamingPageId(null);
  };

  const deletePage = (pageId: number) => {
    if (pages.length <= 1) return; // Don't delete the last page
    
    // Get the page being deleted
    const pageToDelete = pages.find(page => page.id === pageId);
    if (!pageToDelete) return;
    
    // Get all views from all other pages
    const allOtherViews = pages
      .filter(page => page.id !== pageId)
      .flatMap(page => page.views);
    
    // Find views that exist only in the page being deleted
    const viewsToCleanup = pageToDelete.views.filter(view => 
      !allOtherViews.some(otherView => otherView.id === view.id)
    );
    
    // Call destroy-view API for NL Interface views that will be deleted
    viewsToCleanup.forEach(view => {
      if (view.type === 'nl-interface') {
        fetch('/api/nl/destroy-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            viewID: view.id
          }),
        }).catch(error => {
          console.error('Failed to call destroy-view API:', error);
        });
      }
    });
    
    setPages(prevPages => prevPages.filter(page => page.id !== pageId));
    if (currentPageId === pageId) {
      const newCurrentPageId = pages.find(p => p.id !== pageId)?.id || 1;
      setCurrentPageId(newCurrentPageId);
      // State will be automatically saved via useEffect
    }
  };

  // View sharing functions
  const copyViewId = async (viewId: number) => {
    try {
      await navigator.clipboard.writeText(viewId.toString());
      setCopySuccess(viewId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy view ID:', err);
    }
  };

  const addViewById = () => {
    const viewId = parseInt(viewIdInput);
    if (isNaN(viewId) || viewId <= 0) {
      alert('Please enter a valid view ID');
      return;
    }

    // Find the view across all pages
    let sourceView = null;
    let sourcePage = null;
    
    for (const page of pages) {
      const view = page.views.find(v => v.id === viewId);
      if (view) {
        sourceView = view;
        sourcePage = page;
        break;
      }
    }

    if (!sourceView) {
      alert(`View with ID ${viewId} not found`);
      return;
    }

    // Check if view already exists on current page
    if (views.some(v => v.id === viewId)) {
      alert('This view already exists on the current page');
      return;
    }

    // Create a copy of the view for the current page
    const newView = {
      ...sourceView,
      // Find a new position for the copied view
      x: sourceView.x + 50,
      y: sourceView.y + 50,
    };

    setPages(prevPages => prevPages.map(page => 
      page.id === currentPageId 
        ? { ...page, views: [...page.views, newView] }
        : page
    ));

    setViewIdInput('');
    setShowAddById(false);
  };

  // Handle drag start for views
  const handleDragStart = (id: number, e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();

    setIsDragging(true);
    const view = views.find(v => v.id === id);
    if (!view) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = (e.clientX - rect.left) / zoom;
    const offsetY = (e.clientY - rect.top) / zoom;

    setDragOffset({ x: offsetX, y: offsetY });
    setDraggingViewId(id);
    setDragStartPosition({ x: e.clientX, y: e.clientY });
    setIsActuallyDragging(false);
  };

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (draggingViewId === null || !editMode) return;

    // Check if we've moved enough to consider it actual dragging (threshold of 5 pixels)
    if (!isActuallyDragging && dragStartPosition) {
      const deltaX = Math.abs(e.clientX - dragStartPosition.x);
      const deltaY = Math.abs(e.clientY - dragStartPosition.y);
      const threshold = 5;
      
      if (deltaX > threshold || deltaY > threshold) {
        setIsActuallyDragging(true);
      }
    }

    // Only update position if we're actually dragging
    if (isActuallyDragging) {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

      const worldX = (e.clientX - canvasRect.left - panOffset.x) / zoom - dragOffset.x;
      const worldY = (e.clientY - canvasRect.top - panOffset.y) / zoom - dragOffset.y;
      
      // Convert to grid coordinates
      const x = Math.round(worldX / GRID_SIZE);
      const y = Math.round(worldY / GRID_SIZE);

      setPreviewPosition({ x, y });
    }
  }, [draggingViewId, panOffset, zoom, dragOffset, isActuallyDragging, dragStartPosition]);

  const handleDrop = useCallback(() => {
    if (draggingViewId === null || !editMode) return;

    // Only update position if we were actually dragging
    if (isActuallyDragging && previewPosition !== null) {
    updateView(draggingViewId, { x: previewPosition.x, y: previewPosition.y });
    }

    // Reset all drag states
    setDraggingViewId(null);
    setPreviewPosition(null);
    setIsDragging(false);
    setDragStartPosition(null);
    setIsActuallyDragging(false);
  }, [draggingViewId, previewPosition, updateView, editMode, isActuallyDragging]);

  useEffect(() => {
    if (draggingViewId) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDrop);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDrop);
      };
    }
  }, [draggingViewId, handleDragMove, handleDrop]);

  // Handle resize start
  const handleResizeStart = (id: number, corner: string, e: React.MouseEvent) => {
    if (!editMode) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    
    // Stop any active panning when resize starts
    setIsPanning(false);
    setPanStart(null);
    
    const view = views.find(v => v.id === id);
    if (!view) return;
    
    // Store original view dimensions for preview
    setOriginalViewSize({
      width: view.width,
      height: view.height,
      x: view.x,
      y: view.y
    });
    
    setResizingViewId(id);
    setResizeCorner(corner);
    setIsResizing(true);
    
    setResizeStart({
      x: e.clientX,
      y: e.clientY
    });
  };

  // Handle resize move - only update preview, not the actual view
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingViewId || !resizeStart || !resizeCorner || !editMode || !originalViewSize) {
      return;
    }

    const viewType = viewTypes.find(v => {
      const view = views.find(v2 => v2.id === resizingViewId);
      return view && v.id === view.type;
    });
    if (!viewType) return;

    const deltaX = (e.clientX - resizeStart.x) / zoom;
    const deltaY = (e.clientY - resizeStart.y) / zoom;

    // PowerPoint-like precision: finer control with shift key for aspect ratio
    const isShiftPressed = e.shiftKey;
    const resizeStep = isShiftPressed ? 0.1 : 0.25; // Even finer with shift
    const sensitivity = 1.0; // Direct 1:1 mapping for precise control
    
    // Apply sensitivity
    const adjustedDeltaX = deltaX * sensitivity;
    const adjustedDeltaY = deltaY * sensitivity;
    
    // Convert to grid units
    const gridDeltaX = adjustedDeltaX / GRID_SIZE;
    const gridDeltaY = adjustedDeltaY / GRID_SIZE;
    
    // Round to resize step for granular control
    // For vertical-only resizing, ensure we use the actual delta even if small
    const isVerticalOnly = ['n', 's'].includes(resizeCorner);
    const isHorizontalOnly = ['e', 'w'].includes(resizeCorner);
    
    let stepDeltaX = Math.round(gridDeltaX / resizeStep) * resizeStep;
    let stepDeltaY = Math.round(gridDeltaY / resizeStep) * resizeStep;
    
    // For vertical-only resizing, use actual delta if rounded value is zero but there's movement
    if (isVerticalOnly && Math.abs(gridDeltaY) > 0.001) {
      if (Math.abs(stepDeltaY) < resizeStep) {
        stepDeltaY = Math.sign(gridDeltaY) * resizeStep;
      }
      stepDeltaX = 0; // Ignore horizontal movement for vertical-only resize
    }
    
    // For horizontal-only resizing, use actual delta if rounded value is zero but there's movement
    if (isHorizontalOnly && Math.abs(gridDeltaX) > 0.001) {
      if (Math.abs(stepDeltaX) < resizeStep) {
        stepDeltaX = Math.sign(gridDeltaX) * resizeStep;
      }
      stepDeltaY = 0; // Ignore vertical movement for horizontal-only resize
    }

    // Calculate new size and position based on corner
    let newWidth = originalViewSize.width;
    let newHeight = originalViewSize.height;
    let newX = originalViewSize.x;
    let newY = originalViewSize.y;

    // Maintain aspect ratio if shift is pressed and resizing from corner
    if (isShiftPressed && ['se', 'sw', 'ne', 'nw'].includes(resizeCorner)) {
      const aspectRatio = originalViewSize.width / originalViewSize.height;
      // Use the larger delta to maintain aspect ratio
      const maxDelta = Math.max(Math.abs(stepDeltaX), Math.abs(stepDeltaY));
      const signX = Math.sign(stepDeltaX) || 1;
      const signY = Math.sign(stepDeltaY) || 1;
      // Calculate deltas that maintain aspect ratio
      if (Math.abs(stepDeltaX) > Math.abs(stepDeltaY)) {
        stepDeltaX = signX * maxDelta;
        stepDeltaY = signY * maxDelta / aspectRatio;
      } else {
        stepDeltaX = signX * maxDelta * aspectRatio;
        stepDeltaY = signY * maxDelta;
      }
    }

    switch (resizeCorner) {
      case 'se': // bottom-right corner
        newWidth = Math.max(viewType.minSize[0], Math.min(viewType.maxSize[0], originalViewSize.width + stepDeltaX));
        newHeight = Math.max(viewType.minSize[1], Math.min(viewType.maxSize[1], originalViewSize.height + stepDeltaY));
        break;
      case 'sw': // bottom-left corner
        newWidth = Math.max(viewType.minSize[0], Math.min(viewType.maxSize[0], originalViewSize.width - stepDeltaX));
        newHeight = Math.max(viewType.minSize[1], Math.min(viewType.maxSize[1], originalViewSize.height + stepDeltaY));
        newX = originalViewSize.x + originalViewSize.width - newWidth;
        break;
      case 'ne': // top-right corner
        newWidth = Math.max(viewType.minSize[0], Math.min(viewType.maxSize[0], originalViewSize.width + stepDeltaX));
        newHeight = Math.max(viewType.minSize[1], Math.min(viewType.maxSize[1], originalViewSize.height - stepDeltaY));
        newY = originalViewSize.y + originalViewSize.height - newHeight;
        break;
      case 'nw': // top-left corner
        newWidth = Math.max(viewType.minSize[0], Math.min(viewType.maxSize[0], originalViewSize.width - stepDeltaX));
        newHeight = Math.max(viewType.minSize[1], Math.min(viewType.maxSize[1], originalViewSize.height - stepDeltaY));
        newX = originalViewSize.x + originalViewSize.width - newWidth;
        newY = originalViewSize.y + originalViewSize.height - newHeight;
        break;
      case 'n': // top side
        newHeight = Math.max(viewType.minSize[1], Math.min(viewType.maxSize[1], originalViewSize.height - stepDeltaY));
        newY = originalViewSize.y + originalViewSize.height - newHeight;
        break;
      case 's': // bottom side
        newHeight = Math.max(viewType.minSize[1], Math.min(viewType.maxSize[1], originalViewSize.height + stepDeltaY));
        break;
      case 'e': // right side
        newWidth = Math.max(viewType.minSize[0], Math.min(viewType.maxSize[0], originalViewSize.width + stepDeltaX));
        break;
      case 'w': // left side
        newWidth = Math.max(viewType.minSize[0], Math.min(viewType.maxSize[0], originalViewSize.width - stepDeltaX));
        newX = originalViewSize.x + originalViewSize.width - newWidth;
        break;
    }

    // Only update preview, not the actual view
    const now = Date.now();
    const throttleDelay = 8; // ~120fps for smooth preview
    
    if (now - lastResizeUpdate > throttleDelay) {
      setResizePreview({ 
        width: newWidth, 
        height: newHeight,
        x: newX,
        y: newY
      });
      setLastResizeUpdate(now);
    }
  }, [resizingViewId, resizeStart, resizeCorner, zoom, originalViewSize, lastResizeUpdate, views, editMode]);

  // Handle resize end - apply the preview to the actual view
  const handleResizeEnd = useCallback(() => {
    if (resizingViewId && resizePreview) {
      // Apply the preview dimensions to the actual view
      updateView(resizingViewId, {
        width: resizePreview.width,
        height: resizePreview.height,
        x: resizePreview.x,
        y: resizePreview.y
      });
      
      // Record the timestamp of this manual resize for cooldown
      setLastManualResizeTime(prev => ({
        ...prev,
        [resizingViewId]: Date.now()
      }));
    }
    
    setResizingViewId(null);
    setResizeStart(null);
    setResizeCorner(null);
    setIsResizing(false);
    setResizePreview(null);
    setOriginalViewSize(null);
    setLastResizeUpdate(0);
  }, [resizingViewId, resizePreview, updateView]);

  useEffect(() => {
    if (resizingViewId) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingViewId, handleResizeMove, handleResizeEnd]);

  // Handle keyboard events for view deletion and movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedViewId || !editMode) return;
      
      // Check if user is typing in an input field
      const activeElement = document.activeElement as HTMLElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' ||
        activeElement.getAttribute('role') === 'textbox'
      );
      
      // Delete key or Backspace to remove view (Backspace for Mac)
      // Only if not typing in an input field
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        e.preventDefault();
        console.log('Delete/Backspace key pressed, removing view:', selectedViewId);
        removeView(selectedViewId);
        setSelectedViewId(null);
        return;
      }
      
      // Arrow keys to move view
      // Only if not typing in an input field
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isTyping) {
        e.preventDefault();
        
        const currentPage = pages.find(p => p.id === currentPageId);
        if (!currentPage) return;
        
        const selectedView = currentPage.views.find(v => v.id === selectedViewId);
        if (!selectedView) return;
        
        const moveStep = e.shiftKey ? 10 : 1; // Shift + arrow for faster movement
        let newX = selectedView.x;
        let newY = selectedView.y;
        
        switch (e.key) {
          case 'ArrowUp':
            newY = selectedView.y - moveStep;
            break;
          case 'ArrowDown':
            newY = selectedView.y + moveStep;
            break;
          case 'ArrowLeft':
            newX = selectedView.x - moveStep;
            break;
          case 'ArrowRight':
            newX = selectedView.x + moveStep;
            break;
        }
        
        // Update the view position
        updateView(selectedViewId, { x: newX, y: newY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedViewId, editMode, pages, currentPageId]);

  // Show login page if not logged in
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50">
        {/* Unified Header: Tabs + Controls */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {pages.map((page) => (
              <div
                key={page.id}
                className={`flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer transition-colors ${
                  currentPageId === page.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => {
                  setCurrentPageId(page.id);
                  // Broadcast page change
                  if (sharedDashboardId && currentUser && !isApplyingRemoteChange.current) {
                    broadcastDashboardChange('page_change', { currentPageId: page.id });
                  }
                }}
              >
                {renamingPageId === page.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newPageName}
                      onChange={(e) => setNewPageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renamePage(page.id, newPageName);
                        } else if (e.key === 'Escape') {
                          setRenamingPageId(null);
                          setNewPageName('');
                        }
                      }}
                      onBlur={() => {
                        renamePage(page.id, newPageName);
                      }}
                      className="text-sm bg-transparent border-none outline-none"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        renamePage(page.id, newPageName);
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingPageId(null);
                        setNewPageName('');
                      }}
                    >
                      <XIcon className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium truncate max-w-32">{page.name}</span>
                    {editMode && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewPageName(page.name);
                            setRenamingPageId(page.id);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        {pages.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePage(page.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={addNewPage}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Page
            </Button>
          </div>

          <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => zoomToCenter(Math.max(MIN_ZOOM, zoom * 0.8))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => zoomToCenter(Math.min(MAX_ZOOM, zoom * 1.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={resetView}
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>

          {/* Active Users Avatars */}
          {sharedDashboardId && currentUser && (
            <ActiveUsersAvatars
              dashboardId={sharedDashboardId}
              currentUsername={currentUser}
            />
          )}

          {/* User Greeting, Share, and Logout */}
          <div className="flex items-center gap-4 px-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Hi {currentUser}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Logout
            </button>
                </div>

          <ThemeToggle />
        </div>
        </div>
      </header>

      {/* Canvas */}
      <div 
        ref={canvasRef}
        className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing`}
        onMouseDown={handleCanvasPanStart}
        onMouseMove={handleCanvasMouseMove}
        onClick={(e) => {
          handleCanvasClick(e);
          // Deselect view when clicking on empty canvas
          if (e.target === e.currentTarget) {
            setSelectedViewId(null);
          }
        }}
        style={{ 
          cursor: placingView ? 'crosshair' : (isPanning ? 'grabbing' : 'grab')
        }}
      >
        {/* Collaborative Cursors */}
        {sharedDashboardId && currentUser && (
          <CollaborativeCursors
            dashboardId={sharedDashboardId}
            username={currentUser}
            panOffset={panOffset}
            zoom={zoom}
            canvasRef={canvasRef}
          />
        )}
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `
              radial-gradient(circle, #666 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
          }}
        />

        {/* View Placement Preview */}
        {placingView && (() => {
          const previewViewType = viewTypes.find(v => v.id === placingView.type) || viewTypes[0];
          const previewWidth = previewViewType.size[0] || 2;
          const previewHeight = previewViewType.size[1] || 2;
          
          return (
            <div
              className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-500/10 rounded-lg"
              style={{
                left: placingView.position.x - (previewWidth * GRID_SIZE * zoom - GRID_GAP * zoom) / 2,
                top: placingView.position.y - (previewHeight * GRID_SIZE * zoom - GRID_GAP * zoom) / 2,
                width: previewWidth * GRID_SIZE * zoom - GRID_GAP * zoom,
                height: previewHeight * GRID_SIZE * zoom - GRID_GAP * zoom,
              }}
            >
              <div className="flex items-center justify-center h-full text-blue-600 font-semibold text-2xl">
                {previewViewType.title || 'New View'}
              </div>
            </div>
          );
        })()}

        {/* Views Container */}
        <div
          className="absolute"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
          }}
        >
          {/* Preview position for dragging */}
          {previewPosition && editMode && draggingViewId && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/10 rounded-xl pointer-events-none"
              style={{
                left: `${previewPosition.x * GRID_SIZE}px`,
                top: `${previewPosition.y * GRID_SIZE}px`,
                width: `${views.find(v => v.id === draggingViewId)?.width * GRID_SIZE - GRID_GAP}px`,
                height: `${views.find(v => v.id === draggingViewId)?.height * GRID_SIZE - GRID_GAP}px`,
                zIndex: 1000,
              }}
            />
          )}

          {/* Resize preview indicator */}
          {resizePreview && resizingViewId && (
            <div
              className="absolute bg-blue-500/15 border-2 border-blue-500 border-dashed rounded-lg pointer-events-none flex items-center justify-center transition-all duration-200 ease-out"
              style={{
                left: `${resizePreview.x * GRID_SIZE}px`,
                top: `${resizePreview.y * GRID_SIZE}px`,
                width: `${resizePreview.width * GRID_SIZE - GRID_GAP}px`,
                height: `${resizePreview.height * GRID_SIZE - GRID_GAP}px`,
                zIndex: 1001,
                transform: 'scale(1.02)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
              }}
            >
              <div className="bg-blue-500 text-white px-4 py-2 rounded-md text-xl font-mono shadow-lg backdrop-blur-sm">
                {resizePreview.width.toFixed(2)} × {resizePreview.height.toFixed(2)}
              </div>
            </div>
          )}

          {/* Views */}
          <AnimatePresence>
            {views.map(view => {
              const viewType = viewTypes.find(v => v.id === view.type) || viewTypes[0];
              const isDragging = draggingViewId === view.id;

              // Debug logging for data-table views
              if (view.type === 'data-table') {
                console.log('=== VIEW RENDER DEBUG ===');
                console.log('View ID:', view.id);
                console.log('View type:', view.type);
                console.log('View width (grid):', view.width);
                console.log('View height (grid):', view.height);
                console.log('View width (px):', view.width * GRID_SIZE - GRID_GAP);
                console.log('View height (px):', view.height * GRID_SIZE - GRID_GAP);
                console.log('ViewType size from array:', viewType.size);
                console.log('=== END VIEW RENDER DEBUG ===');
              }

              return (
                <motion.div
                  key={view.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: view.x * GRID_SIZE,
                    y: view.y * GRID_SIZE,
                    width: view.width * GRID_SIZE - GRID_GAP,
                    height: view.height * GRID_SIZE - GRID_GAP,
                  }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    type: "spring",
                    stiffness: 160,
                    damping: 32,
                    mass: 1.05,
                    restDelta: 0.5,
                    restSpeed: 0.5,
                    opacity: { duration: 0.25 }
                  }}
                  className={`absolute bg-white dark:bg-gray-800 rounded-2xl border shadow-lg dashboard-view text-2xl leading-relaxed flex flex-col ${
                    isDragging ? 'shadow-2xl z-50' : 'shadow-sm'
                  } ${
                    selectedViewId === view.id ? 'ring-2 ring-blue-500 ring-opacity-50 border-blue-500' : 'border-gray-200 dark:border-gray-700'
                  } ${
                    editMode ? 'cursor-move' : 'cursor-pointer'
                  }`}
                  style={{
                    opacity: resizingViewId === view.id ? 0.4 : 1,
                    transition: resizingViewId === view.id ? 'opacity 0.1s' : 'opacity 0.2s',
                  }}
                  data-dashboard-view-id={view.id}
                  onMouseDown={(e) => {
                    if (editMode) {
                      handleDragStart(view.id, e);
                    }
                    // Select view on click
                    setSelectedViewId(view.id);
                  }}
                >
                  {/* View Header */}
                  <div className="flex justify-between items-center px-5 py-5 border-b border-gray-200 dark:border-gray-700 text-2xl font-semibold min-h-[80px]">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${viewType.color}`}>
                        <viewType.icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-3xl font-semibold truncate">{view.title}</h3>
                      

                      {/* View Info and Share View ID */}
                      <div className="flex items-center gap-1">
                        {/* View Info Tooltip */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <Info className="w-6 h-6" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md text-2xl leading-relaxed">
                              <div className="space-y-2">
                                <p className="font-semibold">{viewType.title}</p>
                                <p className="text-xl text-gray-300">{viewType.description}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Share View ID */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                          <button
                                onClick={() => copyViewId(view.id)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                                <Share2 className="w-6 h-6" />
                          </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xl">
                              <p>Copy View ID: {view.id}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {copySuccess === view.id && (
                          <span className="text-xl text-green-600 dark:text-green-400 font-medium animate-in fade-in duration-200">
                            Copied!
                          </span>
                          )}
                        </div>
                    </div>

                    {editMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeView(view.id);
                        }}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  {/* View Content */}
                  <div className="flex-1 overflow-hidden p-5 relative text-2xl leading-relaxed dashboard-view-content">
                    <DemoContent 
                      type={view.type} 
                      view={view} 
                      updateView={(data) => updateView(view.id, data)}
                      raName={currentUser}
                      isResizing={isResizing}
                      resizingViewId={resizingViewId} 
                    />
                  </div>

                  {/* Resize Handles - only show in edit mode */}
                  {editMode && (
                    <>
                      {/* Corner handles */}
                      {/* Top-left corner */}
                      <div 
                        className="absolute -top-1.5 -left-1.5 w-4 h-4 cursor-nw-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(view.id, 'nw', e);
                        }}
                      >
                        <div className="w-4 h-4 bg-blue-500 hover:bg-blue-600 transition-all duration-150 ease-out rounded-full border-2 border-white dark:border-gray-800 shadow-lg hover:scale-110" />
                      </div>
                      
                      {/* Top-right corner */}
                      <div 
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 cursor-ne-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(view.id, 'ne', e);
                        }}
                      >
                        <div className="w-4 h-4 bg-blue-500 hover:bg-blue-600 transition-all duration-150 ease-out rounded-full border-2 border-white dark:border-gray-800 shadow-lg hover:scale-110" />
                      </div>
                      
                      {/* Bottom-left corner */}
                      <div 
                        className="absolute -bottom-1.5 -left-1.5 w-4 h-4 cursor-sw-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(view.id, 'sw', e);
                        }}
                      >
                        <div className="w-4 h-4 bg-blue-500 hover:bg-blue-600 transition-all duration-150 ease-out rounded-full border-2 border-white dark:border-gray-800 shadow-lg hover:scale-110" />
                      </div>
                      
                      {/* Bottom-right corner */}
                      <div 
                        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 cursor-se-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(view.id, 'se', e);
                        }}
                      >
                        <div className="w-4 h-4 bg-blue-500 hover:bg-blue-600 transition-all duration-150 ease-out rounded-full border-2 border-white dark:border-gray-800 shadow-lg hover:scale-110" />
                      </div>

                      {/* Side handles */}
                      {/* Top side */}
                      <div 
                        className="absolute -top-1 left-1/2 w-6 h-3 cursor-n-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(view.id, 'n', e);
                        }}
                      >
                        <div className="w-6 h-3 bg-blue-500 hover:bg-blue-600 transition-all duration-150 ease-out rounded-full border-2 border-white dark:border-gray-800 shadow-lg transform -translate-x-1/2 hover:scale-110" />
                      </div>
                      
                      {/* Right side */}
                      <div 
                        className="absolute -right-1 top-1/2 w-3 h-6 cursor-e-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(view.id, 'e', e);
                        }}
                      >
                        <div className="w-3 h-6 bg-blue-500 hover:bg-blue-600 transition-all duration-150 ease-out rounded-full border-2 border-white dark:border-gray-800 shadow-lg transform -translate-y-1/2 hover:scale-110" />
                      </div>
                      
                      {/* Bottom side */}
                      <div 
                        className="absolute -bottom-1 left-1/2 w-6 h-3 cursor-s-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(view.id, 's', e);
                        }}
                      >
                        <div className="w-6 h-3 bg-blue-500 hover:bg-blue-600 transition-all duration-150 ease-out rounded-full border-2 border-white dark:border-gray-800 shadow-lg transform -translate-x-1/2 hover:scale-110" />
                      </div>
                      
                      {/* Left side */}
                      <div 
                        className="absolute -left-1 top-1/2 w-3 h-6 cursor-w-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(view.id, 'w', e);
                        }}
                      >
                        <div className="w-3 h-6 bg-blue-500 hover:bg-blue-600 transition-all duration-150 ease-out rounded-full border-2 border-white dark:border-gray-800 shadow-lg transform -translate-y-1/2 hover:scale-110" />
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
        <div>
          Pan: {Math.round(-panOffset.x)}, {Math.round(-panOffset.y)} | Zoom: {Math.round(zoom * 100)}%
          {editMode && " | Edit Mode: Drag to move, resize from corner"}
          {!editMode && " | Drag to pan"}
        </div>
        <div>
          Dashboard Powered by <span className="font-bold">GLOSS</span>
        </div>
      </div>

      {/* Add View by ID Dialog */}
      {showAddById && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add View by ID</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter the ID of a view you want to copy to this page. You can get view IDs by clicking the share icon on any view.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">View ID</label>
                <input
                  type="number"
                  value={viewIdInput}
                  onChange={(e) => setViewIdInput(e.target.value)}
                  placeholder="Enter view ID..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddById(false);
                    setViewIdInput('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={addViewById}
                  disabled={!viewIdInput.trim()}
                >
                  Add View
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Floating Action Buttons - Bottom Right */}
      <div className="fixed bottom-16 right-8 z-[60]">
        {/* Edit Mode Toggle - Always at bottom */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                className="h-12 w-12 p-0 rounded-full shadow-lg"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Add View - only show in edit mode, positioned above lock button */}
        {editMode && (
          <div className="absolute bottom-16 right-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Popover open={addingView} onOpenChange={setAddingView}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-12 w-12 p-0 rounded-full shadow-lg">
                        <Plus className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2 w-80" align="end" side="left">
                      <div className="space-y-2">
                        {/* Add View by ID */}
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 h-10"
                            onClick={() => setShowAddById(true)}
                          >
                            <Copy className="h-4 w-4" />
                            <span>Add View by ID</span>
                          </Button>
                        </div>
                        
                        {/* View Types */}
                        <div className="grid grid-cols-2 gap-1">
                          {viewTypes.map((type) => (
                            <Button
                              key={type.id}
                              variant="ghost"
                              size="sm"
                              className={`justify-start gap-2 h-10 ${type.id === 'nl-interface' ? 'col-span-2' : ''}`}
                              onClick={() => addNewView(type.id)}
                            >
                              <type.icon className="h-4 w-4" />
                              <span className={type.id === 'nl-interface' ? '' : 'truncate'}>{type.title}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Add New View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

    </div>
  );
}