import { useState, useRef, useEffect } from "react";
import { Plus, Minus } from "lucide-react";

const colors = ["#FFF9C4", "#E1F5FE", "#E8F5E9", "#FCE4EC", "#F5F5F5"];

const FridgeNote = ({ view }) => {
    const [text, setText] = useState("Write your note here...");
    const [highlightColor, setHighlightColor] = useState(colors[0]);
    const [fontSize, setFontSize] = useState(50); // Default font size 50px
    const divRef = useRef(null);

    const localStorageKey = `stickies_${view.id}`;

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(localStorageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setText(parsed.text || "");
                setHighlightColor(parsed.highlightColor || colors[0]);
                setFontSize(parsed.fontSize || 50);
            } catch (err) {
                console.error("Failed to parse saved note:", err);
            }
        }
    }, [view.id]);

    // Save to localStorage
    useEffect(() => {
        const data = JSON.stringify({ text, highlightColor, fontSize });
        localStorage.setItem(localStorageKey, data);
    }, [text, highlightColor, fontSize, localStorageKey]);

    const handleInput = (e) => {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const cursorPosition = range.startOffset;

        setText(e.currentTarget.textContent || "");

        setTimeout(() => {
            const newRange = document.createRange();
            const newSelection = window.getSelection();
            if (divRef.current.childNodes.length > 0) {
                newRange.setStart(divRef.current.childNodes[0], cursorPosition);
                newRange.collapse(true);
                newSelection.removeAllRanges();
                newSelection.addRange(newRange);
            }
        }, 0);
    };

    const handleFontSizeChange = (increase: boolean) => {
        if (increase) {
            setFontSize(prev => Math.min(prev + 20, 180)); // Max 180px, increments of 20
        } else {
            setFontSize(prev => Math.max(prev - 20, 20)); // Min 20px, increments of 20
        }
    };

    return (
        <div className="relative p-4 w-full h-[95%] bg-white">
            {/* Font size controls - top left */}
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/80 rounded-lg p-1 shadow-sm border border-gray-200 z-10">
                <button
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                    onClick={() => handleFontSizeChange(false)}
                    title="Decrease text size"
                >
                    <Minus className="w-4 h-4 text-gray-700" />
                </button>
                <span className="text-xs text-gray-600 px-1 min-w-[2rem] text-center">
                    {fontSize}px
                </span>
                <button
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                    onClick={() => handleFontSizeChange(true)}
                    title="Increase text size"
                >
                    <Plus className="w-4 h-4 text-gray-700" />
                </button>
            </div>
            
            {/* Color picker - top right */}
            <div className="absolute top-2 right-2 flex space-x-1 z-10">
                {colors.map((color) => (
                    <button
                        key={color}
                        className="w-5 h-5 rounded-full border border-gray-400"
                        style={{ backgroundColor: color }}
                        onClick={() => setHighlightColor(color)}
                    />
                ))}
            </div>

            <div
                ref={divRef}
                className="mt-8 p-2 w-full h-[90%] outline-none text-black"
                contentEditable
                suppressContentEditableWarning
                style={{ 
                    backgroundColor: highlightColor,
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.5'
                }}
                onInput={handleInput}
            >
                {text}
            </div>
        </div>
    );
};

export default FridgeNote;
