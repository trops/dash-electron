/**
 * ChatWidget
 *
 * AI-powered chat assistant using Claude with MCP tool-use support.
 * Streams responses, manages conversation state, and persists via api.storeData().
 *
 * @package Chat
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useWidgetEvents, useWidgetProviders } from "@trops/dash-core";
import { ChatMessages } from "./components/ChatMessages";
import { ChatInput } from "./components/ChatInput";
import { ToolSelector } from "./components/ToolSelector";

/**
 * Generate a unique request ID scoped to this widget instance.
 */
let requestCounter = 0;
function generateRequestId(uuid) {
    return `${uuid || "chat"}-${Date.now()}-${++requestCounter}`;
}

function ChatWidgetContent({
    title,
    model,
    systemPrompt,
    maxToolRounds,
    api,
    uuid,
}) {
    const { publishEvent } = useWidgetEvents();
    const mainApi = window.mainApi;

    // Conversation state
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [streamingText, setStreamingText] = useState("");
    const activeRequestId = useRef(null);

    // MCP tool state
    const [servers, setServers] = useState([]);
    const [enabledTools, setEnabledTools] = useState({});

    // Tool calls for current streaming response
    const toolCallsRef = useRef([]);

    // Resolve provider credentials via hook
    const { getProvider } = useWidgetProviders();
    const anthropicProvider = getProvider("anthropic");
    const apiKey = anthropicProvider?.credentials?.apiKey;

    // Load saved conversation on mount
    useEffect(() => {
        if (!api || !uuid) return;
        api.readData({
            uuid,
            callbackComplete: (data) => {
                if (data?.messages && Array.isArray(data.messages)) {
                    setMessages(data.messages);
                }
                if (data?.enabledTools) {
                    setEnabledTools(data.enabledTools);
                }
            },
            callbackError: () => {},
        });
    }, [api, uuid]);

    // Discover connected MCP tools
    const refreshTools = useCallback(() => {
        if (!mainApi?.llm) return;
        mainApi.llm.listConnectedTools().then((result) => {
            if (Array.isArray(result)) {
                setServers(result);
            }
        });
    }, [mainApi]);

    useEffect(() => {
        refreshTools();
        // Refresh tools periodically
        const interval = setInterval(refreshTools, 30000);
        return () => clearInterval(interval);
    }, [refreshTools]);

    // Save conversation
    const saveConversation = useCallback(
        (msgs, tools) => {
            if (!api || !uuid) return;
            api.storeData({
                data: { messages: msgs, enabledTools: tools || enabledTools },
                uuid,
                append: false,
                callbackComplete: () => {},
                callbackError: () => {},
            });
        },
        [api, uuid, enabledTools],
    );

    // Set up stream listeners
    useEffect(() => {
        if (!mainApi?.llm) return;

        mainApi.llm.onStreamDelta((data) => {
            if (data.requestId !== activeRequestId.current) return;
            setStreamingText((prev) => prev + data.text);
        });

        mainApi.llm.onStreamToolCall((data) => {
            if (data.requestId !== activeRequestId.current) return;
            toolCallsRef.current.push({
                toolUseId: data.toolUseId,
                toolName: data.toolName,
                serverName: data.serverName,
                input: data.input,
                isLoading: true,
            });
            // Force re-render by updating messages with tool call info
            setMessages((prev) => [...prev]);
        });

        mainApi.llm.onStreamToolResult((data) => {
            if (data.requestId !== activeRequestId.current) return;
            const tc = toolCallsRef.current.find(
                (t) => t.toolUseId === data.toolUseId,
            );
            if (tc) {
                tc.result = data.result;
                tc.isError = data.isError;
                tc.isLoading = false;
            }
            // Reset streaming text for next round of API calls
            setStreamingText("");
            if (publishEvent) {
                publishEvent("toolUsed", {
                    toolName: data.toolName,
                    isError: data.isError,
                });
            }
        });

        mainApi.llm.onStreamComplete((data) => {
            if (data.requestId !== activeRequestId.current) return;

            // Build final assistant message
            const assistantMessage = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: data.content,
                toolCalls: [...toolCallsRef.current],
                usage: data.usage,
            };

            setMessages((prev) => {
                const updated = [...prev, assistantMessage];
                saveConversation(updated);
                return updated;
            });
            setStreamingText("");
            setIsLoading(false);
            activeRequestId.current = null;
            toolCallsRef.current = [];
        });

        mainApi.llm.onStreamError((data) => {
            if (data.requestId !== activeRequestId.current) return;

            let errorMessage = data.error;
            if (data.code === "RATE_LIMITED" && data.retryAfter) {
                errorMessage = `Rate limited. Try again in ${data.retryAfter} seconds.`;
            }

            setError(errorMessage);
            setIsLoading(false);
            setStreamingText("");
            activeRequestId.current = null;
            toolCallsRef.current = [];
        });

        return () => {
            mainApi.llm.removeAllStreamListeners();
        };
    }, [mainApi, publishEvent, saveConversation]);

    // Send message
    const handleSend = useCallback(
        (text) => {
            if (!mainApi?.llm || isLoading) return;

            setError(null);

            const userMessage = {
                id: `msg-${Date.now()}`,
                role: "user",
                content: text,
            };

            const updatedMessages = [...messages, userMessage];
            setMessages(updatedMessages);

            if (publishEvent) {
                publishEvent("messageSent", { text });
            }

            // Build API messages (strip UI-only fields)
            const apiMessages = updatedMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            // Build enabled tools list and server map
            const allTools = [];
            const toolServerMap = {};
            for (const server of servers) {
                for (const tool of server.tools || []) {
                    if (enabledTools[tool.name] !== false) {
                        allTools.push(tool);
                        toolServerMap[tool.name] = server.serverName;
                    }
                }
            }

            const requestId = generateRequestId(uuid);
            activeRequestId.current = requestId;
            toolCallsRef.current = [];
            setIsLoading(true);
            setStreamingText("");

            // Add a placeholder assistant message for streaming
            setMessages((prev) => [
                ...prev,
                {
                    id: `msg-streaming`,
                    role: "assistant",
                    content: [],
                    toolCalls: toolCallsRef.current,
                },
            ]);

            mainApi.llm.sendMessage(requestId, {
                apiKey,
                model,
                messages: apiMessages,
                tools: allTools,
                toolServerMap,
                systemPrompt,
                maxToolRounds: parseInt(maxToolRounds, 10) || 10,
            });
        },
        [
            mainApi,
            isLoading,
            messages,
            servers,
            enabledTools,
            apiKey,
            model,
            systemPrompt,
            maxToolRounds,
            uuid,
            publishEvent,
        ],
    );

    // Stop streaming
    const handleStop = useCallback(() => {
        if (activeRequestId.current && mainApi?.llm) {
            mainApi.llm.abortRequest(activeRequestId.current);

            // Preserve partial text as the final message
            if (streamingText) {
                setMessages((prev) => {
                    const updated = prev.map((msg) => {
                        if (msg.id === "msg-streaming") {
                            return {
                                ...msg,
                                id: `msg-${Date.now()}`,
                                content: [
                                    { type: "text", text: streamingText },
                                ],
                                toolCalls: [...toolCallsRef.current],
                            };
                        }
                        return msg;
                    });
                    saveConversation(updated);
                    return updated;
                });
            } else {
                // Remove the empty streaming placeholder
                setMessages((prev) => {
                    const updated = prev.filter(
                        (msg) => msg.id !== "msg-streaming",
                    );
                    saveConversation(updated);
                    return updated;
                });
            }

            setIsLoading(false);
            setStreamingText("");
            activeRequestId.current = null;
            toolCallsRef.current = [];
        }
    }, [mainApi, streamingText, saveConversation]);

    // New chat
    const handleNewChat = () => {
        if (isLoading) handleStop();
        setMessages([]);
        setError(null);
        setStreamingText("");
        saveConversation([]);
    };

    // Toggle tool
    const handleToggleTool = (toolName) => {
        setEnabledTools((prev) => {
            const updated = {
                ...prev,
                [toolName]: prev[toolName] === false ? true : false,
            };
            saveConversation(messages, updated);
            return updated;
        });
    };

    const hasTools = servers.some((s) => s.tools?.length > 0);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
                <SubHeading2 title={title} />
                <button
                    onClick={handleNewChat}
                    className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                    New Chat
                </button>
            </div>

            {/* Error banner */}
            {error && (
                <div className="mx-3 mt-2 p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-2 text-red-400 hover:text-red-300"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* API key warning */}
            {!apiKey && (
                <div className="mx-3 mt-2 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs">
                    Add an Anthropic provider with your API key in the dashboard
                    settings to start chatting.
                </div>
            )}

            {/* No tools info */}
            {!hasTools && apiKey && messages.length === 0 && (
                <div className="mx-3 mt-2 p-2 bg-gray-800/50 border border-gray-700 rounded text-gray-400 text-xs">
                    No MCP tools connected. Connect providers (GitHub, Slack,
                    etc.) to enable tool-use.
                </div>
            )}

            {/* Tool selector */}
            {hasTools && (
                <div className="px-1 pt-1">
                    <ToolSelector
                        servers={servers}
                        enabledTools={enabledTools}
                        onToggle={handleToggleTool}
                    />
                </div>
            )}

            {/* Messages */}
            <ChatMessages
                messages={messages}
                streamingRequestId={isLoading ? activeRequestId.current : null}
                streamingText={streamingText}
            />

            {/* Input */}
            <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                isLoading={isLoading}
                disabled={!apiKey}
            />
        </div>
    );
}

export const ChatWidget = ({
    title = "AI Chat",
    model = "claude-sonnet-4-20250514",
    systemPrompt = "You are a helpful AI assistant integrated into a dashboard application. Be concise and helpful. When using tools, explain what you're doing.",
    maxToolRounds = "10",
    api,
    uuid,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <ChatWidgetContent
                    title={title}
                    model={model}
                    systemPrompt={systemPrompt}
                    maxToolRounds={maxToolRounds}
                    api={api}
                    uuid={uuid}
                />
            </Panel>
        </Widget>
    );
};
