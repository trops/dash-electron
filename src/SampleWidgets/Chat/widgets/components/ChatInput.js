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

// Theme tokens arrive as the `currentTheme` prop (from ChatCore) rather
// than via ThemeContext: ChatInput's jest test stubs @trops/dash-react with
// only the buttons, so a ThemeContext import would be undefined there.
export const ChatInput = ({
    onSend,
    onStop,
    isLoading,
    disabled,
    currentTheme,
}) => {
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
        <div
            className={`flex items-end gap-2 px-3 py-2 border-t ${
                currentTheme?.["border-primary-dark"] || ""
            }`}
        >
            <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={disabled}
                rows={1}
                className={`flex-1 px-3 py-2 border rounded-lg text-sm resize-none disabled:opacity-50 ${
                    currentTheme?.["bg-primary-dark"] || ""
                } ${currentTheme?.["border-primary-dark"] || ""} ${
                    currentTheme?.["text-primary-medium"] || ""
                }`}
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
