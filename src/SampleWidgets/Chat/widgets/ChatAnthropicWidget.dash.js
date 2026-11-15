import { ChatAnthropicWidget } from "./ChatAnthropicWidget";

const widgetDefinition = {
    packageName: "chat",
    scope: "trops",
    id: "trops.chat.ChatAnthropicWidget",
    name: "ChatAnthropicWidget",
    displayName: "AI Chat (Anthropic)",
    component: ChatAnthropicWidget,
    canHaveChildren: false,
    workspace: "Chat-workspace",
    package: "Chat",
    author: "Dash Team",
    icon: "chat-bubble-left-right",
    description:
        "AI chat using Anthropic API key. Supports streaming responses and MCP tool-use for GitHub, Slack, and other connected services.",
    type: "widget",
    events: ["messageSent", "toolUsed"],
    eventHandlers: [],
    providers: [
        {
            type: "anthropic",
            providerClass: "credential",
            required: true,
            credentialSchema: {
                apiKey: {
                    type: "text",
                    displayName: "API Key",
                    instructions:
                        "Your Anthropic API key (starts with sk-ant-)",
                    required: true,
                    secret: true,
                },
            },
        },
    ],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "AI Chat",
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
