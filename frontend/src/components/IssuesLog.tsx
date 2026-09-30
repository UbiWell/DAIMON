"use client";
import { useState, useEffect } from "react";
import { FileText, Download, Eye, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import IssueSummary from "./IssueSummary";

interface IssuesLogProps {
  view: any;
  updateView: (data: any) => void;
  raName?: string;
}

interface IssueData {
  id: string;
  summary: string;
  status?: string;
  priority?: string;
  assignee?: string;
  uid?: string;
  created_at?: number;
  updated_at?: number;
  resolved_at?: number | null;
  troubleshooting_steps?: string;
  resolution?: string;
  severity?: string;
  notes: any; // Can be object or string
  potential_past_issues?: string;
}

export default function IssuesLog({ view, updateView, raName }: IssuesLogProps) {
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sortField, setSortField] = useState<keyof IssueData | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);


  const handleSort = (field: keyof IssueData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedIssues = () => {
    if (!sortField) return issues;

    return [...issues].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle timestamp fields
      if (sortField === 'created_at' || sortField === 'updated_at' || sortField === 'resolved_at') {
        aValue = aValue as number;
        bValue = bValue as number;
      } else {
        // Convert to string for comparison
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getSortIcon = (field: keyof IssueData) => {
    if (sortField !== field) {
      return <ChevronUp className="w-4 h-4 opacity-30" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-blue-600" /> : 
      <ChevronDown className="w-4 h-4 text-blue-600" />;
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp * 1000);
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
      const isDST = date.toLocaleString('en-US', { timeZone: 'America/New_York' }).includes('EDT');
      const timezoneLabel = isDST ? 'EDT' : 'EST';
      
      return formatted + ' ' + timezoneLabel;
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'red':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'green':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved':
      case 'closed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'not started':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const fetchIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/issues/csv');
      const data = await response.json();
      
      console.log('API Response:', data);
      console.log('Response keys:', Object.keys(data));
      
      if (data.success && data.issues) {
        console.log('Issues array:', data.issues);
        
        // Transform the issues to match our interface
        const transformedIssues = data.issues.map((issue: any) => {
          // Parse notes if it's a JSON string
          let parsedNotes = {};
          if (issue.notes) {
            if (typeof issue.notes === 'string') {
              try {
                parsedNotes = JSON.parse(issue.notes);
                console.log('Parsed notes for issue', issue.id, ':', parsedNotes);
              } catch (error) {
                console.error('Failed to parse notes for issue', issue.id, ':', error);
                parsedNotes = {};
              }
            } else if (typeof issue.notes === 'object') {
              parsedNotes = issue.notes;
            }
          }
          
          return {
            id: issue.id || '',
            summary: issue.summary || '',
            status: issue.status || 'not started',
            priority: issue.priority || 'not decided',
            assignee: issue.assignee || '',
            uid: issue.uid || '',
            created_at: issue.created_at || 0,
            updated_at: issue.updated_at || 0,
            resolved_at: issue.resolved_at || null,
            troubleshooting_steps: issue.troubleshooting_steps || '',
            resolution: issue.resolution || '',
            severity: issue.severity || 'yellow',
            notes: parsedNotes, // Properly parsed object
            potential_past_issues: issue.potential_past_issues || ''
          };
        });
        
        console.log('Transformed issues:', transformedIssues);
        setIssues(transformedIssues);
      } else {
        setError(data.message || 'Failed to fetch issues');
      }
    } catch (err) {
      console.error('Error fetching issues:', err);
      setError('Failed to fetch issues: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueClick = (issue: IssueData) => {
    setSelectedIssue(issue);
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setSelectedIssue(null);
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm(`Are you sure you want to delete issue ${issueId}? This action cannot be undone.`)) {
      return;
    }

    setDeletingIssueId(issueId);
    try {
      const response = await fetch('/api/issues/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issueId: issueId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        // Remove the issue from the local state
        setIssues(prevIssues => prevIssues.filter(issue => issue.id !== issueId));
        // Close preview if the deleted issue was being viewed
        if (selectedIssue?.id === issueId) {
          setShowPreview(false);
          setSelectedIssue(null);
        }
      } else {
        throw new Error(result.message || 'Failed to delete issue');
      }
    } catch (err) {
      console.error('Failed to delete issue:', err);
      alert('Failed to delete issue. Please try again.');
    } finally {
      setDeletingIssueId(null);
    }
  };

  const downloadCSV = () => {
    if (issues.length === 0) return;
    
    const headers = ['Issue ID', 'Summary', 'Status', 'Priority', 'Assignee', 'Created At', 'Updated At', 'Severity'];
    const csvContent = [
      headers.join(','),
      ...issues.map(issue => [
        issue.id,
        `"${issue.summary}"`,
        issue.status,
        issue.priority,
        issue.assignee,
        formatTimestamp(issue.created_at),
        formatTimestamp(issue.updated_at),
        issue.severity
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `issues-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Issues Log</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({issues.length} issues)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchIssues}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Refresh
              </>
            )}
          </button>
          <button
            onClick={downloadCSV}
            disabled={issues.length === 0}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-red-600 dark:text-red-400 mb-2">Error loading issues</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</div>
              <button
                onClick={fetchIssues}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center gap-1">
                      Issue ID
                      {getSortIcon('id')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('updated_at')}
                  >
                    <div className="flex items-center gap-1">
                      Last Updated
                      {getSortIcon('updated_at')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('uid')}
                  >
                    <div className="flex items-center gap-1">
                      UID
                      {getSortIcon('uid')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('severity')}
                  >
                    <div className="flex items-center gap-1">
                      Severity
                      {getSortIcon('severity')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('summary')}
                  >
                    <div className="flex items-center gap-1">
                      Description
                      {getSortIcon('summary')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {getSortedIssues().map((issue, index) => (
                  <tr key={issue.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleIssueClick(issue)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono text-sm font-medium flex items-center gap-1 hover:underline"
                      >
                        <Eye className="w-3 h-3" />
                        {issue.id}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatTimestamp(issue.updated_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {issue.uid || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {issue.summary}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteIssue(issue.id)}
                        disabled={deletingIssueId === issue.id}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete issue"
                      >
                        {deletingIssueId === issue.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {getSortedIssues().length === 0 && !loading && (
              <div className="flex items-center justify-center h-32">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div>No issues found</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Issue Preview Modal */}
      {showPreview && selectedIssue && (() => {
        // Calculate modal size - use larger of view size or minimum size, up to viewport limits
        const GRID_SIZE = 120;
        const GRID_GAP = 12;
        const COVERAGE = 0.98; // 98% coverage for more space
        
        const viewWidthPx = (view.width * GRID_SIZE) - GRID_GAP;
        const viewHeightPx = (view.height * GRID_SIZE) - GRID_GAP;
        
        // Minimum sizes to ensure modal is always reasonably large
        const MIN_WIDTH = 1200;
        const MIN_HEIGHT = 800;
        
        // Calculate size: use larger of view-based size or minimum, but don't exceed viewport
        const calculatedWidth = Math.max(viewWidthPx * COVERAGE, MIN_WIDTH);
        const calculatedHeight = Math.max(viewHeightPx * COVERAGE, MIN_HEIGHT);
        
        // Don't limit by viewport - use calculated size or minimum, whichever is larger
        // This allows modal to be larger than viewport if needed
        const modalWidth = Math.max(calculatedWidth, MIN_WIDTH);
        const modalHeight = Math.max(calculatedHeight, MIN_HEIGHT);
        
        // Debug logging
        console.log('=== Issue Preview Modal Size Calculation ===');
        console.log('view.width:', view.width);
        console.log('view.height:', view.height);
        console.log('viewWidthPx:', viewWidthPx);
        console.log('viewHeightPx:', viewHeightPx);
        console.log('COVERAGE:', COVERAGE);
        console.log('viewWidthPx * COVERAGE:', viewWidthPx * COVERAGE);
        console.log('viewHeightPx * COVERAGE:', viewHeightPx * COVERAGE);
        console.log('MIN_WIDTH:', MIN_WIDTH);
        console.log('MIN_HEIGHT:', MIN_HEIGHT);
        console.log('calculatedWidth:', calculatedWidth);
        console.log('calculatedHeight:', calculatedHeight);
        console.log('window.innerWidth:', window.innerWidth);
        console.log('window.innerHeight:', window.innerHeight);
        console.log('FINAL modalWidth (no viewport limit):', modalWidth);
        console.log('FINAL modalHeight (no viewport limit):', modalHeight);
        console.log('=== END Debug ===');
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto">
            <div 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              style={{
                width: `${modalWidth}px`,
                height: `${modalHeight}px`,
                minWidth: `${modalWidth}px`,
                minHeight: `${modalHeight}px`,
                flexShrink: 0
              } as React.CSSProperties}
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Issue Preview: {selectedIssue.id}
                  </h2>
                  <button
                    onClick={handleClosePreview}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div 
                className="flex-1 overflow-y-scroll"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#9ca3af #f3f4f6'
                }}
              >
                <style>{`
                  .issues-log-modal-content::-webkit-scrollbar {
                    width: 12px;
                  }
                  .issues-log-modal-content::-webkit-scrollbar-track {
                    background: #f3f4f6;
                    border-radius: 6px;
                  }
                  .issues-log-modal-content::-webkit-scrollbar-thumb {
                    background: #9ca3af;
                    border-radius: 6px;
                    border: 2px solid #f3f4f6;
                  }
                  .issues-log-modal-content::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                  }
                  .dark .issues-log-modal-content::-webkit-scrollbar-track {
                    background: #374151;
                  }
                  .dark .issues-log-modal-content::-webkit-scrollbar-thumb {
                    background: #6b7280;
                    border: 2px solid #374151;
                  }
                  .dark .issues-log-modal-content::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af;
                  }
                `}</style>
                <div className="p-6 issues-log-modal-content">
                  <IssueSummary
                    userId={selectedIssue.uid}
                    reason={selectedIssue.summary}
                    color={selectedIssue.severity}
                    onClose={handleClosePreview}
                    raName={raName}
                    view={view}
                    updateView={updateView}
                    // Pass the issue data to pre-populate the form
                    issueId={selectedIssue.id}
                    status={selectedIssue.status as any}
                    priority={selectedIssue.priority}
                    resolution={selectedIssue.resolution}
                    troubleshootingSteps={selectedIssue.troubleshooting_steps}
                    createdAt={selectedIssue.created_at.toString()}
                    updatedAt={selectedIssue.updated_at.toString()}
                    createdBy={selectedIssue.assignee}
                    raNotes={selectedIssue.notes}
                    // Refresh Issues Log when issue is saved
                    onIssueSaved={fetchIssues}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
