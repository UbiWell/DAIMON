import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import API_BASE_URL from '@/config/api';

const IssueReport = () => {
    const [issue, setIssue] = useState('');
    const [reason, setReason] = useState('');
    const [resolution, setResolution] = useState('');
    const [participants, setParticipants] = useState(''); // New state
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async () => {
        const payload = {
            timestamp: new Date().toISOString(),
            issue,
            reason,
            resolution,
            participants, // Include participants (optional)
        };

        try {
            const response = await fetch(`${API_BASE_URL}/report-issue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to submit issue');

            setSubmitted(true);
            setError(null);
            setIssue('');
            setReason('');
            setResolution('');
            setParticipants(''); // Clear participants after submit
        } catch (err) {
            console.error('Error submitting issue:', err);
            setError('There was a problem submitting your issue. Please try again.');
        }
    };

    return (
        <div className="w-full h-full flex flex-col p-4 overflow-auto">
            <div className="flex flex-col space-y-4 w-full h-full max-h-full">
                <h2 className="text-xl font-semibold text-gray-800">Report an Issue</h2>

                <Input
                    placeholder="Brief Issue Title"
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                />

                <Input
                    placeholder="Participants (optional)"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                />

                <Textarea
                    placeholder="Describe the the issue..."
                    rows={4}
                    className="resize-none"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />

                <Textarea
                    placeholder="Describe how it was or can be resolved..."
                    rows={4}
                    className="resize-none"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                />

                <Button
                    onClick={handleSubmit}
                    className="bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-800 transition-colors"
                    disabled={!issue.trim() || !reason.trim() || !resolution.trim()}
                >
                    Submit Report
                </Button>

                {submitted && <p className="text-sm text-green-600">Report submitted successfully!</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        </div>
    );
};

export default IssueReport;
