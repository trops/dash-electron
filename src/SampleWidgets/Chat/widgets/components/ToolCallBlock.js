/**
 * ToolCallBlock
 *
 * Collapsible display of an MCP tool call and its result.
 *
 * Theme / status tokens arrive as props (from ChatMessages via
 * MessageBubble) rather than via ThemeContext / useStatusTokens: this file
 * is loaded by MessageBubble's jest test, which cannot import
 * @trops/dash-react's ESM bundle.
 */
import { useState } from "react";

export const ToolCallBlock = ({
    toolName,
    serverName,
    input,
    result,
    isError,
    isLoading,
    currentTheme,
    statusTokens,
}) => {
    const [expanded, setExpanded] = useState(false);

    const border = currentTheme?.["border-primary-dark"] || "";
    const surface = currentTheme?.["bg-primary-dark"] || "";
    const surfaceHover = currentTheme?.["hover-bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";
    const mutedText = `${bodyText} opacity-70`;

    return (
        <div
            className={`my-1.5 border ${border} rounded-md overflow-hidden text-xs`}
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 transition-colors text-left ${surface} ${surfaceHover}`}
            >
                {isLoading ? (
                    <span
                        className={`inline-block w-2 h-2 rounded-full animate-pulse ${
                            statusTokens?.warning?.solidBg || ""
                        }`}
                    />
                ) : isError ? (
                    <span
                        className={`inline-block w-2 h-2 rounded-full ${
                            statusTokens?.error?.solidBg || ""
                        }`}
                    />
                ) : (
                    <span
                        className={`inline-block w-2 h-2 rounded-full ${
                            statusTokens?.success?.solidBg || ""
                        }`}
                    />
                )}
                <span className={`font-mono ${accentText}`}>{toolName}</span>
                {serverName && (
                    <span className={mutedText}>via {serverName}</span>
                )}
                <span className={`ml-auto ${mutedText}`}>
                    {expanded ? "▲" : "▼"}
                </span>
            </button>
            {expanded && (
                <div className={`px-2.5 py-2 space-y-2 border-t ${border}`}>
                    {input && (
                        <div>
                            <div className={`mb-0.5 ${mutedText}`}>Input:</div>
                            <pre
                                className={`p-1.5 rounded overflow-x-auto max-h-32 overflow-y-auto font-mono ${surface} ${bodyText}`}
                            >
                                {typeof input === "string"
                                    ? input
                                    : JSON.stringify(input, null, 2)}
                            </pre>
                        </div>
                    )}
                    {result !== undefined && (
                        <div>
                            <div className={`mb-0.5 ${mutedText}`}>Result:</div>
                            <pre
                                className={`p-1.5 rounded overflow-x-auto max-h-48 overflow-y-auto font-mono ${
                                    isError
                                        ? `${statusTokens?.error?.bg || ""} ${
                                              statusTokens?.error?.text || ""
                                          }`
                                        : `${surface} ${bodyText}`
                                }`}
                            >
                                {typeof result === "string"
                                    ? result
                                    : JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    )}
                    {isLoading && (
                        <div
                            className={`italic ${
                                statusTokens?.warning?.icon || ""
                            }`}
                        >
                            Running...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
