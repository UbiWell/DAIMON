import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, RefreshCw, AlertCircle, Download, Image as ImageIcon, FileSpreadsheet, X, ZoomIn, ZoomOut, Home } from 'lucide-react';
import { useState as useStateReact } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import API_BASE_URL from '@/config/api';

interface NLInterfaceProps {
  view?: any;
  updateView?: (data: any) => void;
  raName?: string;
  isResizing?: boolean;
  resizingViewId?: number | null;
}

// CSV Preview Component
function CsvPreview({ csvUrl }: { csvUrl: string }) {
  const [csvData, setCsvData] = useStateReact<string[][]>([]);
  const [loading, setLoading] = useStateReact(true);
  const [error, setError] = useStateReact<string | null>(null);

  useEffect(() => {
    const fetchCsv = async () => {
      try {
        setLoading(true);
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error('Failed to fetch CSV');

        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim());
        const data = lines.map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')));

        // Show first 10 rows for preview
        setCsvData(data.slice(0, 10));
      } catch (err) {
        setError('Failed to load CSV preview');
      } finally {
        setLoading(false);
      }
    };

    fetchCsv();
  }, [csvUrl]);

  if (loading) {
    return (
      <div className="text-center py-4 text-base text-gray-500">
        Loading CSV preview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-base text-red-500">
        {error}
      </div>
    );
  }

  if (csvData.length === 0) {
    return (
      <div className="text-center py-4 text-base text-gray-500">
        No data to preview
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="text-sm text-gray-500 mb-3">CSV Preview (first 10 rows)</div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              {csvData[0]?.map((header, index) => (
                <th key={index} className="px-3 py-2 text-left border-b font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csvData.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 border-b">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type InterfaceMode = 'summary' | 'analysis' | 'plotting' | 'datasubsets' | 'suggestions';

const modeOptions: { id: InterfaceMode; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'plotting', label: 'Plotting' },
  { id: 'datasubsets', label: 'Data Subsets' },
  { id: 'suggestions', label: 'Suggestions' },
];

const apiRoutes: Record<InterfaceMode, string> = {
  summary: '/api/nl/summary',
  analysis: '/api/nl/analysis',
  plotting: '/api/nl/plotting',
  datasubsets: '/api/nl/datasubsets',
  suggestions: '/api/nl/suggestions',
};

// Loading messages for different modes
const loadingMessages: Record<InterfaceMode, string[]> = {
  summary: [
    "Analyzing your data...",
    "Extracting key insights...",
    "Generating summary statistics...",
    "Identifying important patterns...",
    "Compiling results...",
    "Almost there..."
  ],
  analysis: [
    "Processing your analysis request...",
    "Running statistical computations...",
    "Examining data relationships...",
    "Performing deep analysis...",
    "Calculating metrics...",
    "Finalizing analysis results..."
  ],
  plotting: [
    "Preparing your visualization...",
    "Analyzing data for plotting...",
    "Selecting optimal chart type...",
    "Generating plot data...",
    "Rendering visualization...",
    "Polishing the final plot..."
  ],
  datasubsets: [
    "Filtering your dataset...",
    "Applying subset criteria...",
    "Identifying relevant data points...",
    "Organizing filtered results...",
    "Validating subset integrity...",
    "Preparing filtered data..."
  ],
  suggestions: [
    "Analyzing your data structure...",
    "Identifying opportunities...",
    "Generating recommendations...",
    "Evaluating suggestion quality...",
    "Ranking suggestions by relevance...",
    "Finalizing recommendations..."
  ]
};

export default function NLInterface({ view, updateView, raName, isResizing, resizingViewId }: NLInterfaceProps) {
  const [selectedMode, setSelectedMode] = useState<InterfaceMode | null>(null);
  const [detectedMode, setDetectedMode] = useState<InterfaceMode | null>(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [modeDetecting, setModeDetecting] = useState(false);
  const [modeDetected, setModeDetected] = useState(false);
  const [modeProcessing, setModeProcessing] = useState(false);
  const [results, setResults] = useState<string | { type: string; imageUrl?: string; codeUrl?: string; csvUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [loadingDuration, setLoadingDuration] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState<'none' | '2h' | '6h' | '1d' | '7d'>('none');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  // Chart zoom state for plotting results
  const [chartZoom, setChartZoom] = useState(1);
  const [chartPan, setChartPan] = useState({ x: 0, y: 0 });
  const [isChartDragging, setIsChartDragging] = useState(false);
  const [chartDragStart, setChartDragStart] = useState<{ x: number, y: number } | null>(null);

  // Ref for measuring content height
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsContentRef = useRef<HTMLDivElement>(null);

  // Storage key for this view instance
  const storageKey = `nl_interface_${view?.id || 'default'}`;

  // Helper function to ensure URLs use HTTPS when page is served over HTTPS
  const ensureSecureUrl = (url: string): string => {
    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    return url;
  };

  // Stop function to cancel ongoing requests
  const stopRequest = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setLoading(false);
    setModeDetecting(false);
    setError('Request cancelled by user');
    // Reset mode states when stopping
    setSelectedMode(null);
    setDetectedMode(null);
    setModeDetected(false);
    setModeProcessing(false);
  };

  // Mode detection function
  const detectMode = async (query: string, signal?: AbortSignal): Promise<InterfaceMode> => {
    try {
      const response = await fetch('/api/nl/detect-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          viewId: view?.id || 'default',
          refreshInterval,
          isRedo: false,
          raName: raName || ''
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error('Mode detection failed');
      }

      const data = await response.json();

      console.log('API Response:', data);
      console.log('API Response keys:', Object.keys(data));

      // Try different possible keys for the mode
      const detectedMode = data.mode || data.Mode || data.mode_type || data.type;
      console.log('Detected Mode from API:', detectedMode);

      // Map the API response to our internal mode format
      const modeMapping: Record<string, InterfaceMode> = {
        'Summary': 'summary',
        'Analysis': 'analysis',
        'Plotting': 'plotting',
        'Data Subsets': 'datasubsets',
        'Suggestions': 'suggestions',
        // Also handle lowercase versions
        'summary': 'summary',
        'analysis': 'analysis',
        'plotting': 'plotting',
        'datasubsets': 'datasubsets',
        'suggestions': 'suggestions'
      };

      const mappedMode = modeMapping[detectedMode] || 'analysis';
      console.log('Mapped Mode:', mappedMode);

      return mappedMode;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Re-throw abort errors
      }
      console.error('Mode detection error:', error);
      return 'analysis'; // fallback to analysis
    }
  };

  // Save state to localStorage
  const saveState = useCallback(() => {
    const state = {
      selectedMode,
      detectedMode,
      searchText,
      results,
      refreshInterval,
      timestamp: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [selectedMode, detectedMode, searchText, results, refreshInterval, storageKey]);

  // Load state from localStorage
  const loadState = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const state = JSON.parse(saved);
        setSelectedMode(state.selectedMode || null);
        setDetectedMode(state.detectedMode || null);
        setSearchText(state.searchText || '');
        setResults(state.results || null);
        setRefreshInterval(state.refreshInterval || 'none');
      }
    } catch (error) {
      console.error('Failed to load NL Interface state:', error);
    }
  }, [storageKey]);

  const intervalOptions: { value: 'none' | '2h' | '6h' | '1d' | '7d'; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: '2h', label: '2 hrs' },
    { value: '6h', label: '6 hrs' },
    { value: '1d', label: '1 day' },
    { value: '7d', label: '7 days' },
  ];

  // Load state on component mount
  useEffect(() => {
    loadState();
  }, [loadState]);

  // Cleanup function to call destroy-view API when component unmounts
  useEffect(() => {
    return () => {
      // Call destroy-view API when the component is unmounted (view is closed)
      if (view?.id) {
        fetch('/api/nl/destroy-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            viewId: view.id,
            raName: raName || ''
          }),
        }).catch(error => {
          console.error('Failed to call destroy-view API:', error);
        });
      }
    };
  }, [view?.id]);

  // Save state whenever important values change
  useEffect(() => {
    if (results || searchText || selectedMode !== 'analysis' || refreshInterval !== 'none') {
      saveState();
    }
  }, [saveState]);

  // Effect for rotating loading messages
  useEffect(() => {
    if (!loading) {
      setCurrentMessageIndex(0);
      setLoadingDuration(0);
      return;
    }

    const messageInterval = setInterval(() => {
      if (modeDetecting) {
        // Don't cycle through messages during mode detection
        return;
      }
      setCurrentMessageIndex(prev =>
        (prev + 1) % loadingMessages[selectedMode || 'analysis'].length
      );
    }, 3000); // Change message every 3 seconds

    const durationInterval = setInterval(() => {
      setLoadingDuration(prev => prev + 1);
    }, 1000); // Update duration every second

    return () => {
      clearInterval(messageInterval);
      clearInterval(durationInterval);
    };
  }, [loading, selectedMode, modeDetecting]);

  // Auto-resize view height to fit content when results are generated
  useEffect(() => {
    // Don't auto-resize if user is manually resizing this view
    if (isResizing || (resizingViewId !== null && resizingViewId === view?.id)) {
      return;
    }
    
    if (!results || !containerRef.current || !updateView || !view?.id) {
      return;
    }

    const GRID_SIZE = 120;
    const GRID_GAP = 12;

    const resizeView = () => {
      // Don't auto-resize if user is manually resizing this view
      if (isResizing || (resizingViewId !== null && resizingViewId === view?.id)) {
        return;
      }
      
      if (containerRef.current) {
        // Temporarily remove height constraint to measure natural content height
        const originalHeight = containerRef.current.style.height;
        containerRef.current.style.height = 'auto';
        
        // Force a reflow to ensure accurate measurement
        void containerRef.current.offsetHeight;
        
        // Measure the actual content height
        const contentHeight = containerRef.current.scrollHeight;
        
        // Restore original height
        containerRef.current.style.height = originalHeight;
        
        // Convert to grid units (add gap for spacing)
        const requiredHeightInGrid = Math.ceil((contentHeight + GRID_GAP) / GRID_SIZE);
        
        // Get current view height
        const currentHeight = view.height || 4;
        
        // Only update if the required height is different and within reasonable bounds
        if (requiredHeightInGrid !== currentHeight && requiredHeightInGrid >= 3 && requiredHeightInGrid <= 20) {
          updateView({ height: requiredHeightInGrid });
        }
      }
    };

    // Small delay to ensure DOM has updated
    const timeoutId = setTimeout(() => {
      resizeView();
    }, 100);

    // Also resize when images load (for plotting results)
    const images = containerRef.current.querySelectorAll('img');
    const imageLoadPromises: Promise<void>[] = [];

    images.forEach((img) => {
      if (img.complete) {
        return;
      }
      imageLoadPromises.push(
        new Promise((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        })
      );
    });

    // Resize after all images load
    if (imageLoadPromises.length > 0) {
      Promise.all(imageLoadPromises).then(() => {
        resizeView();
      });
    }

    // Use ResizeObserver to watch for content size changes
    const resizeObserver = new ResizeObserver(() => {
      resizeView();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [results, updateView, view?.id, view?.height, isResizing, resizingViewId]);


  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!searchText.trim()) {
      setError('Please enter a search query');
      return;
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);

    setLoading(true);
    setModeDetecting(true);
    setError(null);
    setResults(null);
    setCurrentMessageIndex(0);
    setLoadingDuration(0);
    // Reset mode states for new search
    setSelectedMode(null);
    setDetectedMode(null);
    setModeDetected(false);
    setModeProcessing(false);
    // Reset chart zoom state for new results
    setChartZoom(1);
    setChartPan({ x: 0, y: 0 });

    try {
      // First, detect the mode
      const detectedModeResult = await detectMode(searchText, controller.signal);
      setDetectedMode(detectedModeResult);
      setSelectedMode(detectedModeResult);
      setModeDetected(true);
      setModeDetecting(false); // Mode detection is complete, change text immediately
      setModeProcessing(true); // Start processing the main API call

      console.log(`Detected mode: ${detectedModeResult}, submitting "${searchText}" to ${apiRoutes[detectedModeResult]} (refresh=${refreshInterval}, viewId=${view?.id || 'default'})`);

      const response = await fetch(apiRoutes[detectedModeResult], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchText,
          mode: detectedModeResult,
          refreshInterval,
          viewId: view?.id || 'default',
          isRedo: false,
          raName: raName || ''
        }),
        signal: controller.signal,
      });

      console.log(response);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle structured responses for different modes
      if (detectedModeResult === 'plotting' && data.image_path) {
        setResults({
          type: 'plotting',
          imageUrl: ensureSecureUrl(`${API_BASE_URL}${data.image_path}`),
          codeUrl: data.code_path ? ensureSecureUrl(`${API_BASE_URL}${data.code_path}`) : null
        });
      } else if (detectedModeResult === 'datasubsets' && data.csv_path) {
        setResults({
          type: 'datasubsets',
          csvUrl: ensureSecureUrl(`${API_BASE_URL}${data.csv_path}`)
        });
      } else if ((detectedModeResult === 'summary' || detectedModeResult === 'analysis' || detectedModeResult === 'suggestions') && data.results) {
        // Extract and clean the text from the results field
        let resultText = data.results;

        // Remove mode-specific prefixes if they exist
        if (detectedModeResult === 'summary' && resultText.startsWith('summary: ')) {
          resultText = resultText.substring(9);
        } else if (detectedModeResult === 'analysis' && resultText.startsWith('analysis: ')) {
          resultText = resultText.substring(10);
        } else if (detectedModeResult === 'suggestions' && resultText.startsWith('suggestions: ')) {
          resultText = resultText.substring(13);
        }

        // Remove surrounding quotes if present
        if (resultText.startsWith('"') && resultText.endsWith('"')) {
          resultText = resultText.slice(1, -1);
        }
        setResults(resultText);
      } else {
        setResults(data.result || JSON.stringify(data, null, 2));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't show error
        console.log('Request cancelled by user');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Failed to process request:', err);
        setError(`Failed to process request: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
      setModeProcessing(false); // Main API call finished, stop blinking
      setAbortController(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getCurrentLoadingMessage = () => {
    if (modeDetecting) {
      return "Analyzing your query to determine the best approach...";
    }
    const messages = loadingMessages[selectedMode || 'analysis'];
    return messages[currentMessageIndex];
  };

  // Get placeholder text based on selected mode
  const getPlaceholderText = () => {

    return "Enter your request here..."
  };


  // Download image function
  const downloadImage = async (imageUrl: string, filename?: string) => {
    try {
      const secureUrl = ensureSecureUrl(imageUrl);
      const response = await fetch(secureUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `plot_${new Date().toISOString()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  // Download CSV function
  const downloadCsv = async (csvUrl: string, filename?: string) => {
    try {
      const secureUrl = ensureSecureUrl(csvUrl);
      const response = await fetch(secureUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `dataset_${new Date().toISOString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV:', error);
    }
  };

  // Download code function
  const downloadCode = async (codeUrl: string, filename?: string) => {
    try {
      const secureUrl = ensureSecureUrl(codeUrl);
      const response = await fetch(secureUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `code_${new Date().toISOString()}.py`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download code:', error);
    }
  };

  // Chart zoom and pan functions
  const handleChartZoomIn = () => {
    setChartZoom(prev => Math.min(prev * 1.2, 5)); // Max 5x zoom
  };

  const handleChartZoomOut = () => {
    setChartZoom(prev => Math.max(prev / 1.2, 0.5)); // Min 0.5x zoom
  };

  const handleChartReset = () => {
    setChartZoom(1);
    setChartPan({ x: 0, y: 0 });
  };

  const handleChartMouseDown = (e: React.MouseEvent) => {
    if (chartZoom > 1) {
      setIsChartDragging(true);
      setChartDragStart({ x: e.clientX - chartPan.x, y: e.clientY - chartPan.y });
    }
  };

  const handleChartMouseMove = (e: React.MouseEvent) => {
    if (isChartDragging && chartDragStart) {
      setChartPan({
        x: e.clientX - chartDragStart.x,
        y: e.clientY - chartDragStart.y
      });
    }
  };

  const handleChartMouseUp = () => {
    setIsChartDragging(false);
    setChartDragStart(null);
  };

  const handleChartWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setChartZoom(prev => Math.max(0.5, Math.min(5, prev * delta)));
  };

  // Render different content based on mode and result type
  const renderResults = () => {
    if (!results) return null;

    // Handle plotting mode with image and code
    if (typeof results === 'object' && results && results.type === 'plotting') {
      return (
        <div className="space-y-5">
          {/* Image Display with Zoom Controls */}
          <div className="bg-white dark:bg-gray-900 rounded border p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Generated Plot
              </span>
              <div className="flex items-center gap-2">
                {/* Chart Zoom Controls */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={handleChartZoomOut}
                    disabled={chartZoom <= 0.5}
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-mono min-w-[2.5rem] text-center">
                    {Math.round(chartZoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={handleChartZoomIn}
                    disabled={chartZoom >= 5}
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={handleChartReset}
                    disabled={chartZoom === 1 && chartPan.x === 0 && chartPan.y === 0}
                  >
                    <Home className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadImage(results.imageUrl!, 'plot.png')}
                  className="flex items-center gap-2 px-4 py-2 text-base"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </Button>
              </div>
            </div>
            <div 
              className={`relative rounded border bg-gray-50 dark:bg-gray-800 flex items-center justify-center ${
                chartZoom > 1 ? 'overflow-hidden' : ''
              }`}
              style={chartZoom > 1 ? { 
                height: '400px',
                cursor: isChartDragging ? 'grabbing' : 'grab'
              } : {
                width: '100%',
                minHeight: '200px'
              }}
              onMouseDown={chartZoom > 1 ? handleChartMouseDown : undefined}
              onMouseMove={chartZoom > 1 ? handleChartMouseMove : undefined}
              onMouseUp={chartZoom > 1 ? handleChartMouseUp : undefined}
              onMouseLeave={chartZoom > 1 ? handleChartMouseUp : undefined}
              onWheel={handleChartWheel}
            >
              <img
                src={results.imageUrl!}
                alt="Generated Plot"
                className={`transition-transform duration-150 ease-out ${
                  chartZoom > 1 ? 'absolute' : 'relative w-full h-auto'
                }`}
                style={{
                  transform: chartZoom > 1 
                    ? `scale(${chartZoom}) translate(${chartPan.x / chartZoom}px, ${chartPan.y / chartZoom}px)`
                    : 'none',
                  transformOrigin: 'center center',
                  cursor: chartZoom > 1 ? (isChartDragging ? 'grabbing' : 'grab') : 'default',
                  maxWidth: chartZoom === 1 ? '100%' : 'none',
                  height: chartZoom === 1 ? 'auto' : 'auto',
                  display: 'block',
                  objectFit: chartZoom === 1 ? 'contain' : 'none'
                }}
                draggable={false}
              />
              {chartZoom > 1 && (
                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded z-10 text-xs">
                  Drag to pan • Scroll to zoom
                </div>
              )}
            </div>
          </div>

          {/* Code Display */}
          {results.codeUrl && (
            <div className="bg-white dark:bg-gray-900 rounded border p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  Generated Code
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadCode(results.codeUrl!, 'code.py')}
                  className="flex items-center gap-2 px-4 py-2 text-base"
                >
                  <Download className="w-4 h-4" />
                  Download Code
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Handle data subsets mode with CSV
    if (typeof results === 'object' && results && results.type === 'datasubsets') {
      return (
        <div className="bg-white dark:bg-gray-900 rounded border p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Generated Dataset
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCsv(results.csvUrl!, 'dataset.csv')}
              className="flex items-center gap-2 px-4 py-2 text-base"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </Button>
          </div>
          <CsvPreview csvUrl={results.csvUrl!} />
        </div>
      );
    }

    // Default text display for other modes
    return (
      <div className={`text-2xl md:text-3xl text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed bg-white dark:bg-gray-900 p-6 rounded border w-full ${
        ((selectedMode === 'analysis' || selectedMode === 'summary' || selectedMode === 'suggestions')) ? 'font-sans' : 'font-mono'
      }`}>
        {typeof results === 'string' ? results : JSON.stringify(results)}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col text-lg w-full">
      {/* Search Bar */}
      <div className="flex-shrink-0 min-h-[120px] max-h-[200px] p-2 border-b border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              placeholder={getPlaceholderText()}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[60px] max-h-[160px] focus:ring-2 focus:ring-blue-500 focus:border-transparent text-2xl leading-relaxed placeholder:text-xl"
              rows={2}
              disabled={loading}
            />
          </div>
          <Button
            type={loading ? "button" : "submit"}
            size="sm"
            disabled={!loading && !searchText.trim()}
            onClick={loading ? (e) => stopRequest(e) : undefined}
            className={`flex items-center gap-1 px-3 py-2 h-10 text-sm transition-all duration-200 ${
              loading 
                ? 'bg-red-500 hover:bg-red-600 text-white border-red-500' 
                : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500'
            }`}
          >
            {loading ? (
              <div className="relative">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <X className="w-3 h-3 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
            ) : (
              <Search className="w-5 h-5" />
            )}
          </Button>
        </form>

        {/* Refresh Interval Selection */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-600 dark:text-gray-300">Refresh</span>
          <div className="w-24">
            <Select
              disabled={loading}
              value={refreshInterval}
              onValueChange={(val) => setRefreshInterval(val as typeof refreshInterval)}
            >
              <SelectTrigger className="h-6 text-xs">
                <SelectValue placeholder="Refresh" />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mode Selection - Auto-detected */}
      <div className="flex-shrink-0 min-h-[60px] max-h-[100px] px-2 py-1 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-3 mb-3">
          {modeOptions.map((option) => {
            const isDetected = detectedMode === option.id;
            const isSelected = selectedMode === option.id;

            return (
              <div
                key={option.id}
                className={`relative flex items-center gap-3 px-4 py-1.5 rounded-full text-xl transition-all duration-300 ${
                  isSelected
                    ? 'bg-blue-500 text-white shadow-md scale-105'
                    : isDetected
                    ? 'bg-green-500 text-white shadow-sm scale-102'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                <div className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  isSelected && modeProcessing
                    ? 'bg-white animate-pulse'
                    : isDetected
                    ? 'bg-white'
                    : 'bg-gray-400 dark:bg-gray-500'
                }`}></div>
                <span className="font-medium">{option.label}</span>
              </div>
            );
          })}
        </div>
        <div className="text-center mt-1">
          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 flex items-center justify-center gap-3">
            {modeDetecting ? (
              <>
                <span>Detecting mode</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </>
            ) : modeDetected ? (
              "Best mode detected"
            ) : (
              "I'll automatically detect the best mode"
            )}
          </p>
        </div>
      </div>

      {/* Results Area */}
      <div ref={resultsContentRef} className="flex-grow p-2 w-full">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="text-red-600 dark:text-red-400 font-medium text-base">Error</div>
            </div>
            <p className="text-red-600 dark:text-red-400 mt-2 text-base">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <div className="flex flex-col">
                <span className="text-gray-900 dark:text-gray-100 text-lg font-medium">
                  {getCurrentLoadingMessage()}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-base">
                  {formatDuration(loadingDuration)} elapsed
                </span>
              </div>
            </div>

            {/* Progress dots indicator */}
            {!modeDetecting && (
              <div className="flex space-x-1">
                {loadingMessages[selectedMode || 'analysis'].map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    index === currentMessageIndex
                      ? 'bg-blue-600'
                      : index < currentMessageIndex
                      ? 'bg-gray-400 dark:bg-gray-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
                ))}
              </div>
            )}

            {loadingDuration > 120 && (
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  This is taking longer than usual...
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">
                  Complex {selectedMode} requests may require additional processing time
                </p>
              </div>
            )}
          </div>
        )}

        {results && !loading && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 w-full">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {modeOptions.find(m => m.id === selectedMode)?.label} Results
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded">
                  {selectedMode}
                </div>
                {selectedMode === 'plotting' && typeof results === 'object' && results && results.type === 'plotting' && (
                  <div className="text-xs text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 px-2 py-1 rounded flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    1 image
                  </div>
                )}
                {selectedMode === 'datasubsets' && typeof results === 'object' && results && results.type === 'datasubsets' && (
                  <div className="text-xs text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded flex items-center gap-1">
                    <FileSpreadsheet className="w-3 h-3" />
                    1 CSV
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">
                Auto-fit content
              </div>
            </div>
            <div className="w-full">
              {renderResults()}
            </div>
          </div>
        )}

        {!results && !loading && !error && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm mb-2">Select a mode and express your query</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Current mode: <span className="font-medium">{modeOptions.find(m => m.id === selectedMode)?.label}</span>
            </p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 px-3 pb-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
        Mode: {selectedMode} | Refresh: {refreshInterval}
        {loading && (
          <span className="ml-2">
            | Processing for {formatDuration(loadingDuration)}
          </span>
        )}
      </div>
    </div>
  );
}
