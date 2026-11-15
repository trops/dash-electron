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
        // An AI model from the one list (Settings › AI): Latest of a
        // family follows its newest; or one exact version.
        model: {
            type: "model",
            defaultValue: "latest:sonnet",
            displayName: "Model",
            required: false,
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
