/**
 * ToolSelector
 *
 * Toggle available MCP tools on/off. Grouped by server.
 */
import { useState } from "react";

export const ToolSelector = ({ servers, enabledTools, onToggle }) => {
    const [expanded, setExpanded] = useState(false);

    const totalTools = servers.reduce(
        (sum, s) => sum + (s.tools?.length || 0),
        0,
    );
    const enabledCount = Object.values(enabledTools).filter(Boolean).length;

    if (totalTools === 0) return null;

    return (
        <div className="text-xs">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors text-gray-400"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                >
                    <path
                        fillRule="evenodd"
                        d="M14.5 10a4.5 4.5 0 004.284-5.882c-.105-.324-.51-.391-.752-.15L15.34 6.66a.454.454 0 01-.493.11 3.01 3.01 0 01-1.618-1.616.455.455 0 01.11-.494l2.694-2.692c.24-.241.174-.647-.15-.752a4.5 4.5 0 00-5.873 4.575c.055.873-.128 1.808-.8 2.368l-7.23 6.024a2.724 2.724 0 103.837 3.837l6.024-7.23c.56-.672 1.495-.855 2.368-.8.096.007.193.01.291.01zM5 16a1 1 0 11-2 0 1 1 0 012 0z"
                        clipRule="evenodd"
                    />
                </svg>
                <span>
                    Tools ({enabledCount}/{totalTools})
                </span>
                <span className="text-gray-600">
                    {expanded ? "\u25B2" : "\u25BC"}
                </span>
            </button>
            {expanded && (
                <div className="mt-1 p-2 bg-gray-800/50 rounded-md border border-gray-700 max-h-48 overflow-y-auto space-y-2">
                    {servers.map((server) => (
                        <div key={server.serverName}>
                            <div className="text-gray-500 font-medium mb-1">
                                {server.serverName}
                            </div>
                            <div className="space-y-0.5 ml-2">
                                {server.tools.map((tool) => (
                                    <label
                                        key={tool.name}
                                        className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-white/5 rounded px-1"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={
                                                enabledTools[tool.name] !== false
                                            }
                                            onChange={() => onToggle(tool.name)}
                                            className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 w-3 h-3"
                                        />
                                        <span className="text-gray-300 font-mono">
                                            {tool.name}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
