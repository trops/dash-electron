/**
 * ChatInput
 *
 * Input bar with send button. Supports Enter to send, Shift+Enter for newline.
 */
import { useState, useRef, useEffect } from "react";

export const ChatInput = ({ onSend, onStop, isLoading, disabled }) => {
    const [input, setInput] = useState("");
    const textareaRef = useRef(null);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
        }
    }, [input]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;
        onSend(trimmed);
        setInput("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex items-end gap-2 px-3 py-2 border-t border-gray-700/50">
            <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={disabled}
                rows={1}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
            />
            {isLoading ? (
                <button
                    onClick={onStop}
                    className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors shrink-0"
                >
                    Stop
                </button>
            ) : (
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || disabled}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shrink-0"
                >
                    Send
                </button>
            )}
        </div>
    );
};
