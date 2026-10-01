/**
 * ChatInput
 *
 * Input bar with send button. Supports Enter to send, Shift+Enter for newline.
 */
import { useState, useRef, useEffect } from "react";
import { Button, Button2 } from "@trops/dash-react";

// When the widget mounts on a page that isn't visible yet, scrollHeight is 0 —
// pinning that as an inline height collapses the input to a sliver, so leave
// the natural (rows=1) height until it can actually be measured.
const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    if (el.scrollHeight === 0) {
        el.style.height = "";
        return;
    }
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
};

export const ChatInput = ({ onSend, onStop, isLoading, disabled }) => {
    const [input, setInput] = useState("");
    const textareaRef = useRef(null);

    // Auto-resize textarea; re-measure once the input's container actually
    // gets laid out (e.g. its page tab becomes visible).
    useEffect(() => {
        autoResize(textareaRef.current);
    }, [input]);

    useEffect(() => {
        const el = textareaRef.current;
        const parent = el?.parentElement;
        if (!parent || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => autoResize(el));
        observer.observe(parent);
        return () => observer.disconnect();
    }, []);

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
                <Button2 onClick={onStop} danger className="shrink-0">
                    Stop
                </Button2>
            ) : (
                <Button
                    onClick={handleSend}
                    disabled={!input.trim() || disabled}
                    className="shrink-0"
                >
                    Send
                </Button>
            )}
        </div>
    );
};
