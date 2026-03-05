/**
 * ChatAnthropicWidget
 *
 * AI chat using Anthropic API key. Thin wrapper around ChatCore.
 */
import { Panel } from "@trops/dash-react";
import { Widget } from "@trops/dash-core";
import { ChatCore } from "./ChatCore";

export const ChatAnthropicWidget = ({
    title = "AI Chat",
    model = "claude-sonnet-4-20250514",
    systemPrompt = "You are a helpful AI assistant integrated into a dashboard application. Be concise and helpful. When using tools, explain what you're doing.",
    maxToolRounds = "10",
    api,
    uuid,
    ...props
}) => (
    <Widget {...props} width="w-full" height="h-full">
        <Panel>
            <ChatCore
                title={title}
                model={model}
                systemPrompt={systemPrompt}
                maxToolRounds={maxToolRounds}
                api={api}
                uuid={uuid}
                backend="anthropic"
            />
        </Panel>
    </Widget>
);
