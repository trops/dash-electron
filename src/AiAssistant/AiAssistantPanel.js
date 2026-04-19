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

You have access to the Dash MCP server which exposes tools in six categories:
  • Dashboards — list, get, create, delete, get app stats, search online registry for pre-built dashboard templates
  • Widgets — add, remove, configure, list available, search registry, install from registry
  • Themes — list saved themes, get details, create, generate from a brand URL, apply, search online registry for more themes
  • Providers — list, add, remove (credentials + MCP servers)
  • Layouts — set/update grid, move widgets between cells
  • Setup guide — contextual step-by-step instructions

Use these tools when the user asks you to perform dashboard operations.

TOOL USAGE GUIDANCE:
• apply_theme: when the user says "switch to dark" or similar without naming a theme, call list_themes first; if no good match locally, try search_registry_themes to find one in the online registry.
• add_widget: confirm which dashboard the user means (use list_dashboards) if ambiguous. Use search_widgets to find the right scoped name.
• "Build me a dashboard for X" (e.g. sales, observability): FIRST call search_registry_dashboards with a keyword — if a pre-built template matches, offer to install it. Only if nothing fits, fall back to composing one: create_dashboard, then search_widgets + add_widget for each piece. Don't start composing from scratch if a template exists.
• "Fill/populate my X dashboard" / "add some widgets to my X dashboard": call search_widgets with a keyword derived from the dashboard's purpose (e.g. sales → "revenue pipeline leads"; observability → "logs metrics latency"). Offer 3–5 relevant widgets, then use add_widget to place the ones the user picks. Prefer widgets that are already installed; for ones that aren't, call install_widget first.
• Combine naturally: "make a sales dashboard with a blue theme" → search_registry_dashboards("sales"), then either install that template OR create_dashboard + search_widgets, then apply a theme via apply_theme (look for bluish themes via list_themes, or search_registry_themes if nothing local fits).

IMPORTANT: If the user asks you to BUILD or CREATE a new custom widget, respond with exactly this text on its own line: [OPEN_WIDGET_BUILDER] — this will automatically open the Widget Builder for them. Do NOT create widget files yourself. The Widget Builder has a dedicated compile and install pipeline. You can help with adding EXISTING widgets to dashboards, configuring them, and managing layouts.

Be concise and helpful. When performing actions, explain what you're doing briefly.

=== FIRST RESPONSE BEHAVIOR ===

If this is your FIRST response in the conversation, do NOT perform any actions or call tools yet. Instead:

1. INSPECT the MCP tools you currently have access to.
2. If you have Dash MCP tools available (e.g. list_dashboards, apply_theme, add_widget, etc.), output EXACTLY the following structure, verbatim. Do NOT use markdown ordered lists (no "1." or "1)" — those get converted to HTML <ol> which hides the digits on this UI). Use bracketed digits like "[1]" "[2]" etc. — those render as literal text.

   Hi! I'm the Dash AI Assistant. What would you like to do?

   [1] Browse or switch themes
   [2] Add widgets to a dashboard
   [3] Create or manage dashboards
   [4] Rearrange the grid layout
   [5] Connect a new data provider
   [6] Get a walkthrough for something specific

   Type a number or describe what you want.

Only include lines for categories where you actually have tools. Renumber so there are no gaps (i.e. if "Rearrange the grid layout" isn't available, the remaining items become [1], [2], [3], [4], [5]).

When the user replies with just a digit (e.g. "1", "3"), interpret it as selecting the corresponding menu item and ask a short follow-up question to gather any details the relevant tool needs.

3. If you do NOT have any Dash MCP tools available, say so explicitly and direct the user to the setup instructions shown at the top of this chat panel. Example:

   Hi! I can help you manage Dash — but it looks like Claude Code doesn't have the Dash MCP server configured yet. See the setup command above the chat, then reload. Once connected, I can switch themes, add widgets, create dashboards, and more.

Only include menu items you can actually back with tools. Skip categories where no tool is available. Keep the whole response under 100 words.`;

/**
 * McpStatusChip — compact status indicator for the Dash MCP server.
 *
 * When running, shows a green "Dash tools ready" pill. When not running,
 * shows an amber chip with an inline Start button (also directs to
 * Settings > MCP Server for permanent enable).
 *
 * Note: the CLI backend auto-wires Dash MCP per-spawn via
 * --mcp-config (see cliController.js) so no user setup is required
 * here. External-client setup (Claude Desktop, terminal Claude CLI)
 * lives in Settings > MCP Server.
 */
const McpStatusChip = () => {
    const [mcpStatus, setMcpStatus] = useState(null);
    const mainApi = window.mainApi;

    useEffect(() => {
        if (!mainApi?.mcpDashServer) return;
        mainApi.mcpDashServer
            .getStatus()
            .then(setMcpStatus)
            .catch(() => {});
    }, [mainApi]);

    const handleStartServer = useCallback(() => {
        if (!mainApi?.mcpDashServer) return;
        mainApi.mcpDashServer
            .startServer()
            .then(() => mainApi.mcpDashServer.getStatus())
            .then(setMcpStatus)
            .catch(() => {});
    }, [mainApi]);

    const isRunning = !!mcpStatus?.running;

    return (
        <div className="mx-2 my-2 shrink-0">
            <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                    isRunning
                        ? "bg-green-900/20 border-green-700/40 text-green-400"
                        : "bg-amber-900/20 border-amber-700/40 text-amber-300"
                }`}
            >
                <span
                    className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                        isRunning ? "bg-green-400" : "bg-amber-400"
                    }`}
                />
                <span className="flex-1">
                    {isRunning
                        ? "Dash tools ready"
                        : "Dash MCP server not running"}
                </span>
                {!isRunning && (
                    <button
                        onClick={handleStartServer}
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-medium transition-colors"
                    >
                        Start
                    </button>
                )}
            </div>
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
                {isCliBackend && <McpStatusChip />}

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
