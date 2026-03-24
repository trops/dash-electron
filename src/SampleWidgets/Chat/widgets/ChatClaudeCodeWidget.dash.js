import { ChatClaudeCodeWidget } from "./ChatClaudeCodeWidget";

const widgetDefinition = {
    packageName: "chat",
    scope: "trops",
    id: "trops.chat.ChatClaudeCodeWidget",
    name: "ChatClaudeCodeWidget",
    displayName: "AI Chat (Claude Code)",
    component: ChatClaudeCodeWidget,
    canHaveChildren: false,
    workspace: "Chat-workspace",
    package: "Chat",
    author: "Dash Team",
    icon: "command-line",
    description:
        "AI chat using Claude Code CLI. Uses your Claude Pro/Max subscription — no API key needed. MCP tools pass through automatically.",
    type: "widget",
    events: ["messageSent", "toolUsed"],
    eventHandlers: [],
    providers: [],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-violet-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "AI Chat (Claude Code)",
            displayName: "Title",
            required: false,
        },
        model: {
            type: "select",
            defaultValue: "claude-sonnet-4-20250514",
            displayName: "Model",
            required: false,
            options: [
                { label: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
                { label: "Claude Opus 4", value: "claude-opus-4-20250514" },
                {
                    label: "Claude Haiku 3.5",
                    value: "claude-haiku-4-5-20251001",
                },
            ],
        },
        systemPrompt: {
            type: "textarea",
            defaultValue:
                "You are a helpful AI assistant integrated into a dashboard application. Be concise and helpful. When using tools, explain what you're doing.",
            displayName: "System Prompt",
            required: false,
        },
        maxToolRounds: {
            type: "select",
            defaultValue: "10",
            displayName: "Max Tool Rounds",
            required: false,
            options: [
                { label: "5", value: "5" },
                { label: "10", value: "10" },
                { label: "20", value: "20" },
            ],
        },
    },
};
export default widgetDefinition;
