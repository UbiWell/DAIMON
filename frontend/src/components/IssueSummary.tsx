"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

type Status = "not started" | "in progress" | "resolved";

interface IssueSummaryProps {
  userId?: string;
  reason?: string;
  color?: string;
  onClose?: () => void;
  raName?: string;
  // Dashboard view props
  view?: any;
  updateView?: (data: any) => void;
  // Force creation mode (for DataTable)
  forceCreationMode?: boolean;
  // Pre-populate data (for preview mode)
  issueId?: string;
  status?: string;
  priority?: string;
  resolution?: string;
  troubleshootingSteps?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  // RA notes from CSV
  raNotes?: string;
  // Refresh callback for Issues Log
  onIssueSaved?: () => void;
}

interface PastIssue {
  id: string;
  date: string;
  summary: string;
  status: string;
}

// Helper function to convert notes to array format (handles both objects and JSON strings)
const convertNotesToArray = (notes: any): {notes: string, username: string, timestamp: number}[] => {
  console.log('=== convertNotesToArray DEBUG ===');
  console.log('Notes input:', notes);
  console.log('Notes type:', typeof notes);
  
  if (!notes) {
    console.log('No notes, returning empty array');
    return [];
  }
  
  let notesObj: any;
  
  // Handle both object and string formats
  if (typeof notes === 'string') {
    console.log('Notes is a string, parsing JSON...');
    try {
      notesObj = JSON.parse(notes);
      console.log('Parsed notes object:', notesObj);
    } catch (error) {
      console.error('Failed to parse notes JSON:', error);
      return [];
    }
  } else if (typeof notes === 'object') {
    console.log('Notes is already an object');
    notesObj = notes;
  } else {
    console.log('Invalid notes format, returning empty array');
    return [];
  }
  
  const parsedNotes: {notes: string, username: string, timestamp: number}[] = [];
  
  // Handle the notes object structure
  Object.values(notesObj).forEach((note: any, index: number) => {
    console.log(`Processing note ${index}:`, note);
    if (note && typeof note === 'object') {
      const parsedNote = {
        notes: note.content || note.notes || '',
        username: note.username || 'Unknown',
        timestamp: note.timestamp || 0
      };
      console.log(`Parsed note ${index}:`, parsedNote);
      parsedNotes.push(parsedNote);
    }
  });
  
  console.log('Final parsed notes array:', parsedNotes);
  
  // Sort by timestamp (oldest first)
  const sortedNotes = parsedNotes.sort((a, b) => a.timestamp - b.timestamp);
  console.log('Sorted notes:', sortedNotes);
  console.log('=== END convertNotesToArray DEBUG ===');
  
  return sortedNotes;
};

// Helper function to clean up API data (handle nan values, etc.)
const cleanApiValue = (value: any): string => {
  if (value === null || value === undefined || value === 'nan' || value === 'NaN') {
    return '';
  }
  return String(value);
};

export default function IssueSummary({ userId: propUserId, reason: propReason, color: propColor, onClose, raName, view, updateView, forceCreationMode, issueId: propIssueId, status: propStatus, priority: propPriority, resolution: propResolution, troubleshootingSteps: propTroubleshootingSteps, createdAt: propCreatedAt, updatedAt: propUpdatedAt, createdBy: propCreatedBy, raNotes: propRaNotes, onIssueSaved }: IssueSummaryProps) {
  try {
  console.log('=== IssueSummary Component Props ===');
  console.log('propUserId:', propUserId);
  console.log('propReason:', propReason);
  console.log('propColor:', propColor);
  console.log('propIssueId:', propIssueId);
  console.log('propStatus:', propStatus);
  console.log('propPriority:', propPriority);
  console.log('propResolution:', propResolution);
  console.log('propTroubleshootingSteps:', propTroubleshootingSteps);
  console.log('propCreatedAt:', propCreatedAt);
  console.log('propUpdatedAt:', propUpdatedAt);
  console.log('propCreatedBy:', propCreatedBy);
  console.log('propRaNotes:', propRaNotes);
  console.log('propRaNotes type:', typeof propRaNotes);
  console.log('=== END Props ===');
  
  // Determine if this is dashboard mode (no required props) or modal mode (has required props)
  // Also check if we're inside a parent modal (has view prop but also has userId/reason/color)
  const isInsideParentModal = view && propUserId && propReason && propColor;
  const isDashboardMode = !propUserId && !propReason && !propColor;
  // Force creation mode if specified (for DataTable)
  const isCreationMode = forceCreationMode || isDashboardMode;
  
  // State for creation mode (dashboard)
  const [userId, setUserId] = useState<string>(propUserId || "");
  const [reason, setReason] = useState<string>(propReason || "");
  const [color, setColor] = useState<string>(propColor || "yellow");
  
  const [issueId, setIssueId] = useState<string>(propIssueId || "");
  const [status, setStatus] = useState<Status>((propStatus as Status) || "not started");
  const [emailText, setEmailText] = useState("");
  const [raInput, setRaInput] = useState("");
  const [raMessages, setRaMessages] = useState<{notes: string, username: string, timestamp: number}[]>(() => {
    console.log('=== RA Messages State Initialization ===');
    console.log('propRaNotes for state:', propRaNotes);
    console.log('propRaNotes type:', typeof propRaNotes);
    
    let result: {notes: string, username: string, timestamp: number}[] = [];
    
    if (propRaNotes) {
      if (typeof propRaNotes === 'string') {
        console.log('propRaNotes is a string, parsing...');
        try {
          const parsedNotes = JSON.parse(propRaNotes);
          result = convertNotesToArray(parsedNotes);
        } catch (error) {
          console.error('Failed to parse propRaNotes string:', error);
          result = [];
        }
      } else if (typeof propRaNotes === 'object') {
        console.log('propRaNotes is an object, converting...');
        result = convertNotesToArray(propRaNotes);
      }
    }
    
    console.log('RA messages result:', result);
    console.log('=== END RA Messages State ===');
    return result;
  });
  const [isCreated, setIsCreated] = useState(!isCreationMode || !!propIssueId); // If in creation mode, start with not created, unless we have an issueId
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [pastIssues, setPastIssues] = useState<PastIssue[]>([]);
  const [isLoadingPastIssues, setIsLoadingPastIssues] = useState(false);
  const [troubleshootingSteps, setTroubleshootingSteps] = useState<string>(cleanApiValue(propTroubleshootingSteps));
  const [isGeneratingTroubleshooting, setIsGeneratingTroubleshooting] = useState(false);
  const [priority, setPriority] = useState<string>(cleanApiValue(propPriority) || 'not decided');
  const [resolutionText, setResolutionText] = useState<string>(cleanApiValue(propResolution));
  const [isSaving, setIsSaving] = useState(false);
  const [editableReason, setEditableReason] = useState<string>('');
  const [editableColor, setEditableColor] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>(propCreatedAt || '');
  const [updatedAt, setUpdatedAt] = useState<string>(propUpdatedAt || '');
  const [createdBy, setCreatedBy] = useState<string>(propCreatedBy || '');
  const [selectedPastIssue, setSelectedPastIssue] = useState<PastIssue | null>(null);
  const [selectedPastIssueDetails, setSelectedPastIssueDetails] = useState<any>(null);
  const [showPastIssuePreview, setShowPastIssuePreview] = useState(false);
  const [loadingPastIssueDetails, setLoadingPastIssueDetails] = useState(false);

  const colorOptions = [
    { value: 'red', label: 'Red Flag', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    { value: 'yellow', label: 'Yellow Flag', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { value: 'green', label: 'Green Flag', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
  ];

  const priorityOptions = [
    { value: 'not decided', label: 'Not Decided', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
  ];

  const handlePriorityChange = async (newPriority: string) => {
    setPriority(newPriority);
    // TODO: Add API call to update priority on the server
    console.log('Priority updated to:', newPriority);
  };

  const handleResolutionChange = async (resolution: string) => {
    setResolutionText(resolution);
    // TODO: Add API call to update resolution on the server
    console.log('Resolution updated:', resolution);
  };

  const formatTimestamp = (timestamp: string | number) => {
    if (!timestamp) return '';
    try {
      let date: Date;
      
      // Handle Unix timestamp (seconds or milliseconds)
      if (typeof timestamp === 'number' || /^\d+$/.test(timestamp.toString())) {
        const numTimestamp = typeof timestamp === 'number' ? timestamp : parseInt(timestamp);
        // If timestamp is in seconds (10 digits), convert to milliseconds
        if (numTimestamp.toString().length === 10) {
          date = new Date(numTimestamp * 1000);
        } else {
          // Assume it's already in milliseconds
          date = new Date(numTimestamp);
        }
      } else {
        // Handle ISO string
        date = new Date(timestamp);
      }
      
      // Use Intl.DateTimeFormat to properly handle EST/EDT
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      });
      
      const formatted = formatter.format(date);
      
      // Check if it's daylight saving time
      const isDST = date.toLocaleString('en-US', { timeZone: 'America/New_York' }).includes('EDT');
      const timezoneLabel = isDST ? 'EDT' : 'EST';
      
      return formatted + ' ' + timezoneLabel;
    } catch (error) {
      return timestamp.toString();
    }
  };

  const formatRaNoteTimestamp = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp * 1000);
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York'
      });
      const formatted = formatter.format(date);
      const isDST = date.getTimezoneOffset() < new Date().getTimezoneOffset();
      return `${formatted} ${isDST ? 'EDT' : 'EST'}`;
    } catch (error) {
      return 'Invalid date';
    }
  };


  const handleSaveIssue = async () => {
    if (!issueId) {
      console.error('No issue ID available for saving');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/issues/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issueId,
          status,
          priority,
          resolution: resolutionText,
          raNotes: raMessages,
          raName: raName || '',
          reason: editableReason,
          color: editableColor
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Issue updated successfully:', result);
      
      // Update the updatedAt timestamp if provided in response
      if (result.timestamp) {
        setUpdatedAt(result.timestamp);
      }
      
      // Trigger refresh callback if provided (for Issues Log)
      if (onIssueSaved) {
        onIssueSaved();
      }
      
      // Show success message (you could add a toast notification here)
      alert('Issue updated successfully!');
    } catch (error) {
      console.error('Failed to update issue:', error);
      alert('Failed to update issue. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize editable values when component mounts
  useEffect(() => {
    setEditableReason(reason);
    setEditableColor(color);
  }, [reason, color]);

  // Note: Past issues are now fetched manually via the Generate button
  // Removed automatic fetching to give users control over when to fetch

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailText);
      alert("Copied to clipboard.");
    } catch {
      alert("Copy failed.");
    }
  };

  const sendRaNote = () => {
    if (!raInput.trim()) return;
    setRaMessages((prev) => [...prev, {
      notes: raInput.trim(),
      username: raName || 'Unknown User',
      timestamp: Math.floor(Date.now() / 1000) // Unix timestamp in seconds
    }]);
    setRaInput("");
  };

  const createIssue = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/issues/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          reason: editableReason,
          potentialPastIssues: [], // TODO: Add actual past issues data
          color: editableColor,
          raName: raName || ''
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setIssueId(result.issueId || `issue_${userId}_${Date.now()}`);
      setCreatedAt(result.timestamp || new Date().toISOString());
      setCreatedBy(raName || 'Unknown User');
      setIsCreated(true);
      
      // Trigger refresh callback if provided (for Issues Log)
      if (onIssueSaved) {
        onIssueSaved();
      }
    } catch (error) {
      console.error('Failed to create issue:', error);
      alert('Failed to create issue. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const fetchPastIssues = async () => {
    console.log('fetchPastIssues called with:', { issueId, editableReason, reason });
    
    // Don't fetch if we don't have the required data
    if (!issueId || (!editableReason && !reason)) {
      console.log('Skipping past issues fetch - missing issueId or reason');
      return;
    }

    console.log('Starting past issues fetch...');
    setIsLoadingPastIssues(true);
    try {
      const response = await fetch('/api/issues/past-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: editableReason || reason || '',
          issueId: issueId || ''
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Past issues API response:', result);
      
      // Safety check for result structure
      if (!result || typeof result !== 'object') {
        console.error('Invalid API response structure:', result);
        setPastIssues([]);
        return;
      }
      
      // Transform the array of issue objects into PastIssue objects
      const pastIssuesArray = result.past_issues || [];
      console.log('Past issues array:', pastIssuesArray);
      
      if (!Array.isArray(pastIssuesArray)) {
        console.error('past_issues is not an array:', pastIssuesArray);
        setPastIssues([]);
        return;
      }
      
      const pastIssuesData = pastIssuesArray.map((issue: any, index: number) => {
        console.log(`Processing issue ${index}:`, issue);
        return {
          id: issue?.id || `Unknown_${index}`,
          date: issue?.created_at || 'N/A',
          summary: issue?.summary || 'Past issue',
          status: issue?.status || 'Unknown'
        };
      });
      
      console.log('Transformed past issues:', pastIssuesData);
      setPastIssues(pastIssuesData);
    } catch (error) {
      console.error('Failed to fetch past issues:', error);
      // Silently fail - just keep pastIssues empty
      setPastIssues([]);
    } finally {
      setIsLoadingPastIssues(false);
    }
  };

  const fetchPastIssueDetails = async (issueId: string) => {
    setLoadingPastIssueDetails(true);
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the raw response text first to handle NaN values
      const responseText = await response.text();
      console.log('Raw API response:', responseText);
      
      // Clean up NaN values before parsing JSON
      const cleanedResponse = responseText.replace(/:\s*NaN\s*([,}])/g, ': null$1');
      console.log('Cleaned response:', cleanedResponse);
      
      const result = JSON.parse(cleanedResponse);
      console.log('Past issue details API response:', result);
      
      if (result.success && result.issue) {
        const issue = result.issue;
        
        // Parse notes if they're a JSON string
        let parsedNotes = {};
        if (issue.notes) {
          if (typeof issue.notes === 'string') {
            try {
              parsedNotes = JSON.parse(issue.notes);
              console.log('Parsed notes for past issue:', parsedNotes);
            } catch (error) {
              console.error('Failed to parse notes for past issue:', error);
              parsedNotes = {};
            }
          } else if (typeof issue.notes === 'object') {
            parsedNotes = issue.notes;
          }
        }
        
        // Format the timestamp (handles both string and number formats)
  const formatTimestamp = (timestamp: string | number) => {
    if (!timestamp) return 'N/A';
    try {
      let date: Date;
      
      // Handle different timestamp formats
      if (typeof timestamp === 'string') {
        // String format: "2024-01-15 10:30:45"
        date = new Date(timestamp);
      } else {
        // Unix timestamp format
        date = new Date(timestamp * 1000);
      }
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York'
      });
      const formatted = formatter.format(date);
      const isDST = date.getTimezoneOffset() < new Date().getTimezoneOffset();
      return `${formatted} ${isDST ? 'EDT' : 'EST'}`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatRaNoteTimestamp = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp * 1000);
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York'
      });
      const formatted = formatter.format(date);
      const isDST = date.getTimezoneOffset() < new Date().getTimezoneOffset();
      return `${formatted} ${isDST ? 'EDT' : 'EST'}`;
    } catch (error) {
      return 'Invalid date';
    }
  };
        
        setSelectedPastIssue({
          id: issue.id || issueId,
          date: formatTimestamp(issue.created_at),
          summary: issue.summary || 'No summary available',
          status: issue.status || 'Unknown'
        });
        setSelectedPastIssueDetails({
          ...issue,
          notes: parsedNotes // Use parsed notes instead of raw string
        });
        setShowPastIssuePreview(true);
      } else {
        throw new Error(result.message || 'Failed to fetch issue details');
      }
    } catch (error) {
      console.error('Failed to fetch past issue details:', error);
      alert('Failed to fetch issue details. Please try again.');
    } finally {
      setLoadingPastIssueDetails(false);
    }
  };

  const handlePastIssueClick = (issueId: string) => {
    fetchPastIssueDetails(issueId);
  };

  const handleClosePastIssuePreview = () => {
    setShowPastIssuePreview(false);
    setSelectedPastIssue(null);
    setSelectedPastIssueDetails(null);
  };

  const generateEmail = async () => {
    setIsGeneratingEmail(true);
    try {
      const requestBody = {
        userId,
        reason: editableReason,
        raName: raName || '',
        troubleshootingSteps: troubleshootingSteps,
        raNotes: raMessages
      };
      
      console.log('Generating email with data:', requestBody);
      
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Email generation response status:', response.status);
      console.log('Email generation response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email generation failed with response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      console.log('Email generation result:', result);
      setEmailText(result.email || '');
    } catch (error) {
      console.error('Failed to generate email:', error);
      alert(`Failed to generate email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const generateTroubleshootingSteps = async () => {
    setIsGeneratingTroubleshooting(true);
    try {
      const response = await fetch('/api/generate-troubleshooting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          reason: editableReason,
          color: editableColor,
          issueId: issueId || `issue_${userId}_${Date.now()}`,
          raName: raName || ''
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setTroubleshootingSteps(result.troubleshootingSteps || '');
    } catch (error) {
      console.error('Failed to generate troubleshooting steps:', error);
      alert('Failed to generate troubleshooting steps. Please try again.');
    } finally {
      setIsGeneratingTroubleshooting(false);
    }
  };

  // Dashboard mode - no modal wrapper
  if (isDashboardMode) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Issue Creation Form */}
          {!isCreated && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Issue</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    User ID *
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter user ID"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Flag Color *
                  </label>
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  >
                    {colorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Issue Reason *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
              </div>
              <button
                onClick={createIssue}
                disabled={isCreating || !userId.trim() || !reason.trim()}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating Issue...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Issue
                  </>
                )}
              </button>
            </div>
          )}

          {/* Issue Management Section - Only show after creation */}
          {isCreated && (
            <div className="flex gap-6">
              {/* Main Content */}
              <div className="flex-1 space-y-6">
                {/* Issue ID and Status */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-lg">
                    <span className="font-medium text-gray-900 dark:text-white">Issue ID:</span>{" "}
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {issueId || "Not created yet"}
                    </span>
                  </div>
                  <div className="text-lg">
                    <span className="font-medium text-gray-900 dark:text-white">User ID:</span>{" "}
                    <span className="font-mono text-gray-700 dark:text-gray-300">{userId}</span>
                  </div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Status:
                    <select
                      className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as Status)}
                    >
                      <option value="not started">not started</option>
                      <option value="in progress">in progress</option>
                      <option value="resolved">resolved</option>
                    </select>
                  </label>
                <label className="text-base font-medium text-gray-900 dark:text-white">
                  Priority:
                  <select
                    className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base"
                      value={priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={handleSaveIssue}
                    disabled={isSaving}
                    className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg shadow-sm transition-colors font-medium flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Issue
                      </>
                    )}
                  </button>
                </div>

                {/* Resolution Text Box - only show when status is resolved */}
                {status === 'resolved' && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-green-50 dark:bg-green-900/20">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Resolution Details</h3>
                    <textarea
                      placeholder="Describe how this issue was resolved..."
                      value={resolutionText}
                      onChange={(e) => handleResolutionChange(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[100px] max-h-[200px] focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={4}
                    />
                  </div>
                )}

                {/* Summary */}
                <div>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">Issue Summary</h3>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Flag:
                          <select
                            className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            value={editableColor}
                            onChange={(e) => setEditableColor(e.target.value)}
                          >
                            {colorOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    {/* Timestamps */}
                    <div className="flex items-center gap-4 mb-3 text-base text-gray-500 dark:text-gray-400">
                      {createdAt && (
                        <span>Created at: {formatTimestamp(createdAt)}</span>
                      )}
                      {createdBy && (
                        <span>Created by: {createdBy}</span>
                      )}
                      {updatedAt && (
                        <span>Updated at: {formatTimestamp(updatedAt)}</span>
                      )}
                    </div>
                    <textarea
                      value={editableReason}
                      onChange={(e) => setEditableReason(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[80px] max-h-[200px] focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      rows={3}
                      placeholder="Describe the issue..."
                    />
                    <div className="mt-2">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        editableColor === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        editableColor === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {editableColor.toUpperCase()} FLAG
                      </span>
                    </div>
                  </div>
                </div>

                {/* Troubleshooting Steps */}
                <div>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Troubleshooting Steps</h3>
                      <button
                        onClick={generateTroubleshootingSteps}
                        disabled={isGeneratingTroubleshooting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl shadow-sm transition-colors text-sm font-medium"
                      >
                        {isGeneratingTroubleshooting ? 'Generating...' : 'Generate'}
                      </button>
                    </div>
                    {troubleshootingSteps ? (
                      <textarea
                        value={troubleshootingSteps}
                        onChange={(e) => setTroubleshootingSteps(e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[100px] max-h-[300px] focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                        rows={6}
                        placeholder="Troubleshooting steps will appear here..."
                      />
                    ) : (
                      <div className="text-base text-gray-500 dark:text-gray-400 italic">
                        Click "Generate" to create troubleshooting steps for this issue.
                      </div>
                    )}
                  </div>
                </div>

                {/* Potential past issues */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Past Similar Issues</h3>
                    <button
                      onClick={fetchPastIssues}
                      disabled={isLoadingPastIssues}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {isLoadingPastIssues ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Loading...
                        </>
                      ) : (
                        'Generate'
                      )}
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-2xl shadow">
                    <table className="min-w-full text-base">
                      <tbody>
                        <tr className="bg-gray-100 dark:bg-gray-600 text-left">
                          <th className="px-4 py-2 text-gray-900 dark:text-white">Issue ID</th>
                          <th className="px-4 py-2 text-gray-900 dark:text-white">Date</th>
                          <th className="px-4 py-2 text-gray-900 dark:text-white">Summary</th>
                          <th className="px-4 py-2 text-gray-900 dark:text-white">Status</th>
                        </tr>
                        {pastIssues.length === 0 ? (
                          <tr className="border-t border-gray-200 dark:border-gray-600">
                            <td className="px-4 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                              {isLoadingPastIssues ? 'Loading past issues...' : 'No past issues found.'}
                            </td>
                          </tr>
                        ) : (
                          pastIssues.map((issue) => (
                            <tr key={issue.id} className="border-t border-gray-200 dark:border-gray-600">
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">
                                <button
                                  onClick={() => handlePastIssueClick(issue.id)}
                                  disabled={loadingPastIssueDetails}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="View issue details"
                                >
                                  {loadingPastIssueDetails ? 'Loading...' : issue.id}
                                </button>
                              </td>
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{issue.date}</td>
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{issue.summary}</td>
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  issue.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                  issue.status === 'in progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                }`}>
                                  {issue.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Email sender */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xl font-semibold text-gray-900 dark:text-white">Send Email to Participant:</div>
                    <button
                      onClick={generateEmail}
                      disabled={isGeneratingEmail}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl shadow-sm transition-colors text-sm font-medium"
                    >
                      {isGeneratingEmail ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                  <textarea
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 min-h-[120px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
                    placeholder={emailText ? '' : "Click generate to draft an email"}
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={copyEmail}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-blue-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* RA Notes Sidebar */}
              <aside className="w-96 flex-shrink-0">
                <div className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm p-4">
                  <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">RA Notes</h2>
                  {!isCreated ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <div className="text-base">RA notes will be available after issue creation</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-64 overflow-y-scroll space-y-2 border border-gray-200 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 mb-3 ra-notes-scroll" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9ca3af #f3f4f6' }}>
                        <style>{`
                          .ra-notes-scroll::-webkit-scrollbar {
                            width: 12px !important;
                            display: block !important;
                          }
                          .ra-notes-scroll::-webkit-scrollbar-track {
                            background: #f3f4f6 !important;
                            border-radius: 6px !important;
                            border: 1px solid #e5e7eb !important;
                            box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1) !important;
                          }
                          .ra-notes-scroll::-webkit-scrollbar-thumb {
                            background: #9ca3af !important;
                            border-radius: 6px !important;
                            border: 1px solid #e5e7eb !important;
                          }
                          .ra-notes-scroll::-webkit-scrollbar-thumb:hover {
                            background: #6b7280 !important;
                          }
                          .dark .ra-notes-scroll::-webkit-scrollbar-track {
                            background: #374151 !important;
                            border-color: #4b5563 !important;
                          }
                          .dark .ra-notes-scroll::-webkit-scrollbar-thumb {
                            background: #6b7280 !important;
                            border-color: #4b5563 !important;
                          }
                          .dark .ra-notes-scroll::-webkit-scrollbar-thumb:hover {
                            background: #9ca3af !important;
                          }
                          .ra-notes-scroll {
                            scrollbar-gutter: stable !important;
                          }
                        `}</style>
                        {(() => {
                          console.log('=== RA Messages Rendering ===');
                          console.log('raMessages length:', raMessages.length);
                          console.log('raMessages:', raMessages);
                          raMessages.forEach((msg, idx) => {
                            console.log(`Message ${idx}:`, msg);
                          });
                          console.log('=== END RA Messages Rendering ===');
                          return null;
                        })()}
                        {raMessages.length === 0 ? (
                          <div className="text-base text-gray-500 dark:text-gray-400">No notes yet.</div>
                        ) : (
                          raMessages.map((message, idx) => (
                            <div
                              key={idx}
                              className="w-fit max-w-[85%] rounded-xl px-3 py-2 bg-white dark:bg-gray-600 shadow text-base break-words whitespace-pre-wrap overflow-hidden text-gray-900 dark:text-white"
                            >
                              <div className="mb-1">{message.notes}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 text-right">
                                - {message.username} • {formatRaNoteTimestamp(message.timestamp)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        <textarea
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none min-h-[100px] text-base"
                          placeholder="Type a note…"
                          value={raInput}
                          onChange={(e) => setRaInput(e.target.value)}
                          rows={4}
                        />
                        <button
                          onClick={sendRaNote}
                          className="whitespace-nowrap px-4 py-2 rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors self-end"
                        >
                          Send
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Modal mode - original behavior
  // If we're inside a parent modal (like IssuesLog), don't render our own modal wrapper
  if (isInsideParentModal) {
    // Return just the content without modal wrapper or header (header is in IssuesLog)
    return (
      <div className="h-full w-full overflow-y-scroll issue-summary-content" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9ca3af #f3f4f6' }}>
        <style>{`
          .issue-summary-content::-webkit-scrollbar {
            width: 12px !important;
            display: block !important;
          }
          .issue-summary-content::-webkit-scrollbar-track {
            background: #f3f4f6 !important;
            border-radius: 6px !important;
            border: 1px solid #e5e7eb !important;
            box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1) !important;
          }
          .issue-summary-content::-webkit-scrollbar-thumb {
            background: #9ca3af !important;
            border-radius: 6px !important;
            border: 1px solid #e5e7eb !important;
          }
          .issue-summary-content::-webkit-scrollbar-thumb:hover {
            background: #6b7280 !important;
          }
          .dark .issue-summary-content::-webkit-scrollbar-track {
            background: #374151 !important;
            border-color: #4b5563 !important;
          }
          .dark .issue-summary-content::-webkit-scrollbar-thumb {
            background: #6b7280 !important;
            border-color: #4b5563 !important;
          }
          .dark .issue-summary-content::-webkit-scrollbar-thumb:hover {
            background: #9ca3af !important;
          }
          .issue-summary-content {
            scrollbar-gutter: stable !important;
          }
        `}</style>
        {/* Content - no header, no modal wrapper */}
        <div className="flex gap-6 p-6 items-start">
          {/* Left main content */}
          <div className="flex-1 flex flex-col">
            <div className="flex flex-col space-y-6">
              {/* Issue Creation Form - only show in creation mode */}
              {!isCreated && isCreationMode && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-blue-50 dark:bg-blue-900/20">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create New Issue</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                        User ID *
                      </label>
                      <input
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="Enter user ID"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Flag Color *
                      </label>
                      <select
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      >
                        {colorOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Issue Reason *
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Describe the issue..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y text-base"
                    />
                  </div>
                  <button
                    onClick={createIssue}
                    disabled={isCreating || !userId.trim() || !reason.trim()}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creating Issue...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Issue
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Issue Management Section - Only show after creation */}
              {isCreated && (
                <>
                  {/* Issue ID and Status */}
                  <div className="flex items-center gap-4 flex-wrap">
                <div className="text-xl">
                  <span className="font-medium text-gray-900 dark:text-white">Issue ID:</span>{" "}
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {issueId || "Not created yet"}
                  </span>
                </div>
                <div className="text-xl">
                  <span className="font-medium text-gray-900 dark:text-white">User ID:</span>{" "}
                  <span className="font-mono text-gray-700 dark:text-gray-300">{userId}</span>
                </div>
                <label className="text-base font-medium text-gray-900 dark:text-white">
                  Status:
                  <select
                    className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Status)}
                    disabled={!isCreated}
                  >
                    <option value="not started">not started</option>
                    <option value="in progress">in progress</option>
                    <option value="resolved">resolved</option>
                  </select>
                </label>
                {isCreated && (
                <label className="text-base font-medium text-gray-900 dark:text-white">
                  Priority:
                  <select
                    className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base"
                      value={priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {isCreated && (
                  <button
                    onClick={handleSaveIssue}
                    disabled={isSaving}
                    className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg shadow-sm transition-colors font-medium flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Issue
                      </>
                    )}
                  </button>
                )}
                {!isCreated && (
                  <button
                    onClick={createIssue}
                    disabled={isCreating}
                    className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium"
                  >
                    {isCreating ? 'Creating...' : 'Create Issue'}
                  </button>
                )}
              </div>

              {/* Resolution Text Box - only show when status is resolved */}
              {isCreated && status === 'resolved' && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-green-50 dark:bg-green-900/20">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Resolution Details</h3>
                  <textarea
                    placeholder="Describe how this issue was resolved..."
                    value={resolutionText}
                    onChange={(e) => handleResolutionChange(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[100px] max-h-[200px] focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={4}
                  />
                </div>
              )}

              {/* Summary */}
              <div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">Issue Summary</h3>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Flag:
                        <select
                          className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          value={editableColor}
                          onChange={(e) => setEditableColor(e.target.value)}
                        >
                          {colorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <textarea
                    value={editableReason}
                    onChange={(e) => setEditableReason(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[80px] max-h-[200px] focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={3}
                    placeholder="Describe the issue..."
                  />
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      editableColor === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      editableColor === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {editableColor.toUpperCase()} FLAG
                    </span>
                  </div>
                </div>
              </div>

              {/* Troubleshooting Steps */}
              <div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">Troubleshooting Steps</h3>
                    <button
                      onClick={generateTroubleshootingSteps}
                      disabled={isGeneratingTroubleshooting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl shadow-sm transition-colors text-sm font-medium"
                    >
                      {isGeneratingTroubleshooting ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                  {troubleshootingSteps ? (
                    <textarea
                      value={troubleshootingSteps}
                      onChange={(e) => setTroubleshootingSteps(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[100px] max-h-[300px] focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      rows={6}
                      placeholder="Troubleshooting steps will appear here..."
                    />
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Click "Generate" to create troubleshooting steps for this issue.
                    </div>
                  )}
                </div>
              </div>

              {/* Potential past issues */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Potential Past Issues</h3>
                  <button
                    onClick={fetchPastIssues}
                    disabled={isLoadingPastIssues}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {isLoadingPastIssues ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      'Generate'
                    )}
                  </button>
                </div>
                <div className="overflow-x-auto rounded-2xl shadow">
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr className="bg-gray-100 dark:bg-gray-600 text-left">
                        <th className="px-4 py-2 text-gray-900 dark:text-white">Issue ID</th>
                        <th className="px-4 py-2 text-gray-900 dark:text-white">Date</th>
                        <th className="px-4 py-2 text-gray-900 dark:text-white">Summary</th>
                        <th className="px-4 py-2 text-gray-900 dark:text-white">Status</th>
                      </tr>
                      {pastIssues.length === 0 ? (
                        <tr className="border-t border-gray-200 dark:border-gray-600">
                          <td className="px-4 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                            {isLoadingPastIssues ? 'Loading past issues...' : 'No past issues found.'}
                          </td>
                        </tr>
                      ) : (
                        pastIssues.map((issue) => (
                          <tr key={issue.id} className="border-t border-gray-200 dark:border-gray-600">
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">
                              <button
                                onClick={() => handlePastIssueClick(issue.id)}
                                disabled={loadingPastIssueDetails}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                title="View issue details"
                              >
                                {loadingPastIssueDetails ? 'Loading...' : issue.id}
                              </button>
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{issue.date}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{issue.summary}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                issue.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                issue.status === 'in progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                              }`}>
                                {issue.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Email sender */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">Send Email to Participant:</div>
                  <button
                    onClick={generateEmail}
                    disabled={isGeneratingEmail}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl shadow-sm transition-colors text-sm font-medium"
                  >
                    {isGeneratingEmail ? 'Generating...' : 'Generate'}
                  </button>
                </div>
                <textarea
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 h-[360px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 email-textarea-scroll text-base"
                  style={{ 
                    overflowY: 'scroll',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#9ca3af #f3f4f6'
                  }}
                  placeholder={emailText ? '' : "Click generate to draft an email"}
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                />
                <style>{`
                  .email-textarea-scroll::-webkit-scrollbar {
                    width: 12px !important;
                    display: block !important;
                  }
                  .email-textarea-scroll::-webkit-scrollbar-track {
                    background: #f3f4f6 !important;
                    border-radius: 6px !important;
                    border: 1px solid #e5e7eb !important;
                    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1) !important;
                  }
                  .email-textarea-scroll::-webkit-scrollbar-thumb {
                    background: #9ca3af !important;
                    border-radius: 6px !important;
                    border: 1px solid #e5e7eb !important;
                  }
                  .email-textarea-scroll::-webkit-scrollbar-thumb:hover {
                    background: #6b7280 !important;
                  }
                  .dark .email-textarea-scroll::-webkit-scrollbar-track {
                    background: #374151 !important;
                    border-color: #4b5563 !important;
                  }
                  .dark .email-textarea-scroll::-webkit-scrollbar-thumb {
                    background: #6b7280 !important;
                    border-color: #4b5563 !important;
                  }
                  .dark .email-textarea-scroll::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af !important;
                  }
                  .email-textarea-scroll {
                    scrollbar-gutter: stable !important;
                  }
                `}</style>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={copyEmail}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
                </>
              )}
            </div>
          </div>

          {/* RA Notes */}
          <aside className="w-96 flex-shrink-0">
            <div className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm p-4">
              <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">RA Notes</h2>
              {!isCreated ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <div className="text-base">RA notes will be available after issue creation</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-scroll space-y-2 border border-gray-200 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 mb-3 ra-notes-scroll" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9ca3af #f3f4f6' }}>
                    <style>{`
                      .ra-notes-scroll::-webkit-scrollbar {
                        width: 12px !important;
                        display: block !important;
                      }
                      .ra-notes-scroll::-webkit-scrollbar-track {
                        background: #f3f4f6 !important;
                        border-radius: 6px !important;
                        border: 1px solid #e5e7eb !important;
                        box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1) !important;
                      }
                      .ra-notes-scroll::-webkit-scrollbar-thumb {
                        background: #9ca3af !important;
                        border-radius: 6px !important;
                        border: 1px solid #e5e7eb !important;
                      }
                      .ra-notes-scroll::-webkit-scrollbar-thumb:hover {
                        background: #6b7280 !important;
                      }
                      .dark .ra-notes-scroll::-webkit-scrollbar-track {
                        background: #374151 !important;
                        border-color: #4b5563 !important;
                      }
                      .dark .ra-notes-scroll::-webkit-scrollbar-thumb {
                        background: #6b7280 !important;
                        border-color: #4b5563 !important;
                      }
                      .dark .ra-notes-scroll::-webkit-scrollbar-thumb:hover {
                        background: #9ca3af !important;
                      }
                      .ra-notes-scroll {
                        scrollbar-gutter: stable !important;
                      }
                    `}</style>
                    {(() => {
                      console.log('=== RA Messages Rendering (Modal) ===');
                      console.log('raMessages length:', raMessages.length);
                      console.log('raMessages:', raMessages);
                      raMessages.forEach((msg, idx) => {
                        console.log(`Message ${idx}:`, msg);
                      });
                      console.log('=== END RA Messages Rendering (Modal) ===');
                      return null;
                    })()}
                    {raMessages.length === 0 ? (
                      <div className="text-base text-gray-500 dark:text-gray-400">No notes yet.</div>
                    ) : (
                      raMessages.map((message, idx) => (
                        <div
                          key={idx}
                          className="w-fit max-w-[85%] rounded-xl px-3 py-2 bg-white dark:bg-gray-600 shadow text-base break-words whitespace-pre-wrap overflow-hidden text-gray-900 dark:text-white"
                        >
                          <div className="mb-1">{message.notes}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 text-right">
                            - {message.username} • {formatRaNoteTimestamp(message.timestamp)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none min-h-[100px] text-base"
                      placeholder="Type a note…"
                      value={raInput}
                      onChange={(e) => setRaInput(e.target.value)}
                      rows={4}
                    />
                    <button
                      onClick={sendRaNote}
                      className="whitespace-nowrap px-4 py-2 rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors self-end"
                    >
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Regular modal mode - with full modal wrapper
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl mt-8 mb-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Issue Summary</h1>
              {/* Timestamps */}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                {createdAt && (
                  <span>Created at: {formatTimestamp(createdAt)}</span>
                )}
                {createdBy && (
                  <span>Created by: {createdBy}</span>
                )}
                {updatedAt && (
                  <span>Updated at: {formatTimestamp(updatedAt)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
            {isCreated && (
              <button
                onClick={handleSaveIssue}
                disabled={isSaving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg shadow-sm transition-colors font-medium flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Issue
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex gap-6 p-6 items-start">
          {/* Left main content */}
          <div className="flex-1 flex flex-col">
            <div className="flex flex-col space-y-6">
              {/* Issue Creation Form - only show in creation mode */}
              {!isCreated && isCreationMode && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-blue-50 dark:bg-blue-900/20">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create New Issue</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                        User ID *
                      </label>
                      <input
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="Enter user ID"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Flag Color *
                      </label>
                      <select
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      >
                        {colorOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Issue Reason *
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Describe the issue..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y text-base"
                    />
                  </div>
                  <button
                    onClick={createIssue}
                    disabled={isCreating || !userId.trim() || !reason.trim()}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creating Issue...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Issue
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Issue Management Section - Only show after creation */}
              {isCreated && (
                <>
                  {/* Issue ID and Status */}
                  <div className="flex items-center gap-4 flex-wrap">
                <div className="text-xl">
                  <span className="font-medium text-gray-900 dark:text-white">Issue ID:</span>{" "}
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {issueId || "Not created yet"}
                  </span>
                </div>
                <div className="text-xl">
                  <span className="font-medium text-gray-900 dark:text-white">User ID:</span>{" "}
                  <span className="font-mono text-gray-700 dark:text-gray-300">{userId}</span>
                </div>
                <label className="text-base font-medium text-gray-900 dark:text-white">
                  Status:
                  <select
                    className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Status)}
                    disabled={!isCreated}
                  >
                    <option value="not started">not started</option>
                    <option value="in progress">in progress</option>
                    <option value="resolved">resolved</option>
                  </select>
                </label>
                {isCreated && (
                <label className="text-base font-medium text-gray-900 dark:text-white">
                  Priority:
                  <select
                    className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base"
                      value={priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!isCreated && (
                  <button
                    onClick={createIssue}
                    disabled={isCreating}
                    className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium"
                  >
                    {isCreating ? 'Creating...' : 'Create Issue'}
                  </button>
                )}
              </div>

              {/* Resolution Text Box - only show when status is resolved */}
              {isCreated && status === 'resolved' && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-green-50 dark:bg-green-900/20">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Resolution Details</h3>
                  <textarea
                    placeholder="Describe how this issue was resolved..."
                    value={resolutionText}
                    onChange={(e) => handleResolutionChange(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[100px] max-h-[200px] focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={4}
                  />
                </div>
              )}

              {/* Summary */}
              <div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">Issue Summary</h3>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Flag:
                        <select
                          className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          value={editableColor}
                          onChange={(e) => setEditableColor(e.target.value)}
                        >
                          {colorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <textarea
                    value={editableReason}
                    onChange={(e) => setEditableReason(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[80px] max-h-[200px] focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={3}
                    placeholder="Describe the issue..."
                  />
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      editableColor === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      editableColor === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {editableColor.toUpperCase()} FLAG
                    </span>
                  </div>
                </div>
              </div>

              {/* Troubleshooting Steps */}
              <div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">Troubleshooting Steps</h3>
                    <button
                      onClick={generateTroubleshootingSteps}
                      disabled={isGeneratingTroubleshooting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl shadow-sm transition-colors text-sm font-medium"
                    >
                      {isGeneratingTroubleshooting ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                  {troubleshootingSteps ? (
                    <textarea
                      value={troubleshootingSteps}
                      onChange={(e) => setTroubleshootingSteps(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[100px] max-h-[300px] focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      rows={6}
                      placeholder="Troubleshooting steps will appear here..."
                    />
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Click "Generate" to create troubleshooting steps for this issue.
                    </div>
                  )}
                </div>
              </div>

              {/* Potential past issues */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Potential Past Issues</h3>
                  <button
                    onClick={fetchPastIssues}
                    disabled={isLoadingPastIssues}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {isLoadingPastIssues ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      'Generate'
                    )}
                  </button>
                </div>
                <div className="overflow-x-auto rounded-2xl shadow">
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr className="bg-gray-100 dark:bg-gray-600 text-left">
                        <th className="px-4 py-2 text-gray-900 dark:text-white">Issue ID</th>
                        <th className="px-4 py-2 text-gray-900 dark:text-white">Date</th>
                        <th className="px-4 py-2 text-gray-900 dark:text-white">Summary</th>
                        <th className="px-4 py-2 text-gray-900 dark:text-white">Status</th>
                      </tr>
                      {pastIssues.length === 0 ? (
                        <tr className="border-t border-gray-200 dark:border-gray-600">
                          <td className="px-4 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                            {isLoadingPastIssues ? 'Loading past issues...' : 'No past issues found.'}
                          </td>
                        </tr>
                      ) : (
                        pastIssues.map((issue) => (
                          <tr key={issue.id} className="border-t border-gray-200 dark:border-gray-600">
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">
                              <button
                                onClick={() => handlePastIssueClick(issue.id)}
                                disabled={loadingPastIssueDetails}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                title="View issue details"
                              >
                                {loadingPastIssueDetails ? 'Loading...' : issue.id}
                              </button>
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{issue.date}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{issue.summary}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                issue.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                issue.status === 'in progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                              }`}>
                                {issue.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Email sender */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">Send Email to Participant:</div>
                  <button
                    onClick={generateEmail}
                    disabled={isGeneratingEmail}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl shadow-sm transition-colors text-sm font-medium"
                  >
                    {isGeneratingEmail ? 'Generating...' : 'Generate'}
                  </button>
                </div>
                <textarea
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 h-[360px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 email-textarea-scroll text-base"
                  style={{ 
                    overflowY: 'scroll',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#9ca3af #f3f4f6'
                  }}
                  placeholder={emailText ? '' : "Click generate to draft an email"}
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                />
                <style>{`
                  .email-textarea-scroll::-webkit-scrollbar {
                    width: 12px !important;
                    display: block !important;
                  }
                  .email-textarea-scroll::-webkit-scrollbar-track {
                    background: #f3f4f6 !important;
                    border-radius: 6px !important;
                    border: 1px solid #e5e7eb !important;
                    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1) !important;
                  }
                  .email-textarea-scroll::-webkit-scrollbar-thumb {
                    background: #9ca3af !important;
                    border-radius: 6px !important;
                    border: 1px solid #e5e7eb !important;
                  }
                  .email-textarea-scroll::-webkit-scrollbar-thumb:hover {
                    background: #6b7280 !important;
                  }
                  .dark .email-textarea-scroll::-webkit-scrollbar-track {
                    background: #374151 !important;
                    border-color: #4b5563 !important;
                  }
                  .dark .email-textarea-scroll::-webkit-scrollbar-thumb {
                    background: #6b7280 !important;
                    border-color: #4b5563 !important;
                  }
                  .dark .email-textarea-scroll::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af !important;
                  }
                  .email-textarea-scroll {
                    scrollbar-gutter: stable !important;
                  }
                `}</style>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={copyEmail}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
                </>
              )}
            </div>
          </div>

          {/* RA Notes */}
          <aside className="w-96 flex-shrink-0">
            <div className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm p-4">
              <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">RA Notes</h2>
              {!isCreated ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <div className="text-base">RA notes will be available after issue creation</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-scroll space-y-2 border border-gray-200 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 mb-3 ra-notes-scroll" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9ca3af #f3f4f6' }}>
                    <style>{`
                      .ra-notes-scroll::-webkit-scrollbar {
                        width: 12px !important;
                        display: block !important;
                      }
                      .ra-notes-scroll::-webkit-scrollbar-track {
                        background: #f3f4f6 !important;
                        border-radius: 6px !important;
                        border: 1px solid #e5e7eb !important;
                        box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1) !important;
                      }
                      .ra-notes-scroll::-webkit-scrollbar-thumb {
                        background: #9ca3af !important;
                        border-radius: 6px !important;
                        border: 1px solid #e5e7eb !important;
                      }
                      .ra-notes-scroll::-webkit-scrollbar-thumb:hover {
                        background: #6b7280 !important;
                      }
                      .dark .ra-notes-scroll::-webkit-scrollbar-track {
                        background: #374151 !important;
                        border-color: #4b5563 !important;
                      }
                      .dark .ra-notes-scroll::-webkit-scrollbar-thumb {
                        background: #6b7280 !important;
                        border-color: #4b5563 !important;
                      }
                      .dark .ra-notes-scroll::-webkit-scrollbar-thumb:hover {
                        background: #9ca3af !important;
                      }
                      .ra-notes-scroll {
                        scrollbar-gutter: stable !important;
                      }
                    `}</style>
                    {(() => {
                      console.log('=== RA Messages Rendering (Modal) ===');
                      console.log('raMessages length:', raMessages.length);
                      console.log('raMessages:', raMessages);
                      raMessages.forEach((msg, idx) => {
                        console.log(`Message ${idx}:`, msg);
                      });
                      console.log('=== END RA Messages Rendering (Modal) ===');
                      return null;
                    })()}
                    {raMessages.length === 0 ? (
                      <div className="text-base text-gray-500 dark:text-gray-400">No notes yet.</div>
                    ) : (
                      raMessages.map((message, idx) => (
                        <div
                          key={idx}
                          className="w-fit max-w-[85%] rounded-xl px-3 py-2 bg-white dark:bg-gray-600 shadow text-base break-words whitespace-pre-wrap overflow-hidden text-gray-900 dark:text-white"
                        >
                          <div className="mb-1">{message.notes}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 text-right">
                            - {message.username} • {formatRaNoteTimestamp(message.timestamp)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none min-h-[100px] text-base"
                      placeholder="Type a note…"
                      value={raInput}
                      onChange={(e) => setRaInput(e.target.value)}
                      rows={4}
                    />
                    <button
                      onClick={sendRaNote}
                      className="whitespace-nowrap px-4 py-2 rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors self-end"
                    >
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Past Issue Preview Modal */}
      {showPastIssuePreview && selectedPastIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl mt-8 mb-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Past Issue Details</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Issue ID: {selectedPastIssue.id}</p>
                </div>
                <button
                  onClick={handleClosePastIssuePreview}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Issue Summary */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Issue Summary
                  </label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                    {selectedPastIssue.summary}
                  </div>
                </div>
                
                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedPastIssue.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        selectedPastIssue.status === 'in progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {selectedPastIssue.status}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Priority
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                      {selectedPastIssueDetails?.priority || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Severity
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedPastIssueDetails?.severity === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        selectedPastIssueDetails?.severity === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        selectedPastIssueDetails?.severity === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {selectedPastIssueDetails?.severity?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Created Date
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                      {selectedPastIssue.date}
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Assignee
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                      {selectedPastIssueDetails?.assignee || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      User ID
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100 font-mono text-sm">
                      {selectedPastIssueDetails?.uid || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Troubleshooting Steps */}
                {selectedPastIssueDetails?.troubleshooting_steps && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Troubleshooting Steps
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedPastIssueDetails.troubleshooting_steps}
                    </div>
                  </div>
                )}

                {/* Resolution */}
                {selectedPastIssueDetails?.resolution && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Resolution
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedPastIssueDetails.resolution}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedPastIssueDetails?.notes && Object.keys(selectedPastIssueDetails.notes).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      RA Notes
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                      {(() => {
                        // Convert notes object to array format for consistent rendering
                        const notesArray = convertNotesToArray(selectedPastIssueDetails.notes);
                        console.log('Past issue notes array:', notesArray);
                        
                        return (
                          <div className="space-y-3">
                            {notesArray.map((note, index) => (
                              <div key={index} className="border-l-2 border-blue-500 pl-3">
                                <div className="text-sm text-gray-900 dark:text-gray-100 mb-1">
                                  {note.notes}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  - {note.username} • {formatRaNoteTimestamp(note.timestamp)}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  } catch (error) {
    console.error('IssueSummary component error:', error);
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm mt-2">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Reload Page
        </button>
      </div>
    );
  }
}
