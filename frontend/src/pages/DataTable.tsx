import React, { useEffect, useState, useRef } from 'react';
import { Star, RefreshCw, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, Send, Square, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import IssueSummary from '@/components/IssueSummary';

interface UserRow {
  uid: string;
  phone_duration: string;
  garmin_worn: string;
  garmin_on: string;
  distance: string;
  app_events: number;
  depression_scores: string | object;
  color?: string;
  status?: string;
}

type SortField = keyof UserRow;
type SortDirection = 'asc' | 'desc' | null;

interface DataTableProps {
  raName?: string;
  view?: any;
  updateView?: (data: any) => void;
  isResizing?: boolean;
  resizingViewId?: number | null;
}

export default function DataTable({ raName, view, updateView, isResizing, resizingViewId }: DataTableProps) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [criteriaExpanded, setCriteriaExpanded] = useState(false);
  const [criteriaText, setCriteriaText] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [userResults, setUserResults] = useState<Record<string, {color: string, reason: string}>>({});
  const [selectedIssue, setSelectedIssue] = useState<{userId: string, reason: string, color: string} | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const formatDateForAPI = (dateInput: string = '') => {
  if (dateInput) {
    // Create date in local timezone by adding time component
    const date = new Date(dateInput + 'T00:00:00');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  } else {
    const date = new Date();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  }
  };
  
  // Format date for input field (YYYY-MM-DD format)
  const formatDateForInput = (dateInput: string = '') => {
    const date = dateInput ? new Date(dateInput) : new Date();
    return date.toISOString().split('T')[0];
  };

  const fetchData = async (date?: string) => {
    try {
      setError(null);
      console.log("Fetching user data from API...");
      
      // Use Flask backend directly
      const apiDate = date ? formatDateForAPI(date) : formatDateForAPI();
      const url = `/api/users?date=${apiDate}`;
      
      console.log(`Fetching from: ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raName: raName || ''
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data: UserRow[] = await res.json();
      console.log('Data:', data);
      setRows(data);
      console.log(`Loaded ${data.length} users for date: ${apiDate}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Failed to fetch user data', err);
      setError(`Failed to fetch user data: ${errorMessage}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(selectedDate);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    fetchData(date);
  };

  const handleEvaluateCriteria = async () => {
    if (!criteriaText.trim()) return;

    setIsEvaluating(true);
    setUserResults({});
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/evaluate-criteria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          viewId: 'datatable-view',
          criteria: criteriaText,
          date: formatDateForAPI(selectedDate),
          raName: raName || ''
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('API Response:', result);
      console.log('Results object:', result.results);
      console.log('Results type:', typeof result.results);
      console.log('Results is array:', Array.isArray(result.results));
      
      // Parse results if it's a string (JSON string from sensemaker.answer)
      let resultsObject = result.results || {};
      if (typeof resultsObject === 'string') {
        try {
          resultsObject = JSON.parse(resultsObject);
          console.log('Parsed results from string:', resultsObject);
        } catch (e) {
          console.error('Failed to parse results as JSON:', e);
          resultsObject = {};
        }
      }
      
      // Ensure we have an object, not an array
      if (Array.isArray(resultsObject)) {
        console.warn('Results is an array, converting to object');
        resultsObject = {};
      }
      
      // Validate that resultsObject is a plain object with user IDs as keys
      if (typeof resultsObject !== 'object' || resultsObject === null) {
        console.error('Results is not a valid object:', resultsObject);
        resultsObject = {};
      }
      
      console.log('Results object to set:', resultsObject);
      console.log('Results object keys:', Object.keys(resultsObject));
      console.log('Table user IDs:', rows.map(row => row.uid));
      
      setUserResults(resultsObject);
      console.log('Updated userResults state:', resultsObject);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Criteria evaluation cancelled');
      } else {
        console.error('Failed to evaluate criteria:', error);
        setError('Failed to evaluate criteria. Please try again.');
      }
    } finally {
      setIsEvaluating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopEvaluation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleSort = (field: SortField) => {
    let newDirection: SortDirection = 'asc';
    
    if (sortField === field) {
      if (sortDirection === 'asc') newDirection = 'desc';
      else if (sortDirection === 'desc') newDirection = null;
      else newDirection = 'asc';
    }
    
    setSortField(newDirection ? field : null);
    setSortDirection(newDirection);
  };

  const parseNumericValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Extract numbers from strings like "4.32h", "8.2 km", etc.
      const match = value.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    }
    return 0;
  };

  const sortedRows = React.useMemo(() => {
    if (!sortField || !sortDirection) return rows;

    return [...rows].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle different data types
      if (sortField === 'app_events') {
        aValue = aValue as number;
        bValue = bValue as number;
      } else if (['phone_duration', 'garmin_worn', 'garmin_on', 'distance'].includes(sortField)) {
        aValue = parseNumericValue(aValue as string);
        bValue = parseNumericValue(bValue as string);
      } else if (sortField === 'depression_scores') {
        // Convert objects to strings for comparison
        aValue = typeof aValue === 'object' ? JSON.stringify(aValue) : (aValue as string);
        bValue = typeof bValue === 'object' ? JSON.stringify(bValue) : (bValue as string);
      }

      // Compare values
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-6 h-6 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="w-6 h-6 text-blue-500" />;
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className="w-6 h-6 text-blue-500" />;
    }
    return <ChevronsUpDown className="w-6 h-6 text-gray-400" />;
  };

  useEffect(() => {
    // Initialize with current date
    const today = formatDateForInput();
    setSelectedDate(today);
    fetchData(today);
  }, []);

  // Cleanup effect to cancel ongoing requests
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Debug effect to monitor userResults changes
  useEffect(() => {
    console.log('userResults state changed:', userResults);
    console.log('userResults keys:', Object.keys(userResults));
  }, [userResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-lg text-gray-600">Loading user data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-6 w-6 text-red-600 mr-3" />
            <div className="text-lg text-red-600 font-medium">Error loading data</div>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-4 px-4 py-2 text-lg bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {refreshing ? 'Retrying...' : 'Retry'}
            </button>
          </div>
          <p className="text-red-600 mt-3 text-base">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .data-table-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .data-table-scroll::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 4px;
        }
        .data-table-scroll::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
        .data-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        .dark .data-table-scroll::-webkit-scrollbar-track {
          background: #374151;
        }
        .dark .data-table-scroll::-webkit-scrollbar-thumb {
          background: #6b7280;
        }
        .dark .data-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
      <div className="h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-3 flex-shrink-0 px-3 pt-3">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">User Daily Summary</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="date-picker" className="text-lg text-gray-600 dark:text-gray-400">
              Date:
            </label>
            <input
              id="date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 text-lg border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Criteria Evaluation Section */}
      <div className="mx-3 mb-3 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setCriteriaExpanded(!criteriaExpanded)}
            className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-xl text-gray-900 dark:text-gray-100">Define Criteria for Flagging</span>
              {isEvaluating && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-base rounded-full">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Evaluating...</span>
                </div>
              )}
              {!isEvaluating && (() => {
                const flaggedUsers = Object.values(userResults).filter(result => 
                  result.color === 'red' || result.color === 'yellow'
                );
                return flaggedUsers.length > 0 && (
                  <span className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-base rounded-full">
                    {flaggedUsers.length} users flagged
                  </span>
                );
              })()}
            </div>
            <ChevronRight 
              className={`w-6 h-6 text-gray-500 transition-transform ${criteriaExpanded ? 'rotate-90' : ''}`} 
            />
          </button>
          
          {criteriaExpanded && (
            <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
              <div className="pt-4">
                <label htmlFor="criteria-input" className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Enter criteria for flagging users:
                </label>
                <div className="flex gap-3 items-center">
                  <textarea
                    id="criteria-input"
                    value={criteriaText}
                    onChange={(e) => setCriteriaText(e.target.value)}
                    placeholder="e.g., Users with phone duration > 8 hours and depression scores > 7"
                    className="flex-1 px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={2}
                    disabled={isEvaluating}
                  />
                  <button
                    onClick={isEvaluating ? handleStopEvaluation : handleEvaluateCriteria}
                    disabled={!criteriaText.trim() && !isEvaluating}
                    className={`flex items-center justify-center w-12 h-12 rounded-md transition-colors flex-shrink-0 mb-0 ${
                      isEvaluating
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500'
                    }`}
                    title={isEvaluating ? 'Stop evaluation' : 'Send criteria'}
                  >
                    {isEvaluating ? (
                      <Square className="w-6 h-6" />
                    ) : (
                      <Send className="w-6 h-6" />
                    )}
                  </button>
                </div>
                {isEvaluating && (
                  <div className="mt-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-base font-medium">Evaluating criteria for all users...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg mx-3 mb-3">
          <p className="text-lg">No user data available for {formatDateForAPI(selectedDate)}</p>
          <button 
            onClick={handleRefresh}
            className="mt-3 px-5 py-2.5 text-lg bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Check Again
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 mx-3 mb-2 min-h-0 overflow-hidden">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full overflow-hidden">
              <div className="h-full overflow-auto data-table-scroll" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#d1d5db #f3f4f6'
              }}>
                <table className="w-full text-left min-w-max">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 z-10">
                    <tr>
                      <th className="p-6 text-gray-900 dark:text-gray-100 min-w-20 text-xl font-medium"></th>
                      <th 
                        className="p-6 text-gray-900 dark:text-gray-100 min-w-36 text-xl font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleSort('uid')}
                      >
                        <div className="flex items-center gap-2">
                          User
                          {getSortIcon('uid')}
                        </div>
                      </th>
                      <th 
                        className="p-6 text-gray-900 dark:text-gray-100 min-w-48 text-xl font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleSort('phone_duration')}
                      >
                        <div className="flex items-center gap-2">
                          Phone Duration (hrs)
                          {getSortIcon('phone_duration')}
                        </div>
                      </th>
                      <th 
                        className="p-6 text-gray-900 dark:text-gray-100 min-w-44 text-xl font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleSort('garmin_worn')}
                      >
                        <div className="flex items-center gap-2">
                          Garmin Worn (hrs)
                          {getSortIcon('garmin_worn')}
                        </div>
                      </th>
                      <th 
                        className="p-6 text-gray-900 dark:text-gray-100 min-w-40 text-xl font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleSort('garmin_on')}
                      >
                        <div className="flex items-center gap-2">
                          Garmin On (hrs)
                          {getSortIcon('garmin_on')}
                        </div>
                      </th>
                      <th 
                        className="p-6 text-gray-900 dark:text-gray-100 min-w-40 text-xl font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleSort('distance')}
                      >
                        <div className="flex items-center gap-2">
                          Distance (m)
                          {getSortIcon('distance')}
                        </div>
                      </th>
                      <th 
                        className="p-6 text-gray-900 dark:text-gray-100 min-w-40 text-xl font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleSort('app_events')}
                      >
                        <div className="flex items-center gap-2">
                          App Events
                          {getSortIcon('app_events')}
                        </div>
                      </th>
                      <th 
                        className="p-6 text-gray-900 dark:text-gray-100 min-w-52 text-xl font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleSort('depression_scores')}
                      >
                        <div className="flex items-center gap-2">
                          Depression Scores
                          {getSortIcon('depression_scores')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // console.log('Current userResults state:', userResults);
                      // console.log('Number of results:', Object.keys(userResults).length);
                      return null;
                    })()}
                    {sortedRows.map((row, idx) => (
                      <tr key={row.uid || idx} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="p-6 min-w-20">
                          {(() => {
                            // console.log(`Checking user ${row.uid}:`, userResults[row.uid]);
                            // console.log(`User ${row.uid} exists in results:`, !!userResults[row.uid]);
                            // console.log(`All userResults keys:`, Object.keys(userResults));
                            return userResults[row.uid];
                          })() && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`cursor-pointer transition-all duration-200 hover:scale-110 ${
                                    userResults[row.uid].color === 'red' ? 'text-red-500 hover:text-red-600' :
                                    userResults[row.uid].color === 'yellow' ? 'text-yellow-500 hover:text-yellow-600' :
                                    userResults[row.uid].color === 'green' ? 'text-green-500 hover:text-green-600' :
                                    'text-gray-500'
                                  }`}>
                                    <Star
                                      fill="currentColor"
                                      stroke="currentColor"
                                      className="w-7 h-7"
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent
                                  className="max-w-sm p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg text-base text-gray-900 dark:text-gray-100"
                                  side="right"
                                >
                                  <div className="space-y-3">
                                    <div className="whitespace-pre-wrap">
                                      {userResults[row.uid].reason}
                                    </div>
                                    <button
                                      onClick={() => setSelectedIssue({
                                        userId: row.uid,
                                        reason: userResults[row.uid].reason,
                                        color: userResults[row.uid].color
                                      })}
                                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-base font-medium"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Create Issue
                                    </button>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </td>
                        <td className="p-6 font-medium dark:text-gray-100 min-w-36 whitespace-nowrap text-xl">{row.uid}</td>
                        <td className="p-6 dark:text-gray-300 min-w-48 whitespace-nowrap text-xl">{row.phone_duration}</td>
                        <td className="p-6 dark:text-gray-300 min-w-44 whitespace-nowrap text-xl">{row.garmin_worn}</td>
                        <td className="p-6 dark:text-gray-300 min-w-40 whitespace-nowrap text-xl">{row.garmin_on}</td>
                        <td className="p-6 dark:text-gray-300 min-w-40 whitespace-nowrap text-xl">{row.distance}</td>
                        <td className="p-6 dark:text-gray-300 min-w-40 whitespace-nowrap text-xl">{row.app_events}</td>
                        <td className="p-6 dark:text-gray-300 min-w-52 text-xl">
                          <div className="max-w-72 truncate" title={typeof row.depression_scores === 'string' ? row.depression_scores : JSON.stringify(row.depression_scores)}>
                            {typeof row.depression_scores === 'string'
                              ? row.depression_scores
                              : JSON.stringify(row.depression_scores)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="text-lg text-gray-600 dark:text-gray-400 flex-shrink-0 px-3 pb-3">
            Total users: {rows.length} | Date: {formatDateForAPI(selectedDate)}
          </div>
        </>
      )}
      </div>

      {/* Issue Summary Modal */}
      {selectedIssue && (() => {
        // Calculate modal size - use larger of view size or minimum size
        const GRID_SIZE = 120;
        const GRID_GAP = 12;
        const COVERAGE = 0.98; // 98% coverage for more space
        
        const viewWidthPx = view ? (view.width * GRID_SIZE) - GRID_GAP : window.innerWidth * 0.9;
        const viewHeightPx = view ? (view.height * GRID_SIZE) - GRID_GAP : window.innerHeight * 0.9;
        
        // Minimum sizes to ensure modal is always reasonably large
        const MIN_WIDTH = 1200;
        const MIN_HEIGHT = 800;
        
        // Calculate size: use larger of view-based size or minimum
        const calculatedWidth = Math.max(viewWidthPx * COVERAGE, MIN_WIDTH);
        const calculatedHeight = Math.max(viewHeightPx * COVERAGE, MIN_HEIGHT);
        
        // Use calculated size or minimum, whichever is larger
        const modalWidth = Math.max(calculatedWidth, MIN_WIDTH);
        const modalHeight = Math.max(calculatedHeight, MIN_HEIGHT);
        
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
                    Create an Issue
                  </h2>
                  <button
                    onClick={() => setSelectedIssue(null)}
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
                  .data-table-modal-content::-webkit-scrollbar {
                    width: 12px;
                  }
                  .data-table-modal-content::-webkit-scrollbar-track {
                    background: #f3f4f6;
                    border-radius: 6px;
                  }
                  .data-table-modal-content::-webkit-scrollbar-thumb {
                    background: #9ca3af;
                    border-radius: 6px;
                    border: 2px solid #f3f4f6;
                  }
                  .data-table-modal-content::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                  }
                  .dark .data-table-modal-content::-webkit-scrollbar-track {
                    background: #374151;
                  }
                  .dark .data-table-modal-content::-webkit-scrollbar-thumb {
                    background: #6b7280;
                    border: 2px solid #374151;
                  }
                  .dark .data-table-modal-content::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af;
                  }
                `}</style>
                <div className="p-6 data-table-modal-content">
                  <IssueSummary
                    userId={selectedIssue.userId}
                    reason={selectedIssue.reason}
                    color={selectedIssue.color}
                    onClose={() => setSelectedIssue(null)}
                    raName={raName}
                    view={view}
                    updateView={updateView}
                    forceCreationMode={true}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}