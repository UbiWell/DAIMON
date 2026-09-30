import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import API_BASE_URL from '@/config/api';

const GLOSSSearch = ({ view, updateView }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);

    const localStorageKey = `gloss_result_${view.id}`;

    useEffect(() => {
        const savedResult = localStorage.getItem(localStorageKey);
        if (savedResult) {
            try {
                const parsed = JSON.parse(savedResult);
                setResult(parsed);
            } catch (err) {
                console.error("Failed to parse saved result:", err);
            }
        }
    }, [view.id]);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setResult(null);

        try {
            const res = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(query)}`);
            const data = await res.json();

            updateView({
                width: 5,
                height: 5,
                minSize: [5, 5],
            });

            setResult(data);
            localStorage.setItem(localStorageKey, JSON.stringify(data));

        } catch (err) {
            console.error("Search failed:", err);
            const errorResult = { error: "Search failed. Please try again." };
            setResult(errorResult);
            localStorage.setItem(localStorageKey, JSON.stringify(errorResult));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col w-full h-full p-4 space-y-4">
            {/* Search box at the top */}
            <div className="flex items-center w-full space-x-2 mb-2">
                <Input
                    type="text"
                    placeholder="Enter query..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1"
                />
                <Button
                    onClick={handleSearch}
                    className="flex items-center bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 transition-colors"
                >
                    <Search className="w-5 h-5 mr-1" />
                </Button>
            </div>

            {/* Loading indicator */}
            {isLoading && (
                <div className="w-full h-2 bg-gray-200 rounded">
                    <div className="h-full bg-blue-500 animate-pulse rounded" style={{ width: '100%' }} />
                </div>
            )}

            {/* Fixed-size result container */}
            <div className="flex-1 w-full bg-gray-50 border border-gray-200 p-4 rounded shadow overflow-y-auto max-h-[calc(100%-100px)]">
                {result?.results ? (
                    <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 font-mono select-text">
                        {result.results.trim()}
                    </pre>
                ) : (
                    !isLoading && <p className="text-sm text-gray-500 italic">No results yet. Try searching above.</p>
                )}
            </div>
        </div>
    );
};

export default GLOSSSearch;
