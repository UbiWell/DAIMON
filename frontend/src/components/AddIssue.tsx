"use client";
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";

type Status = "not started" | "in progress" | "resolved";

interface AddIssueProps {
  view: any;
  updateView: (data: any) => void;
  raName?: string;
}

interface PastIssue {
  id: string;
  date: string;
  summary: string;
  status: string;
}

export default function AddIssue({ view, updateView, raName }: AddIssueProps) {
  const [userId, setUserId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [color, setColor] = useState<string>("yellow");
  const [issueId, setIssueId] = useState<string>("");
  const [status, setStatus] = useState<Status>("not started");
  const [emailText, setEmailText] = useState("");
  const [raInput, setRaInput] = useState("");
  const [raMessages, setRaMessages] = useState<string[]>([]);
  const [isCreated, setIsCreated] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [pastIssues, setPastIssues] = useState<PastIssue[]>([]);
  const [isLoadingPastIssues, setIsLoadingPastIssues] = useState(false);
  const [troubleshootingSteps, setTroubleshootingSteps] = useState<string>('');
  const [isGeneratingTroubleshooting, setIsGeneratingTroubleshooting] = useState(false);
  const [priority, setPriority] = useState<string>('not decided');
  const [resolutionText, setResolutionText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

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
          raName: raName || ''
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Issue updated successfully:', result);
      
      // Show success message (you could add a toast notification here)
      alert('Issue updated successfully!');
    } catch (error) {
      console.error('Failed to update issue:', error);
      alert('Failed to update issue. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Automatically fetch past issues when component mounts and userId is available
  useEffect(() => {
    if (userId) {
      fetchPastIssues();
    }
  }, [userId]);

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
    setRaMessages((prev) => [...prev, raInput.trim()]);
    setRaInput("");
  };

  const createIssue = async () => {
    if (!userId.trim() || !reason.trim()) {
      alert('Please fill in both User ID and Issue Reason before creating an issue.');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/issues/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId.trim(),
          reason: reason.trim(),
          potentialPastIssues: [], // TODO: Add actual past issues data
          color,
          raName: raName || ''
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setIssueId(result.issueId || `issue_${userId}_${Date.now()}`);
      setIsCreated(true);
    } catch (error) {
      console.error('Failed to create issue:', error);
      alert('Failed to create issue. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const fetchPastIssues = async () => {
    if (!userId.trim()) return;
    
    setIsLoadingPastIssues(true);
    try {
      const response = await fetch('/api/issues/past-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId.trim(),
          raName: raName || ''
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setPastIssues(result.pastIssues || []);
    } catch (error) {
      console.error('Failed to fetch past issues:', error);
      // Silently fail - just keep pastIssues empty
      setPastIssues([]);
    } finally {
      setIsLoadingPastIssues(false);
    }
  };

  const generateEmail = async () => {
    if (!userId.trim() || !reason.trim()) {
      alert('Please fill in both User ID and Issue Reason before generating email.');
      return;
    }

    setIsGeneratingEmail(true);
    try {
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId.trim(),
          reason: reason.trim(),
          color,
          issueId: issueId || `issue_${userId}_${Date.now()}`,
          raName: raName || ''
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setEmailText(result.emailContent || '');
    } catch (error) {
      console.error('Failed to generate email:', error);
      alert('Failed to generate email. Please try again.');
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const generateTroubleshootingSteps = async () => {
    if (!userId.trim() || !reason.trim()) {
      alert('Please fill in both User ID and Issue Reason before generating troubleshooting steps.');
      return;
    }

    setIsGeneratingTroubleshooting(true);
    try {
      const response = await fetch('/api/generate-troubleshooting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId.trim(),
          reason: reason.trim(),
          color,
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Flag Color *
                </label>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <Plus className="w-4 h-4" />
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
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Issue ID:</span>{" "}
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {issueId || "Not created yet"}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">User ID:</span>{" "}
                <span className="font-mono text-gray-700 dark:text-gray-300">{userId}</span>
              </div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Status:
                <select
                  className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                >
                  <option value="not started">not started</option>
                  <option value="in progress">in progress</option>
                  <option value="resolved">resolved</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Priority:
                <select
                  className="ml-2 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
                className="ml-auto px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium flex items-center gap-1"
              >
                {isSaving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Issue'
                )}
              </button>
            </div>

            {/* Resolution Text Box - only show when status is resolved */}
            {status === 'resolved' && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-green-50 dark:bg-green-900/20">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Resolution Details</h3>
                <textarea
                  placeholder="Describe how this issue was resolved..."
                  value={resolutionText}
                  onChange={(e) => handleResolutionChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[80px] max-h-[150px] focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  rows={3}
                />
              </div>
            )}

            {/* Summary */}
            <div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800 shadow-sm">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Issue Summary</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {reason}
                </p>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {color.toUpperCase()} FLAG
                  </span>
                </div>
              </div>
            </div>

            {/* Troubleshooting Steps */}
            <div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm">Troubleshooting Steps</h3>
                  <button
                    onClick={generateTroubleshootingSteps}
                    disabled={isGeneratingTroubleshooting}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg shadow-sm transition-colors text-xs font-medium"
                  >
                    {isGeneratingTroubleshooting ? 'Generating...' : 'Generate'}
                  </button>
                </div>
                {troubleshootingSteps ? (
                  <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {troubleshootingSteps}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Click "Generate" to create troubleshooting steps for this issue.
                  </div>
                )}
              </div>
            </div>

            {/* Potential past issues */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Potential Past Issues</h3>
              <div className="overflow-x-auto rounded-lg shadow">
                <table className="min-w-full text-xs">
                  <tbody>
                    <tr className="bg-gray-100 dark:bg-gray-600 text-left">
                      <th className="px-2 py-1 text-gray-900 dark:text-white">Issue ID</th>
                      <th className="px-2 py-1 text-gray-900 dark:text-white">Date</th>
                      <th className="px-2 py-1 text-gray-900 dark:text-white">Summary</th>
                      <th className="px-2 py-1 text-gray-900 dark:text-white">Status</th>
                    </tr>
                    {pastIssues.length === 0 ? (
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td className="px-2 py-4 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                          {isLoadingPastIssues ? 'Loading past issues...' : 'No past issues found.'}
                        </td>
                      </tr>
                    ) : (
                      pastIssues.map((issue) => (
                        <tr key={issue.id} className="border-t border-gray-200 dark:border-gray-600">
                          <td className="px-2 py-1 text-gray-700 dark:text-gray-300 font-mono text-xs">{issue.id}</td>
                          <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{issue.date}</td>
                          <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{issue.summary}</td>
                          <td className="px-2 py-1 text-gray-700 dark:text-gray-300">
                            <span className={`px-1 py-0.5 rounded-full text-xs font-medium ${
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
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">Send Email to Participant:</div>
                <button
                  onClick={generateEmail}
                  disabled={isGeneratingEmail}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg shadow-sm transition-colors text-xs font-medium"
                >
                  {isGeneratingEmail ? 'Generating...' : 'Generate'}
                </button>
              </div>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 min-h-[80px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                placeholder={emailText ? '' : "Click generate to draft an email"}
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={copyEmail}
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg shadow-sm hover:bg-blue-700 transition-colors text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
          </>
        )}

        {/* RA Notes */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm p-3">
          <h2 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">RA Notes</h2>
          {!isCreated ? (
            <div className="flex items-center justify-center py-4">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <div className="text-xs">RA notes will be available after issue creation</div>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-700 mb-2">
                {raMessages.length === 0 ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">No notes yet.</div>
                ) : (
                  raMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className="w-fit max-w-[85%] rounded-lg px-2 py-1 bg-white dark:bg-gray-600 shadow text-xs break-words whitespace-pre-wrap overflow-hidden text-gray-900 dark:text-white"
                    >
                      <div className="mb-1">{m}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                        - {raName || 'Unknown User'}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-1 items-stretch">
                <input
                  className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-xs"
                  placeholder="Type a note…"
                  value={raInput}
                  onChange={(e) => setRaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendRaNote()}
                />
                <button
                  onClick={sendRaNote}
                  className="whitespace-nowrap px-2 py-1 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors text-xs"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
