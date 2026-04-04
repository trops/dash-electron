/**
 * WidgetBuilderModal
 *
 * Split-pane modal for AI widget building.
 * Left: Preview/status area (2/3)
 * Right: ChatCore for conversation (1/3)
 *
 * The AI generates code as text. The UI extracts code blocks
 * and provides a "Compile & Install" button that calls widget:ai-build
 * IPC. The LLM NEVER touches the filesystem.
 */
import React, { useState, useContext, useCallback, useEffect } from "react";
import {
    Modal,
    Button,
    SubHeading,
    SubHeading3,
    FontAwesomeIcon,
    ThemeContext,
} from "@trops/dash-react";
import { ChatCore, AppContext } from "@trops/dash-core";

const SYSTEM_PROMPT = `You are the Dash Widget Builder. When the user describes a widget, generate the code directly in your response as two code blocks:

1. A \`\`\`jsx code block with the React component
2. A \`\`\`javascript code block with the .dash.js config

RULES:
- Default export: export default function WidgetName(props) { ... }
- Import from @trops/dash-react: Panel, Heading, SubHeading, Button, Menu, MenuItem, FontAwesomeIcon (NO "Widget" export)
- Wrap in <Panel>...</Panel>
- Use Tailwind CSS
- Config MUST include: component (matching function name), name (display name with spaces), type: "widget", canHaveChildren: false, workspace: "ai-built"
- Example config: export default { component: "CounterWidget", name: "Counter Widget", type: "widget", canHaveChildren: false, workspace: "ai-built", userConfig: { title: { type: "text", defaultValue: "Counter", displayName: "Title" } } }

Do NOT create files or run commands. Just output the code blocks. The user will click "Compile & Install" in the UI.`;

function extractCodeBlocks(messages) {
    let componentCode = null;
    let configCode = null;

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "assistant") continue;

        const text =
            typeof msg.content === "string"
                ? msg.content
                : Array.isArray(msg.content)
                ? msg.content
                      .filter((c) => c.type === "text")
                      .map((c) => c.text)
                      .join("\n")
                : "";
        if (!text) continue;

        const blocks = [];
        const regex = /```(?:jsx|javascript|js)?\s*\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            blocks.push(match[1].trim());
        }

        if (blocks.length >= 2 && !componentCode) {
            componentCode = blocks[0];
            configCode = blocks[1];
            break;
        }
    }
    return { componentCode, configCode };
}

function extractWidgetName(code) {
    const match = code?.match(/export\s+default\s+function\s+(\w+)/);
    return match ? match[1] : null;
}

export const WidgetBuilderModal = ({ isOpen, setIsOpen }) => {
    const { currentTheme } = useContext(ThemeContext);
    const appContext = useContext(AppContext);
    const [buildStatus, setBuildStatus] = useState(null);
    const [detectedCode, setDetectedCode] = useState({
        componentCode: null,
        configCode: null,
    });

    const settings = appContext?.settings || {};
    const providers = appContext?.providers || {};
    const aiSettings = settings.aiAssistant || {};
    const preferredBackend = aiSettings.preferredBackend || "claude-code";
    const model = aiSettings.model || "claude-sonnet-4-20250514";

    const anthropicEntry = Object.entries(providers).find(
        ([, p]) =>
            p.type === "anthropic" &&
            (p.providerClass || "credential") === "credential"
    );
    const apiKey = anthropicEntry?.[1]?.credentials?.apiKey || null;
    const bgDark = currentTheme?.["bg-primary-dark"] || "bg-gray-900";
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700";

    // Poll localStorage for code blocks from chat
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            try {
                const raw = localStorage.getItem("dash-widget-builder");
                if (raw) {
                    const data = JSON.parse(raw);
                    if (data?.messages) {
                        const extracted = extractCodeBlocks(data.messages);
                        if (extracted.componentCode) setDetectedCode(extracted);
                    }
                }
            } catch (e) {
                /* ignore */
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const widgetName = extractWidgetName(detectedCode.componentCode);

    const handleCompileAndInstall = useCallback(async () => {
        if (!detectedCode.componentCode || !widgetName) return;
        setBuildStatus("building");
        try {
            const result = await window.mainApi?.widgetBuilder?.aiBuild(
                widgetName,
                detectedCode.componentCode,
                detectedCode.configCode ||
                    `export default { component: "${widgetName}", type: "widget", canHaveChildren: false, workspace: "ai-built" };`,
                `AI-generated widget: ${widgetName}`
            );
            setBuildStatus(
                result?.success
                    ? { success: true, widgetName: result.widgetName }
                    : { error: result?.error || "Build failed" }
            );
        } catch (err) {
            setBuildStatus({ error: err.message });
        }
    }, [detectedCode, widgetName]);

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            width="w-11/12"
            height="h-5/6"
        >
            <div
                className={`flex items-center justify-between px-4 py-3 border-b ${borderColor} ${bgDark} shrink-0`}
            >
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                        icon="wand-magic-sparkles"
                        className="h-4 w-4 text-indigo-400"
                    />
                    <SubHeading title="Build Widget with AI" padding={false} />
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400"
                >
                    <FontAwesomeIcon icon="times" className="h-4 w-4" />
                </button>
            </div>

            <div className={`flex flex-row flex-1 min-h-0 ${bgDark}`}>
                {/* Left: Status (2/3) */}
                <div className="flex flex-col flex-[2] min-w-0 p-6 overflow-y-auto">
                    <SubHeading3 title="Widget Builder" padding={false} />

                    {!detectedCode.componentCode && !buildStatus && (
                        <div className="flex flex-col items-center justify-center flex-1 text-gray-500 text-sm text-center space-y-3">
                            <FontAwesomeIcon
                                icon="cube"
                                className="h-10 w-10 text-gray-600"
                            />
                            <p>
                                Describe the widget you want in the chat on the
                                right.
                            </p>
                            <p className="text-xs text-gray-600">
                                The AI will generate code. Then click "Compile &
                                Install" to build it to @ai-built/ scope.
                            </p>
                        </div>
                    )}

                    {detectedCode.componentCode && !buildStatus && (
                        <div className="space-y-4 mt-4">
                            <div className="flex items-center gap-2 text-indigo-400 text-sm">
                                <FontAwesomeIcon
                                    icon="code"
                                    className="h-4 w-4"
                                />
                                <span>
                                    Widget detected:{" "}
                                    <span className="font-mono font-semibold">
                                        {widgetName}
                                    </span>
                                </span>
                            </div>
                            <pre className="text-xs bg-black/30 rounded p-3 overflow-auto max-h-48 text-gray-300">
                                {detectedCode.componentCode}
                            </pre>
                            {detectedCode.configCode && (
                                <pre className="text-xs bg-black/30 rounded p-3 overflow-auto max-h-24 text-gray-300">
                                    {detectedCode.configCode}
                                </pre>
                            )}
                            <Button
                                title="Compile & Install"
                                onClick={handleCompileAndInstall}
                            />
                            <p className="text-xs text-gray-500">
                                Installs to @ai-built/
                                {widgetName?.toLowerCase()}
                            </p>
                        </div>
                    )}

                    {buildStatus === "building" && (
                        <div className="flex items-center gap-2 text-indigo-400 text-sm mt-4">
                            <span className="inline-flex gap-1">
                                <span
                                    className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                                    style={{ animationDelay: "0ms" }}
                                />
                                <span
                                    className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                                    style={{ animationDelay: "150ms" }}
                                />
                                <span
                                    className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                                    style={{ animationDelay: "300ms" }}
                                />
                            </span>
                            Compiling...
                        </div>
                    )}

                    {buildStatus?.success && (
                        <div className="space-y-4 mt-4">
                            <div className="flex items-center gap-2 text-green-400">
                                <FontAwesomeIcon
                                    icon="check-circle"
                                    className="h-5 w-5"
                                />
                                <span>Widget installed!</span>
                            </div>
                            <p className="text-sm text-gray-400">
                                <span className="font-mono text-gray-200">
                                    {buildStatus.widgetName}
                                </span>{" "}
                                is now in the widget selector.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    title="Done"
                                    onClick={() => setIsOpen(false)}
                                />
                                <Button
                                    title="Build Another"
                                    onClick={() => {
                                        setBuildStatus(null);
                                        setDetectedCode({
                                            componentCode: null,
                                            configCode: null,
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {buildStatus?.error && (
                        <div className="space-y-3 mt-4">
                            <div className="flex items-center gap-2 text-red-400">
                                <FontAwesomeIcon
                                    icon="exclamation-circle"
                                    className="h-5 w-5"
                                />
                                <span>Build failed</span>
                            </div>
                            <pre className="text-xs text-red-300/80 bg-red-950/30 rounded p-3 overflow-auto max-h-32">
                                {buildStatus.error}
                            </pre>
                            <Button
                                title="Try Again"
                                onClick={() => setBuildStatus(null)}
                            />
                        </div>
                    )}
                </div>

                {/* Right: Chat (1/3) */}
                <div
                    className={`flex flex-col flex-1 min-w-0 border-l ${borderColor}`}
                >
                    <ChatCore
                        title=""
                        model={model}
                        systemPrompt={SYSTEM_PROMPT}
                        maxToolRounds="10"
                        apiKey={apiKey}
                        backend={preferredBackend}
                        persistKey="dash-widget-builder"
                        hideToolsBanner={true}
                    />
                </div>
            </div>
        </Modal>
    );
};
