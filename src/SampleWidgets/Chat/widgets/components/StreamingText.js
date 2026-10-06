/**
 * StreamingText
 *
 * Renders partial text with a blinking cursor while streaming is active.
 *
 * Theme tokens arrive as props (from ChatMessages) rather than via
 * ThemeContext: this file is loaded by MessageBubble's jest test, which
 * cannot import @trops/dash-react's ESM bundle.
 */
export const StreamingText = ({ text, isStreaming, currentTheme }) => {
    if (!text && !isStreaming) return null;

    return (
        <span className="whitespace-pre-wrap break-words">
            {text}
            {isStreaming && (
                <span
                    className={`inline-block w-2 h-4 ml-0.5 animate-pulse align-text-bottom ${
                        currentTheme?.["bg-secondary-medium"] || ""
                    }`}
                />
            )}
        </span>
    );
};
