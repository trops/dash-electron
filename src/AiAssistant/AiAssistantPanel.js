/**
 * AiAssistantPanel
 *
 * Right-side collapsible panel for the AI Assistant.
 * Part of the app shell — always available regardless of dashboard state.
 * Reads AI settings from AppContext and passes them to ChatCore.
 *
 * When using Claude Code CLI backend, shows a setup guide for connecting
 * the Dash MCP server so the assistant can manage dashboards.
 */
import React, { useState, useContext, useEffect, useCallback } from "react";
import { FontAwesomeIcon, ThemeContext } from "@trops/dash-react";
import { ChatCore, AppContext } from "@trops/dash-core";

const DEFAULT_SYSTEM_PROMPT = `You are the Dash AI Assistant — a helpful assistant built into the Dash desktop application. You help users manage dashboards, configure widgets, set up providers, and troubleshoot issues.

You have access to MCP tools that let you create and modify dashboards, add widgets, manage themes, and configure providers. Use these tools when the user asks you to perform dashboard operations.

IMPORTANT: If the user asks you to BUILD or CREATE a new custom widget, respond with exactly this text on its own line: [OPEN_WIDGET_BUILDER] — this will automatically open the Widget Builder for them. Do NOT create widget files yourself. The Widget Builder has a dedicated compile and install pipeline. You can help with adding EXISTING widgets to dashboards, configuring them, and managing layouts.

Be concise and helpful. When performing actions, explain what you're doing briefly.

If this is your FIRST response in the conversation, do NOT perform any actions or call tools yet. Reply with 1–2 short sentences: greet the user and mention a few example requests you can handle (adding widgets to a dashboard, switching themes, configuring providers, building new widgets). Keep it under 40 words total. No lists — fold the examples naturally into the sentences.`;

/**
 * McpSetupBanner — shown when CLI backend is selected and user may need
 * to connect the Dash MCP server to Claude Code for full functionality.
 */
const McpSetupBanner = () => {
    const [mcpStatus, setMcpStatus] = useState(null);
    const [token, setToken] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const mainApi = window.mainApi;
    const port = mcpStatus?.port || 3141;

    useEffect(() => {
        if (!mainApi?.mcpDashServer) return;
        mainApi.mcpDashServer
            .getStatus()
            .then(setMcpStatus)
            .catch(() => {});
        mainApi.mcpDashServer
            .getToken()
            .then(setToken)
            .catch(() => {});
    }, [mainApi]);

    const command = `claude mcp add dash -- npx mcp-remote https://127.0.0.1:${port}/mcp --header "Authorization: Bearer ${
        token || "YOUR_TOKEN"
    }"`;

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [command]);

    const handleStartServer = useCallback(() => {
        if (!mainApi?.mcpDashServer) return;
        mainApi.mcpDashServer
            .startServer()
            .then(() => mainApi.mcpDashServer.getStatus())
            .then(setMcpStatus)
            .catch(() => {});
    }, [mainApi]);

    const isConnected = mcpStatus?.running;

    return (
        <div className="mx-2 my-2 shrink-0">
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                    isConnected
                        ? "bg-green-900/20 border border-green-700/40 text-green-400 hover:bg-green-900/30"
                        : "bg-indigo-900/30 border border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/40"
                }`}
            >
                {isConnected ? (
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" />
                ) : (
                    <FontAwesomeIcon icon="plug" className="h-3 w-3" />
                )}
                <span className="flex-1 text-left">
                    {isConnected
                        ? "Connected to Dash MCP Server"
                        : "Connect Dash tools to Claude Code"}
                </span>
                <FontAwesomeIcon
                    icon={expanded ? "chevron-up" : "chevron-down"}
                    className="h-2.5 w-2.5 opacity-50"
                />
            </button>

            {expanded && (
                <div className="mt-2 p-3 rounded-lg bg-gray-800/80 border border-gray-700/50 text-xs space-y-3">
                    {/* Step 1: MCP Server */}
                    <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold">
                            1
                        </span>
                        <div className="flex-1">
                            <div className="text-gray-300 font-medium">
                                Enable the MCP Server
                            </div>
                            {mcpStatus?.running ? (
                                <div className="flex items-center gap-1.5 mt-1 text-green-400">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                                    Running on port {port}
                                </div>
                            ) : (
                                <div className="mt-1">
                                    <span className="text-gray-500">
                                        Server is not running.{" "}
                                    </span>
                                    <button
                                        onClick={handleStartServer}
                                        className="text-indigo-400 hover:text-indigo-300 underline"
                                    >
                                        Start now
                                    </button>
                                    <span className="text-gray-500">
                                        {" "}
                                        or enable in Settings &gt; MCP Server.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Run command */}
                    <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold">
                            2
                        </span>
                        <div className="flex-1">
                            <div className="text-gray-300 font-medium">
                                Run this in your terminal
                            </div>
                            <div className="mt-1.5 relative">
                                <pre className="p-2 rounded bg-black/40 text-gray-400 overflow-x-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">
                                    {command}
                                </pre>
                                <button
                                    onClick={handleCopy}
                                    className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] transition-colors"
                                >
                                    {copied ? "Copied!" : "Copy"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Restart */}
                    <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold">
                            3
                        </span>
                        <div className="flex-1">
                            <div className="text-gray-300 font-medium">
                                Restart the AI Assistant
                            </div>
                            <div className="text-gray-500 mt-0.5">
                                Click &quot;New Chat&quot; to start a fresh
                                session with Dash tools available.
                            </div>
                        </div>
                    </div>

                    <div className="pt-1 text-gray-600 text-[10px]">
                        This connects the Dash MCP server to Claude Code so it
                        can manage your dashboards, widgets, and themes.
                    </div>
                </div>
            )}
        </div>
    );
};

export const AiAssistantPanel = () => {
    const [collapsed, setCollapsed] = useState(true);
    const [width, setWidth] = useState(384);
    const isDragging = React.useRef(false);
    const appContext = useContext(AppContext);
    const { currentTheme } = useContext(ThemeContext);
    const bgDark = currentTheme?.["bg-primary-dark"] || "bg-gray-900";
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700/50";

    const settings = appContext?.settings || {};
    const providers = appContext?.providers || {};
    const aiSettings = settings.aiAssistant || {};

    // Watch for [OPEN_WIDGET_BUILDER] marker in assistant messages
    useEffect(() => {
        if (collapsed) return;
        const interval = setInterval(() => {
            try {
                const raw = localStorage.getItem("dash-ai-assistant");
                if (raw) {
                    const data = JSON.parse(raw);
                    const msgs = data?.messages || [];
                    for (let i = msgs.length - 1; i >= 0; i--) {
                        if (msgs[i].role !== "assistant") continue;
                        const text =
                            typeof msgs[i].content === "string"
                                ? msgs[i].content
                                : Array.isArray(msgs[i].content)
                                ? msgs[i].content
                                      .filter((c) => c.type === "text")
                                      .map((c) => c.text)
                                      .join("")
                                : "";
                        if (text.includes("[OPEN_WIDGET_BUILDER]")) {
                            window.dispatchEvent(
                                new Event("dash:open-widget-builder")
                            );
                            // Remove the marker so it doesn't trigger again
                            msgs[i].content =
                                typeof msgs[i].content === "string"
                                    ? msgs[i].content.replace(
                                          "[OPEN_WIDGET_BUILDER]",
                                          "Opening Widget Builder..."
                                      )
                                    : msgs[i].content;
                            localStorage.setItem(
                                "dash-ai-assistant",
                                JSON.stringify(data)
                            );
                            clearInterval(interval);
                            return;
                        }
                        break; // only check the last assistant message
                    }
                }
            } catch (e) {
                /* ignore */
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [collapsed]);

    // Resolve backend and API key from settings
    const preferredBackend = aiSettings.preferredBackend || "claude-code";
    const model = aiSettings.model || "claude-sonnet-4-20250514";
    const isCliBackend = preferredBackend === "claude-code";

    // Find Anthropic provider for API key
    const anthropicEntry = Object.entries(providers).find(
        ([, p]) =>
            p.type === "anthropic" &&
            (p.providerClass || "credential") === "credential"
    );
    const apiKey = anthropicEntry?.[1]?.credentials?.apiKey || null;

    // Resize handler
    const handleMouseDown = useCallback(
        (e) => {
            e.preventDefault();
            isDragging.current = true;
            const startX = e.clientX;
            const startWidth = width;

            const handleMouseMove = (e) => {
                if (!isDragging.current) return;
                const delta = startX - e.clientX;
                const newWidth = Math.min(
                    Math.max(startWidth + delta, 320),
                    700
                );
                setWidth(newWidth);
            };

            const handleMouseUp = () => {
                isDragging.current = false;
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
        },
        [width]
    );

    if (collapsed) {
        return (
            <div
                className={`flex flex-col items-center w-10 border-l ${borderColor} ${bgDark} shrink-0 h-screen`}
            >
                <button
                    onClick={() => setCollapsed(false)}
                    className="mt-3 p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200"
                    title="Open AI Assistant"
                >
                    <FontAwesomeIcon
                        icon="wand-magic-sparkles"
                        className="h-4 w-4"
                    />
                </button>
            </div>
        );
    }

    return (
        <div
            className="flex flex-row shrink-0 h-screen"
            style={{ width: `${width}px` }}
        >
            {/* Resize handle */}
            <div
                onMouseDown={handleMouseDown}
                className="w-1 cursor-col-resize hover:bg-gray-500/30 active:bg-gray-500/50 transition-colors shrink-0"
            />

            {/* Panel content */}
            <div
                className={`flex flex-col flex-1 min-w-0 ${bgDark} overflow-hidden`}
            >
                {/* Header */}
                <div
                    className={`flex items-center justify-between px-3 py-1.5 border-b ${borderColor} shrink-0`}
                >
                    <div className="flex items-center gap-2 text-gray-400">
                        <FontAwesomeIcon
                            icon="wand-magic-sparkles"
                            className="h-3 w-3"
                        />
                        <span className="text-xs font-medium uppercase tracking-wide">
                            AI Assistant
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() =>
                                window.dispatchEvent(
                                    new Event("dash:open-widget-builder")
                                )
                            }
                            className="p-1 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-300"
                            title="Build Widget with AI"
                        >
                            <FontAwesomeIcon icon="cube" className="h-3 w-3" />
                        </button>
                        <button
                            onClick={() => setCollapsed(true)}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-300"
                            title="Collapse"
                        >
                            <FontAwesomeIcon
                                icon="chevron-right"
                                className="h-3 w-3"
                            />
                        </button>
                    </div>
                </div>

                {/* MCP setup banner for CLI backend */}
                {isCliBackend && <McpSetupBanner />}

                {/* ChatCore */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <ChatCore
                        title=""
                        model={model}
                        systemPrompt={DEFAULT_SYSTEM_PROMPT}
                        maxToolRounds="10"
                        apiKey={apiKey}
                        backend={preferredBackend}
                        sessionKey="dash-ai-assistant"
                        hideToolsBanner={true}
                        initialMessage="Hi"
                    />
                </div>
            </div>
        </div>
    );
};
