/**
 * ToolSelector
 *
 * Toggle available MCP tools on/off. Grouped by server.
 */
import { useContext, useState } from "react";
import { Caption2, Checkbox, ThemeContext } from "@trops/dash-react";

export const ToolSelector = ({ servers, enabledTools, onToggle }) => {
    const [expanded, setExpanded] = useState(false);
    const { currentTheme } = useContext(ThemeContext);
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";

    const totalTools = servers.reduce(
        (sum, s) => sum + (s.tools?.length || 0),
        0
    );
    const enabledCount = Object.values(enabledTools).filter(Boolean).length;

    if (totalTools === 0) return null;

    return (
        <div className="text-xs">
            <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${rowHover} ${
                    currentTheme?.["text-primary-medium"] || ""
                }`}
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
                <Caption2 className="opacity-70">
                    {expanded ? "\u25B2" : "\u25BC"}
                </Caption2>
            </button>
            {expanded && (
                <div
                    className={`mt-1 p-2 rounded-md border max-h-48 overflow-y-auto space-y-2 ${
                        currentTheme?.["bg-primary-dark"] || ""
                    } ${currentTheme?.["border-primary-dark"] || ""}`}
                >
                    {servers.map((server) => (
                        <div key={server.serverName}>
                            <Caption2 block className="font-medium mb-1">
                                {server.serverName}
                            </Caption2>
                            <div className="space-y-0.5 ml-2">
                                {server.tools.map((tool) => (
                                    <Checkbox
                                        key={tool.name}
                                        checked={
                                            enabledTools[tool.name] !== false
                                        }
                                        onChange={() => onToggle(tool.name)}
                                        label={
                                            <span className="text-xs font-mono">
                                                {tool.name}
                                            </span>
                                        }
                                        className={`py-0.5 cursor-pointer rounded px-1 ${rowHover}`}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
