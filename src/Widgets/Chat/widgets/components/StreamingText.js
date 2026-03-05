/**
 * StreamingText
 *
 * Renders partial text with a blinking cursor while streaming is active.
 */
export const StreamingText = ({ text, isStreaming }) => {
    if (!text && !isStreaming) return null;

    return (
        <span className="whitespace-pre-wrap break-words">
            {text}
            {isStreaming && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-indigo-400 animate-pulse align-text-bottom" />
            )}
        </span>
    );
};
