/**
 * MessageBubble
 *
 * Renders a single message — user, assistant (with markdown), or tool-use blocks.
 */
import { StreamingText } from "./StreamingText";
import { ToolCallBlock } from "./ToolCallBlock";

/**
 * Simple markdown renderer for assistant messages.
 * Uses @uiw/react-md-editor's preview component if available,
 * otherwise falls back to a <pre> block.
 */
let MDPreview = null;
try {
    const MDEditor = require("@uiw/react-md-editor");
    MDPreview = MDEditor.default?.Markdown || null;
} catch {
    // Will fall back to <pre>
}

function AssistantTextContent({ text }) {
    if (!text) return null;

    if (MDPreview) {
        return (
            <div
                className="prose prose-invert prose-sm max-w-none
                    prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1
                    prose-pre:bg-black/40 prose-pre:text-gray-300 prose-code:text-indigo-300
                    prose-a:text-indigo-400"
                data-color-mode="dark"
            >
                <MDPreview source={text} />
            </div>
        );
    }

    return (
        <pre className="whitespace-pre-wrap break-words text-gray-200">
            {text}
        </pre>
    );
}

export const MessageBubble = ({ message, isStreaming, streamingText }) => {
    const { role, content, toolCalls } = message;

    if (role === "user") {
        // Extract text from user message content
        const text =
            typeof content === "string"
                ? content
                : Array.isArray(content)
                ? content
                      .filter((c) => c.type === "text")
                      .map((c) => c.text)
                      .join("")
                : "";

        return (
            <div className="flex justify-end mb-3">
                <div className="max-w-[85%] px-3 py-2 rounded-lg bg-indigo-700/50 text-gray-100 text-sm whitespace-pre-wrap break-words">
                    {text}
                </div>
            </div>
        );
    }

    if (role === "assistant") {
        // Build text from content blocks
        const textParts = [];
        const toolBlocks = [];

        if (Array.isArray(content)) {
            for (const block of content) {
                if (block.type === "text") {
                    textParts.push(block.text);
                } else if (block.type === "tool_use") {
                    // Find matching tool call info
                    const callInfo = toolCalls?.find(
                        (tc) => tc.toolUseId === block.id
                    );
                    toolBlocks.push({
                        ...block,
                        serverName: callInfo?.serverName,
                        result: callInfo?.result,
                        isError: callInfo?.isError,
                        isLoading: callInfo?.isLoading,
                    });
                }
            }
        } else if (typeof content === "string") {
            textParts.push(content);
        }

        const text = textParts.join("");

        return (
            <div className="mb-3">
                <div className="max-w-[95%] text-sm">
                    {/* Streaming text (active response) */}
                    {isStreaming && (
                        <div className="text-gray-200">
                            <StreamingText
                                text={streamingText}
                                isStreaming={true}
                            />
                        </div>
                    )}

                    {/* Final rendered text */}
                    {!isStreaming && text && (
                        <AssistantTextContent text={text} />
                    )}

                    {/* Tool call blocks */}
                    {toolBlocks.map((block) => (
                        <ToolCallBlock
                            key={block.id}
                            toolName={block.name}
                            serverName={block.serverName}
                            input={block.input}
                            result={block.result}
                            isError={block.isError}
                            isLoading={block.isLoading}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return null;
};
