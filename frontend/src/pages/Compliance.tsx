import React, { useState, useEffect } from 'react';
import { Edit, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const Compliance = ({ view, updateView }) => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    const localStorageKey = `compliance_text_${view.id}`;
    const submittedKey = `compliance_submitted_${view.id}`;

    useEffect(() => {
        const savedText = localStorage.getItem(localStorageKey);
        const wasSubmitted = localStorage.getItem(submittedKey);
        
        if (savedText) {
            setText(savedText);
        }
        if (wasSubmitted === 'true') {
            setSubmitted(true);
        }
    }, [view.id]);

    const handleSubmit = async () => {
        if (!text.trim()) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            // const response = await fetch('http://localhost:8080/api/compliance', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ 
            //         text: text.trim(),
            //         viewId: view.id,
            //         timestamp: new Date().toISOString()
            //     })
            // });

            // if (!response.ok) throw new Error('Failed to submit compliance text');

            setSubmitted(true);
            localStorage.setItem(localStorageKey, text);
            localStorage.setItem(submittedKey, 'true');
            
            // Update view size if needed
            updateView({
                width: 5,
                height: 5,
                minSize: [5, 5],
            });

        } catch (err) {
            console.error('Error submitting compliance text:', err);
            setError('There was a problem submitting your compliance text. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = () => {
        setSubmitted(false);
        setError(null);
        localStorage.setItem(submittedKey, 'false');
    };

    return (
        <div className="w-full h-full flex flex-col p-4 overflow-auto">
            <div className="flex flex-col space-y-4 w-full h-full max-h-full">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">Compliance Notes</h2>
                    {submitted && (
                        <Button
                            onClick={handleEdit}
                            className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700 transition-colors"
                            size="sm"
                        >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                        </Button>
                    )}
                </div>

                {/* Content area */}
                <div className="flex-1 w-full bg-gray-50 border border-gray-200 rounded shadow overflow-hidden">
                    {submitted ? (
                        // Display mode after submission
                        <div className="w-full h-full p-4 overflow-y-auto">
                            <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 font-mono select-text">
                                {text}
                            </pre>
                        </div>
                    ) : (
                        // Edit mode (default state)
                        <Textarea
                            placeholder="Enter compliance notes, procedures, or documentation..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="w-full h-full resize-none border-none outline-none bg-white text-sm text-gray-800 font-mono p-4"
                            style={{ minHeight: 'calc(100% - 0px)' }}
                        />
                    )}
                </div>

                {/* Submit button when in edit mode */}
                {!submitted && (
                    <Button
                        onClick={handleSubmit}
                        disabled={!text.trim() || isLoading}
                        className="bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-800 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 mr-2 animate-spin border-2 border-green-600 border-t-transparent rounded-full" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Submit
                    </Button>
                )}

                {/* Status messages */}
                {submitted && (
                    <p className="text-sm text-green-600">Submission successful!</p>
                )}
                {error && (
                    <p className="text-sm text-red-600">{error}</p>
                )}
            </div>
        </div>
    );
};

export default Compliance;