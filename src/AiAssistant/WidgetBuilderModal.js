/**
 * WidgetBuilderModal
 *
 * Split-pane modal for AI widget building with LIVE PREVIEW.
 * Left: Live widget preview (2/3)
 * Right: ChatCore for conversation (1/3)
 *
 * Flow:
 * 1. User describes widget in chat
 * 2. AI generates code blocks
 * 3. Auto-compiles and shows live preview of the actual widget
 * 4. User can iterate or click "Install" to save to @ai-built/
 */
import React, {
    useState,
    useContext,
    useCallback,
    useEffect,
    useRef,
} from "react";
import { Modal, FontAwesomeIcon, ThemeContext } from "@trops/dash-react";
import {
    ChatCore,
    AppContext,
    evaluateBundle,
    extractWidgetConfigs,
} from "@trops/dash-core";

/**
 * Error boundary for the live widget preview.
 * Catches runtime errors in the rendered widget without crashing the modal.
 */
class PreviewErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error: error.message || "Widget render error" };
    }

    componentDidCatch(err) {
        console.error("[WidgetBuilderModal] Preview render error:", err);
    }

    // Reset when children change (new preview compiled)
    componentDidUpdate(prevProps) {
        if (prevProps.children !== this.props.children && this.state.error) {
            this.setState({ error: null });
        }
    }

    render() {
        if (this.state.error) {
            return (
                <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                        <span>Widget render error</span>
                    </div>
                    <pre className="text-xs text-red-300/70 bg-black/20 rounded p-2 overflow-auto max-h-24">
                        {this.state.error}
                    </pre>
                    <p className="text-xs text-gray-500">
                        Ask the AI to fix the error in the chat.
                    </p>
                </div>
            );
        }
        return this.props.children;
    }
}

const SYSTEM_PROMPT = `You are the Dash Widget Builder. When the user describes a widget, generate the code directly in your response as two code blocks:

1. A \`\`\`jsx code block with the React component
2. A \`\`\`javascript code block with the .dash.js config

RULES:
- Default export: export default function WidgetName(props) { ... }
- Import React hooks from 'react': import React, { useState, useEffect } from 'react';
- Import UI components from '@trops/dash-react': import { Panel, Heading, SubHeading, Button, Menu, MenuItem, FontAwesomeIcon } from '@trops/dash-react';
- NEVER import useState, useEffect, or any React hooks from '@trops/dash-react' — they MUST come from 'react'
- Wrap in <Panel>...</Panel>
- Use Tailwind CSS
- Config MUST include: component (matching function name), name (display name with spaces), type: "widget", canHaveChildren: false, workspace: "ai-built"
- Example config: export default { component: "CounterWidget", name: "Counter Widget", type: "widget", canHaveChildren: false, workspace: "ai-built", userConfig: { title: { type: "text", defaultValue: "Counter", displayName: "Title" } } }

CRITICAL RULES — YOU ARE RUNNING INSIDE AN EMBEDDED UI, NOT AN INTERACTIVE TERMINAL:
- Do NOT use ANY tools — no Skill, Read, Write, Edit, Bash, Glob, Grep, or any other tool
- Do NOT invoke the dash-widget-builder skill or any other skill
- Do NOT read files, scan directories, or run commands
- ONLY output text and code blocks in your response — the app handles file creation and compilation automatically
- Simply output the two code blocks (jsx component + javascript config) and the app will handle the rest
- Respond immediately with the code — do not plan, research, or scaffold first`;

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

    const [previewComponent, setPreviewComponent] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [installStatus, setInstallStatus] = useState(null);
    const [detectedCode, setDetectedCode] = useState({
        componentCode: null,
        configCode: null,
    });
    const lastCompiledCode = useRef(null);

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

    const widgetName = extractWidgetName(detectedCode.componentCode);

    // Poll for code blocks and auto-compile for preview
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            try {
                const raw = localStorage.getItem("dash-widget-builder");
                if (raw) {
                    const data = JSON.parse(raw);
                    const msgs = data?.messages || [];

                    // Detect New Chat (messages cleared)
                    if (msgs.length === 0 && lastCompiledCode.current) {
                        setPreviewComponent(null);
                        setPreviewError(null);
                        setDetectedCode({
                            componentCode: null,
                            configCode: null,
                        });
                        setInstallStatus(null);
                        lastCompiledCode.current = null;
                        return;
                    }

                    const extracted = extractCodeBlocks(msgs);
                    if (
                        extracted.componentCode &&
                        extracted.componentCode !== lastCompiledCode.current
                    ) {
                        setDetectedCode(extracted);
                        compilePreview(extracted);
                    }
                }
            } catch (e) {
                /* ignore */
            }
        }, 2000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const compilePreview = useCallback(async (code) => {
        const name = extractWidgetName(code.componentCode);
        if (!name || !code.componentCode) return;

        setIsCompiling(true);
        setPreviewError(null);
        setPreviewComponent(null);
        setInstallStatus(null);
        lastCompiledCode.current = code.componentCode;

        try {
            const result = await window.mainApi?.widgetBuilder?.compilePreview(
                name,
                code.componentCode,
                code.configCode ||
                    `export default { component: "${name}", name: "${name
                        .replace(/([A-Z])/g, " $1")
                        .trim()}", type: "widget", canHaveChildren: false, workspace: "ai-built" };`
            );

            if (!result?.success) {
                setPreviewError(result?.error || "Compilation failed");
                setPreviewComponent(null);
                setIsCompiling(false);
                return;
            }

            // Evaluate the bundle to get the React component
            const bundleExports = evaluateBundle(
                result.bundleSource,
                `@ai-built/${name.toLowerCase()}`
            );
            const configs = extractWidgetConfigs(bundleExports);
            const match = configs.find((c) => c.key === name);

            if (match && typeof match.config.component === "function") {
                // Sanity check — call the component to catch import errors
                // (e.g., useState not found) BEFORE React tries to render it
                try {
                    match.config.component({ title: "test" });
                } catch (renderErr) {
                    setPreviewError(
                        `Widget code error: ${renderErr.message}\n\nAsk the AI to fix the error. Common issue: importing React hooks from '@trops/dash-react' instead of 'react'.`
                    );
                    setPreviewComponent(null);
                    setIsCompiling(false);
                    return;
                }
                setPreviewComponent(() => match.config.component);
                setPreviewError(null);
            } else {
                setPreviewError(
                    "Could not resolve widget component from bundle."
                );
                setPreviewComponent(null);
            }
        } catch (err) {
            setPreviewError(err.message);
            setPreviewComponent(null);
        } finally {
            setIsCompiling(false);
        }
    }, []);

    const handleInstall = useCallback(async () => {
        if (!detectedCode.componentCode || !widgetName) return;
        setInstallStatus("installing");
        try {
            const result = await window.mainApi?.widgetBuilder?.aiBuild(
                widgetName,
                detectedCode.componentCode,
                detectedCode.configCode ||
                    `export default { component: "${widgetName}", name: "${widgetName
                        .replace(/([A-Z])/g, " $1")
                        .trim()}", type: "widget", canHaveChildren: false, workspace: "ai-built" };`,
                `AI-generated widget: ${widgetName}`
            );
            setInstallStatus(
                result?.success
                    ? { success: true, widgetName: result.widgetName }
                    : { error: result?.error || "Install failed" }
            );
        } catch (err) {
            setInstallStatus({ error: err.message });
        }
    }, [detectedCode, widgetName]);

    if (!isOpen) return null;

    const PreviewComponent = previewComponent;
    const displayName =
        widgetName?.replace(/([A-Z])/g, " $1").trim() || "Widget";

    return (
        <Modal
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            width="w-11/12"
            height="h-5/6"
        >
            {/* Header */}
            <div
                className={`flex items-center justify-between px-4 py-3 border-b ${borderColor} ${bgDark} shrink-0`}
            >
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                        icon="wand-magic-sparkles"
                        className="h-4 w-4 text-indigo-400"
                    />
                    <span className="text-base font-semibold text-gray-100">
                        Build Widget with AI
                    </span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400"
                >
                    <FontAwesomeIcon icon="times" className="h-4 w-4" />
                </button>
            </div>

            {/* Split pane */}
            <div className={`flex flex-row flex-1 min-h-0 ${bgDark}`}>
                {/* Left: Live Preview (2/3) */}
                <div className="flex flex-col flex-[2] min-w-0 overflow-hidden">
                    {/* Preview header bar */}
                    <div
                        className={`flex items-center justify-between px-4 py-2 border-b ${borderColor} shrink-0`}
                    >
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <FontAwesomeIcon icon="eye" className="h-3 w-3" />
                            <span>
                                {previewComponent
                                    ? `Preview: ${displayName}`
                                    : "Preview"}
                            </span>
                        </div>
                        {isCompiling && (
                            <div className="flex items-center gap-1.5 text-xs text-indigo-400">
                                <span className="inline-flex gap-0.5">
                                    <span
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                                        style={{ animationDelay: "0ms" }}
                                    />
                                    <span
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                                        style={{ animationDelay: "150ms" }}
                                    />
                                    <span
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                                        style={{ animationDelay: "300ms" }}
                                    />
                                </span>
                                Compiling...
                            </div>
                        )}
                        {installStatus?.success && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                                <FontAwesomeIcon
                                    icon="check-circle"
                                    className="h-3 w-3"
                                />
                                Installed as {installStatus.widgetName}
                            </span>
                        )}
                    </div>

                    {/* Preview content */}
                    <div className="flex-1 overflow-auto p-4">
                        {/* Empty state */}
                        {!previewComponent && !previewError && !isCompiling && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                <div className="w-16 h-16 rounded-2xl bg-gray-800/80 border border-gray-700/30 flex items-center justify-center">
                                    <FontAwesomeIcon
                                        icon="wand-magic-sparkles"
                                        className="h-7 w-7 text-indigo-400/40"
                                    />
                                </div>
                                <div className="space-y-2 max-w-sm">
                                    <p className="text-sm font-medium text-gray-300">
                                        Describe your widget
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        The AI will generate code and a live
                                        preview will appear here automatically.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Compile error */}
                        {previewError && (
                            <div className="flex flex-col items-center justify-center h-full space-y-4">
                                <div className="w-full max-w-lg rounded-lg border border-red-700/30 bg-red-900/10 p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                        <FontAwesomeIcon
                                            icon="exclamation-circle"
                                            className="h-4 w-4"
                                        />
                                        Compilation Error
                                    </div>
                                    <pre className="text-xs text-red-300/70 bg-black/20 rounded p-2 overflow-auto max-h-32">
                                        {previewError}
                                    </pre>
                                    <p className="text-xs text-gray-500">
                                        Ask the AI to fix the error in the chat.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Live widget preview */}
                        {PreviewComponent && !installStatus && (
                            <div className="flex flex-col h-full">
                                {/* Widget preview — centered */}
                                <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
                                    <div className="w-full max-w-2xl rounded-lg border border-gray-700/30 bg-gray-800/30 overflow-hidden shadow-lg">
                                        <PreviewErrorBoundary
                                            key={lastCompiledCode.current}
                                        >
                                            <React.Suspense
                                                fallback={
                                                    <div className="p-8 text-center text-gray-500 text-sm">
                                                        Loading preview...
                                                    </div>
                                                }
                                            >
                                                <PreviewComponent
                                                    title={displayName}
                                                />
                                            </React.Suspense>
                                        </PreviewErrorBoundary>
                                    </div>
                                </div>
                                {/* Footer — Install button */}
                                <div
                                    className={`flex items-center justify-between px-6 py-3 border-t ${borderColor} shrink-0`}
                                >
                                    <span className="text-xs text-gray-500">
                                        Installs to @ai-built/
                                        {widgetName?.toLowerCase()}
                                    </span>
                                    <button
                                        onClick={handleInstall}
                                        className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                                    >
                                        Install Widget
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Installed success */}
                        {installStatus?.success && (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <div className="w-12 h-12 rounded-xl bg-green-600/20 flex items-center justify-center">
                                    <FontAwesomeIcon
                                        icon="check-circle"
                                        className="h-6 w-6 text-green-400"
                                    />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-base font-semibold text-green-300">
                                        Widget Installed!
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        <span className="font-mono text-gray-300">
                                            {installStatus.widgetName}
                                        </span>{" "}
                                        is now in the widget selector.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                                    >
                                        Done
                                    </button>
                                    <button
                                        onClick={() => {
                                            setInstallStatus(null);
                                            setPreviewComponent(null);
                                            setDetectedCode({
                                                componentCode: null,
                                                configCode: null,
                                            });
                                            lastCompiledCode.current = null;
                                        }}
                                        className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
                                    >
                                        Build Another
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Install error */}
                        {installStatus?.error && (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <div className="text-center space-y-2">
                                    <p className="text-red-400 font-medium">
                                        Installation failed
                                    </p>
                                    <pre className="text-xs text-red-300/70 bg-black/20 rounded p-2 max-w-md overflow-auto">
                                        {installStatus.error}
                                    </pre>
                                </div>
                                <button
                                    onClick={() => setInstallStatus(null)}
                                    className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                    </div>
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
