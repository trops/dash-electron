/**
 * ToolCallBlock
 *
 * Collapsible display of an MCP tool call and its result.
 */
import { useState } from "react";

export const ToolCallBlock = ({ toolName, serverName, input, result, isError, isLoading }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="my-1.5 border border-gray-700 rounded-md overflow-hidden text-xs">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-800 transition-colors text-left"
            >
                {isLoading ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                ) : isError ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                )}
                <span className="font-mono text-indigo-300">{toolName}</span>
                {serverName && (
                    <span className="text-gray-600">via {serverName}</span>
                )}
                <span className="ml-auto text-gray-600">
                    {expanded ? "\u25B2" : "\u25BC"}
                </span>
            </button>
            {expanded && (
                <div className="px-2.5 py-2 space-y-2 bg-gray-900/50">
                    {input && (
                        <div>
                            <div className="text-gray-500 mb-0.5">Input:</div>
                            <pre className="text-gray-400 bg-black/30 p-1.5 rounded overflow-x-auto max-h-32 overflow-y-auto">
                                {typeof input === "string"
                                    ? input
                                    : JSON.stringify(input, null, 2)}
                            </pre>
                        </div>
                    )}
                    {result !== undefined && (
                        <div>
                            <div className="text-gray-500 mb-0.5">Result:</div>
                            <pre
                                className={`p-1.5 rounded overflow-x-auto max-h-48 overflow-y-auto ${
                                    isError
                                        ? "text-red-400 bg-red-950/30"
                                        : "text-gray-400 bg-black/30"
                                }`}
                            >
                                {typeof result === "string"
                                    ? result
                                    : JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    )}
                    {isLoading && (
                        <div className="text-yellow-400 italic">
                            Running...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
