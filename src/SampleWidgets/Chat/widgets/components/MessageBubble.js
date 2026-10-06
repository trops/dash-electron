/**
 * MessageBubble
 *
 * Renders a single message — user, assistant (with markdown), or tool-use blocks.
 *
 * Theme / status tokens arrive as props (from ChatMessages) rather than via
 * ThemeContext / useStatusTokens: this file is loaded by its jest test,
 * which cannot import @trops/dash-react's ESM bundle.
 */
import { StreamingText } from "./StreamingText";
import { ToolCallBlock } from "./ToolCallBlock";
import { renderSafeMarkdown } from "@trops/dash-core";

function AssistantTextContent({ text, bodyText }) {
    if (!text) return null;

    // Replies can quote untrusted content (emails, web pages): Markdown is
    // rendered through dash-core's sanitizer. On an older app without it,
    // fall back to plain text — never unsanitized HTML.
    if (typeof renderSafeMarkdown !== "function") {
        return (
            <div
                className={`text-sm whitespace-pre-wrap leading-relaxed ${bodyText}`}
            >
                {text}
            </div>
        );
    }
    const html = renderSafeMarkdown(text);

    return (
        <div
            className={`prose prose-sm max-w-none
                prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1
                ${bodyText}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export const MessageBubble = ({
    message,
    isStreaming,
    streamingText,
    currentTheme,
    statusTokens,
}) => {
    const { role, content, toolCalls } = message;
    const bodyText = currentTheme?.["text-primary-medium"] || "";

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
            <div className="flex justify-end mb-3 pl-8">
                <div
                    className={`px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${
                        currentTheme?.["bg-secondary-dark"] || ""
                    } ${currentTheme?.["text-secondary-light"] || ""}`}
                >
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
                <div className="text-sm pr-4">
                    {/* Streaming text (active response) */}
                    {isStreaming && (
                        <div className={bodyText}>
                            <StreamingText
                                text={streamingText}
                                isStreaming={true}
                                currentTheme={currentTheme}
                            />
                        </div>
                    )}

                    {/* Final rendered text */}
                    {!isStreaming && text && (
                        <AssistantTextContent text={text} bodyText={bodyText} />
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
                            currentTheme={currentTheme}
                            statusTokens={statusTokens}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return null;
};
