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
import {
    Modal,
    FontAwesomeIcon,
    ThemeContext,
    CodeEditorVS,
} from "@trops/dash-react";
import {
    ChatCore,
    AppContext,
    WidgetContext,
    evaluateBundle,
    extractWidgetConfigs,
} from "@trops/dash-core";
import { WidgetConfigureTab } from "./WidgetConfigureTab";

/**
 * Wraps the preview widget in the full context stack (AppContext,
 * ThemeContext, WidgetContext) so hooks like useMcpProvider work.
 * Auto-selects the first matching provider for each type declared
 * in the widget config.
 */
function PreviewContextWrapper({ appCtx, themeCtx, editContext, children }) {
    const widgetData = React.useMemo(() => {
        // Extract provider declarations from the config code
        const configCode = editContext?.configCode || "";
        const providers = [];
        const providerMatch = configCode.match(
            /providers\s*:\s*\[([\s\S]*?)\]/
        );
        if (providerMatch) {
            const typeMatches = providerMatch[1].matchAll(
                /type\s*:\s*["']([^"']+)["']/g
            );
            const classMatches = providerMatch[1].matchAll(
                /providerClass\s*:\s*["']([^"']+)["']/g
            );
            const classes = [...classMatches].map((m) => m[1]);
            let i = 0;
            for (const m of typeMatches) {
                providers.push({
                    type: m[1],
                    providerClass: classes[i] || "mcp",
                });
                i++;
            }
        }

        // Use the widget's actual selectedProviders from the dashboard.
        // Fall back to auto-selection only for new (non-remix) widgets.
        const selectedProviders = editContext?.selectedProviders || {};
        if (Object.keys(selectedProviders).length === 0 && appCtx?.providers) {
            for (const decl of providers) {
                const match =
                    Object.values(appCtx.providers).find(
                        (p) =>
                            p.type === decl.type &&
                            (p.providerClass || "credential") ===
                                decl.providerClass
                    ) ||
                    Object.values(appCtx.providers).find(
                        (p) => p.type === decl.type
                    );
                if (match) {
                    selectedProviders[decl.type] = match.name;
                }
            }
        }

        return {
            providers,
            selectedProviders,
            uuidString: "preview-widget",
        };
    }, [
        appCtx?.providers,
        editContext?.configCode,
        editContext?.selectedProviders,
    ]);

    return (
        <AppContext.Provider value={appCtx}>
            <ThemeContext.Provider value={themeCtx}>
                <WidgetContext.Provider value={{ widgetData }}>
                    {children}
                </WidgetContext.Provider>
            </ThemeContext.Provider>
        </AppContext.Provider>
    );
}

/**
 * Error boundary for the live widget preview.
 * Catches runtime errors in the rendered widget without crashing the modal.
 * Shows the error with a "Send error to AI" action to auto-fix.
 */
class PreviewErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error: error.message || "Widget render error" };
    }

    componentDidCatch(err, info) {
        console.error(
            "[WidgetBuilderModal] Preview render error:",
            err,
            info?.componentStack
        );
    }

    // Reset when key changes (new preview compiled via key prop)
    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    sendErrorToAI = () => {
        const error = this.state.error;
        if (!error) return;
        try {
            const raw = localStorage.getItem("dash-widget-builder");
            if (raw) {
                const data = JSON.parse(raw);
                const msgs = data?.messages || [];
                msgs.push({
                    role: "user",
                    content: `The widget crashed with this runtime error:\n\n${error}\n\nPlease fix the code and output both the corrected jsx component code block and the javascript config code block.`,
                });
                localStorage.setItem(
                    "dash-widget-builder",
                    JSON.stringify({ ...data, messages: msgs })
                );
            }
        } catch {
            /* ignore */
        }
    };

    render() {
        if (this.state.error) {
            return (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <div className="w-full max-w-lg rounded-lg border border-red-700/30 bg-red-900/10 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                            <span>Runtime Error</span>
                        </div>
                        <pre className="text-xs text-red-300/70 bg-black/20 rounded p-2 overflow-auto max-h-32">
                            {this.state.error}
                        </pre>
                        <button
                            onClick={this.sendErrorToAI}
                            className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                        >
                            Send error to AI
                        </button>
                    </div>
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
- NEVER import useState, useEffect, or any React hooks from '@trops/dash-react' — they MUST come from 'react'
- Wrap in <Panel>...</Panel>
- Use Tailwind CSS for spacing, layout, and custom styling
- Config MUST include: component (matching function name), name (display name with spaces), type: "widget", canHaveChildren: false, workspace: "ai-built"
- Example config: export default { component: "CounterWidget", name: "Counter Widget", type: "widget", canHaveChildren: false, workspace: "ai-built", userConfig: { title: { type: "text", defaultValue: "Counter", displayName: "Title" } } }

THEME-AWARE COMPONENTS — MANDATORY:
All widgets MUST use @trops/dash-react components instead of raw HTML elements. These components inherit the dashboard theme automatically. Raw HTML elements will look inconsistent with the rest of the application.

Import from '@trops/dash-react':
- Layout: Panel (widget wrapper — REQUIRED), Card, DashPanel
- Text: Heading, SubHeading, Paragraph (and Heading2/3, SubHeading2/3, Paragraph2/3 variants)
- Buttons: Button, ButtonIcon
- Forms: InputText, TextArea, SelectInput, Toggle, Checkbox, SearchInput
- Menus: Menu, MenuItem
- Feedback: Alert, Tag, ProgressBar, EmptyState, Skeleton
- Data: Table, Tabs, Accordion, DataList, StatCard
- Icons: FontAwesomeIcon

DO NOT use these raw HTML elements — use the dash-react equivalent:
- <h1>/<h2>/<h3> → use Heading, Heading2, Heading3
- <p> → use Paragraph
- <button> → use Button
- <input> → use InputText
- <textarea> → use TextArea
- <select> → use SelectInput
- <table> → use Table
- Never use raw <div> with manual dark/light styling — dash-react components handle themes

CRITICAL RULES — YOU ARE RUNNING INSIDE AN EMBEDDED UI, NOT AN INTERACTIVE TERMINAL:
- Do NOT use ANY tools — no Skill, Read, Write, Edit, Bash, Glob, Grep, or any other tool
- Do NOT invoke the dash-widget-builder skill or any other skill
- Do NOT read files, scan directories, or run commands
- ONLY output text and code blocks in your response — the app handles file creation and compilation automatically
- ALWAYS output BOTH complete code blocks (jsx component + javascript config) in every response, even for small changes — never output partial diffs or snippets
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
        const regex =
            /```(?:jsx|javascript|js|react|tsx|typescript)?\s*\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            blocks.push(match[1].trim());
        }

        if (blocks.length >= 2 && !componentCode) {
            // Full response with both component + config
            componentCode = blocks[0];
            configCode = blocks[1];
            break;
        } else if (blocks.length === 1) {
            // Single block — likely a fix. Detect if it's component or config.
            const block = blocks[0];
            if (
                !componentCode &&
                (block.includes("export default function") ||
                    block.includes("import React"))
            ) {
                componentCode = block;
            } else if (
                !configCode &&
                (block.includes("workspace:") ||
                    block.includes("canHaveChildren"))
            ) {
                configCode = block;
            }
        }

        if (componentCode && configCode) break;
    }
    return { componentCode, configCode };
}

function extractWidgetName(code) {
    if (!code) return null;
    // Match common React component export patterns:
    //   export default function WidgetName
    //   export const WidgetName = (
    //   export function WidgetName(
    //   function WidgetName ... export default WidgetName
    const patterns = [
        /export\s+default\s+function\s+(\w+)/,
        /export\s+(?:const|let|var)\s+(\w+)\s*=/,
        /export\s+function\s+(\w+)/,
        /export\s+default\s+(\w+)\s*;/,
    ];
    for (const re of patterns) {
        const match = code.match(re);
        if (match) return match[1];
    }
    return null;
}

// Mirrors validateWidget.cjs::VALID_CATEGORIES — kept in sync manually
// (small enum, rarely changes). Used to populate the install-footer picker.
const VALID_CATEGORIES = [
    "general",
    "utilities",
    "productivity",
    "development",
    "social",
    "media",
    "finance",
    "health",
    "education",
    "entertainment",
];

/**
 * Inject (or replace) a `category: "..."` field on an `export default { ... }`
 * config literal. The aiBuild IPC handler writes configCode verbatim to disk
 * with no parsing, so any string transform here lands directly in the saved
 * .dash.js file.
 */
function injectCategoryIntoConfigCode(configCode, category) {
    if (!configCode || !category) return configCode;
    // Replace existing category field if present
    if (/category:\s*["'][^"']*["']/.test(configCode)) {
        return configCode.replace(
            /category:\s*["'][^"']*["']/,
            `category: "${category}"`
        );
    }
    // Otherwise insert before the closing brace of `export default { ... }`
    return configCode.replace(
        /(export\s+default\s*\{[\s\S]*?)(\s*\}\s*;?\s*)$/,
        `$1, category: "${category}"$2`
    );
}

/** Try to extract an existing category from a configCode string. */
function extractCategoryFromConfigCode(configCode) {
    if (!configCode) return null;
    const match = configCode.match(/category:\s*["']([^"']+)["']/);
    return match ? match[1] : null;
}

export const WidgetBuilderModal = ({
    isOpen,
    setIsOpen,
    onInstalled,
    cellContext,
    editContext,
}) => {
    // The modal renders outside DashboardStage's context tree, so
    // ThemeContext and AppContext are empty here. We bridge them via
    // window broadcasts from inside the tree:
    //   - previewThemeCtx → dashboard theme for the widget PREVIEW
    //   - previewAppCtx   → providers/settings for MCP provider access
    //   - currentTheme    → null (modal chrome uses fixed dark colors)
    const localThemeCtx = useContext(ThemeContext);
    const [previewTheme, setPreviewTheme] = useState(
        () => window.__dashThemeContext || null
    );
    const [previewApp, setPreviewApp] = useState(
        () => window.__dashAppContext || null
    );
    useEffect(() => {
        const themeHandler = () =>
            setPreviewTheme({ ...window.__dashThemeContext });
        const appHandler = () => setPreviewApp({ ...window.__dashAppContext });
        window.addEventListener("dash:theme-changed", themeHandler);
        window.addEventListener("dash:app-context-changed", appHandler);
        return () => {
            window.removeEventListener("dash:theme-changed", themeHandler);
            window.removeEventListener("dash:app-context-changed", appHandler);
        };
    }, []);
    const previewThemeCtx = previewTheme || localThemeCtx;
    const previewAppCtx = previewApp || null;
    const currentTheme = localThemeCtx?.currentTheme;
    if (false && previewAppCtx) {
        console.log("[WidgetBuilder] AppContext bridge:", {
            hasProviders: !!previewAppCtx.providers,
            providerCount: previewAppCtx.providers
                ? Object.keys(previewAppCtx.providers).length
                : 0,
            hasCredentials: !!previewAppCtx.credentials,
            appId: previewAppCtx.credentials?.appId,
            hasDashApi: !!previewAppCtx.dashApi,
        });
    }
    const appContext = useContext(AppContext);

    const [previewComponent, setPreviewComponent] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [installStatus, setInstallStatus] = useState(null);
    const [detectedCode, setDetectedCode] = useState({
        componentCode: null,
        configCode: null,
    });
    // Required category for the install — user must pick before Install enables.
    // Pre-filled in remix mode if the original config already declares one.
    const [selectedCategory, setSelectedCategory] = useState(null);
    // Editable widget name for remixes — defaults to <Original>Remix
    const [remixName, setRemixName] = useState("");
    // "update" = overwrite original in-place, "remix" = create new copy
    const [editMode, setEditMode] = useState("remix");
    // Registry auth — used to determine ownership for update vs remix
    const [registryUsername, setRegistryUsername] = useState(null);
    const [registryChecked, setRegistryChecked] = useState(false);
    const lastCompiledCode = useRef(null);
    const [activeTab, setActiveTab] = useState("preview");
    const [activeFile, setActiveFile] = useState("component");
    const manualEditRef = useRef(false);
    const lastMsgCount = useRef(0);
    const isRemixMode = !!editContext?.originalWidgetId;

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

    // Check registry auth to determine widget ownership
    useEffect(() => {
        (async () => {
            try {
                const status = await window.mainApi?.registryAuth?.getStatus();
                if (status?.authenticated) {
                    const profile =
                        await window.mainApi?.registryAuth?.getProfile();
                    setRegistryUsername(profile?.username || null);
                }
            } catch {
                /* ignore */
            }
            setRegistryChecked(true);
        })();
    }, []);

    // Derive ownership: @ai-built = always owner, else scope must match username
    const widgetScope = editContext?.originalPackage?.match(/^@([^/]+)\//)?.[1];
    const isOwner =
        widgetScope === "ai-built" ||
        (registryUsername && widgetScope === registryUsername);

    // End session + clear chat on unmount (modal close) so the next
    // open starts fresh. The open-side clear happens in Dash.js before
    // this component mounts (avoids race with ChatCore loading stale data).
    useEffect(() => {
        return () => {
            try {
                localStorage.setItem(
                    "dash-widget-builder",
                    JSON.stringify({ messages: [] })
                );
            } catch (_) {
                /* ignore */
            }
            if (window.mainApi?.llm?.endCliSession) {
                window.mainApi.llm.endCliSession("dash-widget-builder");
            }
        };
    }, []);

    // Isolate widget-preview runtime errors so buggy user code (event
    // handlers, async effects) can't crash the rest of the app. React's
    // PreviewErrorBoundary catches RENDER errors only; event-handler and
    // async errors bypass it. We catch them here and surface via
    // previewError so the user sees the error inside the preview pane.
    useEffect(() => {
        if (!isOpen) return;

        // Match errors that originated in the evaluated widget bundle.
        // V8 stacks show "eval at evaluateBundle (...), <anonymous>:L:C"
        // for errors inside the sandboxed bundle. We also treat errors
        // whose filename is empty/"<anonymous>" as bundle-origin, since
        // `new Function()` eval produces no filename.
        const fromWidgetBundle = (err, event) => {
            const stack = err?.stack || "";
            if (stack.includes("evaluateBundle")) return true;
            if (stack.includes("<anonymous>")) return true;
            const filename = event?.filename;
            if (!filename || filename === "<anonymous>") return true;
            return false;
        };

        const errorHandler = (event) => {
            if (!fromWidgetBundle(event.error, event)) return;
            console.warn(
                "[WidgetBuilderModal] caught widget bundle error:",
                event.error?.message || event.message
            );
            event.preventDefault();
            event.stopImmediatePropagation();
            setPreviewError(
                event.error?.message || event.message || "Widget runtime error"
            );
            setPreviewComponent(null);
        };

        const rejectionHandler = (event) => {
            if (!fromWidgetBundle(event.reason, event)) return;
            console.warn(
                "[WidgetBuilderModal] caught widget bundle rejection:",
                event.reason?.message || String(event.reason)
            );
            event.preventDefault();
            event.stopImmediatePropagation();
            setPreviewError(
                event.reason?.message ||
                    String(event.reason || "Widget async error")
            );
            setPreviewComponent(null);
        };

        // Capture phase so we run BEFORE index.html's bubble-phase
        // logger and can stopImmediatePropagation to silence its
        // "Global error:" noise for widget-originated errors.
        window.addEventListener("error", errorHandler, true);
        window.addEventListener("unhandledrejection", rejectionHandler, true);
        return () => {
            window.removeEventListener("error", errorHandler, true);
            window.removeEventListener(
                "unhandledrejection",
                rejectionHandler,
                true
            );
        };
    }, [isOpen]);

    // Poll for code blocks and auto-compile for preview
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            try {
                const raw = localStorage.getItem("dash-widget-builder");
                if (raw) {
                    const data = JSON.parse(raw);
                    const msgs = data?.messages || [];

                    // Detect New Chat (messages cleared) — but not in remix mode
                    // where we intentionally start with empty messages
                    if (
                        msgs.length === 0 &&
                        lastCompiledCode.current &&
                        !editContext?.componentCode
                    ) {
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

                    // Reset manualEdit when user sends a new message
                    if (msgs.length !== lastMsgCount.current) {
                        lastMsgCount.current = msgs.length;
                        if (manualEditRef.current)
                            manualEditRef.current = false;
                    }

                    // Skip polling if user is manually editing code
                    if (manualEditRef.current) return;

                    const extracted = extractCodeBlocks(msgs);
                    if (extracted.componentCode) {
                        if (
                            extracted.componentCode !== lastCompiledCode.current
                        ) {
                            console.log(
                                "[WidgetBuilder] New code detected, compiling preview..."
                            );
                            setDetectedCode(extracted);
                            compilePreview(extracted);
                        }
                    } else if (msgs.length > 0 && false) {
                        // Debug: check if assistant responded but no code blocks found
                        const lastAssistant = [...msgs]
                            .reverse()
                            .find((m) => m.role === "assistant");
                        if (lastAssistant) {
                            const text =
                                typeof lastAssistant.content === "string"
                                    ? lastAssistant.content
                                    : Array.isArray(lastAssistant.content)
                                    ? lastAssistant.content
                                          .filter((c) => c.type === "text")
                                          .map((c) => c.text)
                                          .join("\n")
                                    : "";
                            if (text.includes("```")) {
                                console.warn(
                                    "[WidgetBuilder] Code fences found but extractCodeBlocks returned null. Check fence language tags."
                                );
                            }
                        }
                    }
                }
            } catch (e) {
                /* ignore */
            }
        }, 2000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Pre-load source code for remix/edit mode
    useEffect(() => {
        if (editContext?.componentCode && isOpen) {
            const code = {
                componentCode: editContext.componentCode,
                configCode: editContext.configCode || "",
            };
            setDetectedCode(code);
            lastCompiledCode.current = code.componentCode;
            // Try to compile a preview — if it fails (e.g. multi-file
            // widget with unresolvable imports), fall back to Code tab.
            setActiveTab("preview");
            compilePreview(code).catch(() => {});

            // Pre-fill the category picker from the original config so the user
            // can install the remix without re-picking. Falls through to null
            // (forcing a pick) if the original widget had no category declared.
            const existing = extractCategoryFromConfigCode(
                editContext.configCode
            );
            if (existing && VALID_CATEGORIES.includes(existing)) {
                setSelectedCategory(existing);
            }

            // Default remix name: use the bare component name (strip scope
            // prefix like "trops.algolia."), strip trailing "Remix" to
            // avoid stacking, then re-append.
            const origName = editContext.originalComponentName || "";
            const bareName = origName.includes(".")
                ? origName.split(".").pop()
                : origName;
            const base = bareName.replace(/Remix\d*$/, "");
            setRemixName(base ? base + "Remix" : "");

            // Default mode based on ownership — set once registry check completes.
            // @ai-built is always "update"; for others, wait for ownership check.

            // Clear previous chat so the user starts fresh
            try {
                localStorage.setItem(
                    "dash-widget-builder",
                    JSON.stringify({ messages: [] })
                );
            } catch (_) {
                /* ignore */
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editContext, isOpen]);

    // Set default edit mode once ownership is determined
    useEffect(() => {
        if (!isRemixMode || !registryChecked) return;
        setEditMode(isOwner ? "update" : "remix");
    }, [isRemixMode, isOwner, registryChecked]);

    const compilePreview = useCallback(
        async (code) => {
            const name = extractWidgetName(code.componentCode);
            if (!name || !code.componentCode) return;

            setIsCompiling(true);
            setPreviewError(null);
            setPreviewComponent(null);
            setInstallStatus(null);
            lastCompiledCode.current = code.componentCode;

            try {
                const result =
                    await window.mainApi?.widgetBuilder?.compilePreview(
                        name,
                        code.componentCode,
                        code.configCode ||
                            (() => {
                                const displayName = name
                                    .replace(/([A-Z])/g, " $1")
                                    .trim();
                                // Preview-only template — category is a placeholder
                                // here; the user-selected value gets injected at
                                // install time in handleInstall.
                                return `export default { component: "${name}", name: "${displayName}", package: "${displayName}", author: "AI Assistant", category: "general", type: "widget", canHaveChildren: false, workspace: "ai-built" };`;
                            })(),
                        // Pass the source package so multi-file widgets can
                        // resolve relative imports from the installed package.
                        editContext?.originalPackage || null
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
                // Match by exact key OR by bare name suffix (scoped IDs
                // like "trops.algolia.AlgoliaSearchWidget" end with the
                // bare component name).
                const match =
                    configs.find((c) => c.key === name) ||
                    configs.find((c) => c.key.endsWith(`.${name}`)) ||
                    configs.find(
                        (c) => c.key === name || c.config?.name === name
                    );

                if (match && typeof match.config.component === "function") {
                    // Let PreviewErrorBoundary catch runtime errors in React's context
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
        },
        [editContext?.originalPackage]
    );

    // Track in-progress edits (not yet saved/compiled)
    const [editBuffer, setEditBuffer] = useState({
        component: null,
        config: null,
    });
    const hasUnsavedEdits =
        editBuffer.component !== null || editBuffer.config !== null;

    // Handle manual code edits from the Code tab (buffers only, no compile)
    const handleCodeEdit = useCallback(
        (newCode) => {
            manualEditRef.current = true;
            setEditBuffer((prev) => ({
                ...prev,
                [activeFile]: newCode,
            }));
        },
        [activeFile]
    );

    // Save: apply buffered edits and recompile
    const handleSaveEdits = useCallback(() => {
        const updated = {
            componentCode: editBuffer.component ?? detectedCode.componentCode,
            configCode: editBuffer.config ?? detectedCode.configCode,
        };
        setDetectedCode(updated);
        setEditBuffer({ component: null, config: null });
        lastCompiledCode.current = null;
        compilePreview(updated);
    }, [editBuffer, detectedCode, compilePreview]);

    // Cancel: discard buffered edits
    const handleCancelEdits = useCallback(() => {
        setEditBuffer({ component: null, config: null });
        manualEditRef.current = false;
    }, []);

    const handleInstall = useCallback(async () => {
        if (!detectedCode.componentCode || !widgetName) return;
        // Category is required — install button is disabled until picked, but
        // guard here too in case this is invoked programmatically.
        if (!selectedCategory) return;
        setInstallStatus("installing");
        try {
            // Determine install name based on edit mode:
            //   "update" → keep original name (overwrites source in-place)
            //   "remix"  → use the user-chosen remix name (new package)
            let installName = widgetName;
            let installComponentCode = detectedCode.componentCode;
            if (
                isRemixMode &&
                editMode === "remix" &&
                remixName &&
                remixName !== widgetName
            ) {
                installName = remixName;
                // Rename the export in the source code
                installComponentCode = installComponentCode.replace(
                    new RegExp(
                        `(export\\s+default\\s+function\\s+)${widgetName}\\b`
                    ),
                    `$1${installName}`
                );
            }

            // Build remix metadata when creating a new copy
            const remixMeta =
                isRemixMode && editMode === "remix"
                    ? {
                          remixedFrom: {
                              package: editContext.originalPackage || "unknown",
                              component:
                                  editContext.originalComponentName ||
                                  "unknown",
                              author: editContext.manifest?.author || "Unknown",
                              version: editContext.manifest?.version || "1.0.0",
                          },
                      }
                    : null;

            // Build the final configCode with the user-selected category baked in.
            // Two paths:
            //  - AI generated its own config → inject/replace `category` via regex
            //  - No config from AI → use the default template, interpolating category
            let finalConfigCode;
            if (detectedCode.configCode) {
                finalConfigCode = injectCategoryIntoConfigCode(
                    detectedCode.configCode,
                    selectedCategory
                );
                // Update the component reference in config to match the rename
                if (installName !== widgetName) {
                    finalConfigCode = finalConfigCode.replace(
                        new RegExp(
                            `(component\\s*:\\s*["'])${widgetName}(["'])`,
                            "g"
                        ),
                        `$1${installName}$2`
                    );
                }
            } else {
                const displayName = installName
                    .replace(/([A-Z])/g, " $1")
                    .trim();
                finalConfigCode = `export default { component: "${installName}", name: "${displayName}", package: "${displayName}", author: "AI Assistant", category: "${selectedCategory}", type: "widget", canHaveChildren: false, workspace: "ai-built" };`;
            }

            const result = await window.mainApi?.widgetBuilder?.aiBuild(
                installName,
                installComponentCode,
                finalConfigCode,
                `AI-generated widget: ${installName}`,
                cellContext || null,
                process.env.REACT_APP_IDENTIFIER || "@trops/dash-electron",
                remixMeta
            );
            if (result?.success) {
                setInstallStatus({
                    success: true,
                    widgetName: result.widgetName,
                });
                if (onInstalled) {
                    onInstalled(installName, result.widgetName);
                }
            } else {
                setInstallStatus({
                    error: result?.error || "Install failed",
                });
            }
        } catch (err) {
            setInstallStatus({ error: err.message });
        }
    }, [
        detectedCode,
        widgetName,
        selectedCategory,
        onInstalled,
        cellContext,
        editContext,
        isRemixMode,
        editMode,
        remixName,
    ]);

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
                        {isRemixMode
                            ? "Edit Widget with AI"
                            : "Build Widget with AI"}
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
                <div className="flex flex-col flex-[2] min-w-0 min-h-0 overflow-hidden">
                    {/* Tab bar */}
                    <div
                        className={`flex items-center justify-between px-2 py-1.5 border-b ${borderColor} shrink-0`}
                    >
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setActiveTab("preview")}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                                    activeTab === "preview"
                                        ? "bg-indigo-600/20 text-indigo-300"
                                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                }`}
                            >
                                <FontAwesomeIcon
                                    icon="eye"
                                    className="h-2.5 w-2.5"
                                />
                                Preview
                            </button>
                            <button
                                onClick={() => setActiveTab("code")}
                                disabled={!detectedCode.componentCode}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                                    activeTab === "code"
                                        ? "bg-indigo-600/20 text-indigo-300"
                                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                } ${
                                    !detectedCode.componentCode
                                        ? "opacity-30 cursor-not-allowed"
                                        : ""
                                }`}
                            >
                                <FontAwesomeIcon
                                    icon="code"
                                    className="h-2.5 w-2.5"
                                />
                                Code
                            </button>
                            <button
                                onClick={() => setActiveTab("configure")}
                                disabled={!detectedCode.componentCode}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                                    activeTab === "configure"
                                        ? "bg-indigo-600/20 text-indigo-300"
                                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                } ${
                                    !detectedCode.componentCode
                                        ? "opacity-30 cursor-not-allowed"
                                        : ""
                                }`}
                            >
                                <FontAwesomeIcon
                                    icon="cog"
                                    className="h-2.5 w-2.5"
                                />
                                Configure
                            </button>
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
                                {isRemixMode ? "Remixed as" : "Installed as"}{" "}
                                {installStatus.widgetName}
                            </span>
                        )}
                    </div>

                    {/* Preview content (visible when Preview tab is active) */}
                    {activeTab === "preview" && (
                        <div className="flex-1 overflow-auto p-4">
                            {/* Source unavailable error (widget needs re-publish) */}
                            {editContext?.sourceError &&
                                !previewComponent &&
                                !previewError &&
                                !isCompiling && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                        <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
                                            <FontAwesomeIcon
                                                icon="exclamation-triangle"
                                                className="h-7 w-7 text-amber-400/60"
                                            />
                                        </div>
                                        <div className="space-y-2 max-w-md">
                                            <p className="text-sm font-medium text-gray-300">
                                                Source code not available
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {editContext.originalComponentName
                                                    ? `"${editContext.originalComponentName}" `
                                                    : "This widget "}
                                                was published without source
                                                files. Re-publish the widget
                                                package to include source files
                                                for remixing.
                                            </p>
                                            <p className="text-xs text-gray-600 mt-2">
                                                You can still describe a new
                                                widget from scratch using the
                                                chat.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            {/* Empty state */}
                            {!previewComponent &&
                                !previewError &&
                                !isCompiling &&
                                !editContext?.sourceError && (
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
                                                The AI will generate code and a
                                                live preview will appear here
                                                automatically.
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
                                        <button
                                            onClick={() => {
                                                try {
                                                    const raw =
                                                        localStorage.getItem(
                                                            "dash-widget-builder"
                                                        );
                                                    if (raw) {
                                                        const data =
                                                            JSON.parse(raw);
                                                        const msgs =
                                                            data?.messages ||
                                                            [];
                                                        msgs.push({
                                                            role: "user",
                                                            content: `Fix this compilation error:\n\n${previewError}\n\nPlease output both the corrected jsx component code block and the javascript config code block.`,
                                                        });
                                                        localStorage.setItem(
                                                            "dash-widget-builder",
                                                            JSON.stringify({
                                                                ...data,
                                                                messages: msgs,
                                                            })
                                                        );
                                                    }
                                                } catch (_) {
                                                    /* ignore */
                                                }
                                            }}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                        >
                                            Send error to AI
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Live widget preview */}
                            {PreviewComponent && !installStatus && (
                                <div className="flex flex-col h-full">
                                    {/* Widget preview — fills available space */}
                                    <div className="flex-1 p-4 overflow-auto">
                                        <div
                                            className={`h-full rounded-lg border overflow-hidden shadow-lg ${
                                                previewThemeCtx?.currentTheme?.[
                                                    "border-primary-dark"
                                                ] || "border-gray-700/30"
                                            } ${
                                                previewThemeCtx?.currentTheme?.[
                                                    "bg-primary-dark"
                                                ] || "bg-gray-800/30"
                                            }`}
                                        >
                                            <PreviewContextWrapper
                                                appCtx={
                                                    previewAppCtx || appContext
                                                }
                                                themeCtx={previewThemeCtx}
                                                editContext={editContext}
                                            >
                                                <PreviewErrorBoundary
                                                    key={
                                                        lastCompiledCode.current
                                                    }
                                                    resetKey={
                                                        lastCompiledCode.current
                                                    }
                                                >
                                                    <React.Suspense
                                                        fallback={
                                                            <div className="p-8 text-center text-gray-500 text-sm">
                                                                Loading
                                                                preview...
                                                            </div>
                                                        }
                                                    >
                                                        <PreviewComponent
                                                            title={displayName}
                                                        />
                                                    </React.Suspense>
                                                </PreviewErrorBoundary>
                                            </PreviewContextWrapper>
                                        </div>
                                    </div>
                                    {/* Footer — mode toggle, name (remix), category + Install */}
                                    <div
                                        className={`px-6 py-3 border-t ${borderColor} shrink-0`}
                                    >
                                        {isRemixMode && (
                                            <div className="mb-2 space-y-2">
                                                {/* Sign-in nudge for non-ai-built widgets when not authenticated */}
                                                {!isOwner &&
                                                    registryChecked &&
                                                    !registryUsername &&
                                                    widgetScope !==
                                                        "ai-built" && (
                                                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-900/15 border border-amber-700/30">
                                                            <p className="flex-1 text-xs text-amber-200 leading-snug">
                                                                Sign in to the
                                                                registry to
                                                                update your own
                                                                widgets in place
                                                                instead of
                                                                duplicating.
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    try {
                                                                        await window.mainApi?.registryAuth?.initiateLogin();
                                                                    } catch {
                                                                        /* ignore */
                                                                    }
                                                                }}
                                                                className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 transition-colors"
                                                            >
                                                                Sign in
                                                            </button>
                                                        </div>
                                                    )}
                                                {/* Update / Remix toggle — only when user is the owner */}
                                                {isOwner && (
                                                    <div className="flex items-center gap-1 bg-gray-800/50 rounded-md border border-gray-700/50 p-0.5 w-fit">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setEditMode(
                                                                    "update"
                                                                )
                                                            }
                                                            className={`px-3 py-1 text-xs rounded transition-colors ${
                                                                editMode ===
                                                                "update"
                                                                    ? "bg-indigo-600/30 text-indigo-300 font-medium"
                                                                    : "text-gray-500 hover:text-gray-300"
                                                            }`}
                                                        >
                                                            Update Original
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setEditMode(
                                                                    "remix"
                                                                )
                                                            }
                                                            className={`px-3 py-1 text-xs rounded transition-colors ${
                                                                editMode ===
                                                                "remix"
                                                                    ? "bg-indigo-600/30 text-indigo-300 font-medium"
                                                                    : "text-gray-500 hover:text-gray-300"
                                                            }`}
                                                        >
                                                            Remix as New
                                                        </button>
                                                    </div>
                                                )}
                                                {editMode === "remix" && (
                                                    <input
                                                        type="text"
                                                        value={remixName}
                                                        onChange={(e) => {
                                                            const raw =
                                                                e.target.value.replace(
                                                                    /[^a-zA-Z0-9]/g,
                                                                    ""
                                                                );
                                                            setRemixName(
                                                                raw
                                                                    .charAt(0)
                                                                    .toUpperCase() +
                                                                    raw.slice(1)
                                                            );
                                                        }}
                                                        placeholder="RemixWidgetName"
                                                        className="w-full px-3 py-1.5 text-sm bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
                                                        title="Name for the remixed widget (PascalCase)"
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs text-gray-500 truncate">
                                                {!isRemixMode
                                                    ? `Installs to @ai-built/${widgetName?.toLowerCase()}`
                                                    : editMode === "update"
                                                    ? `Updates ${
                                                          editContext.originalPackage ||
                                                          `@ai-built/${widgetName?.toLowerCase()}`
                                                      }`
                                                    : `Remixes ${
                                                          editContext.originalComponentName
                                                      } → @ai-built/${(
                                                          remixName ||
                                                          widgetName
                                                      )?.toLowerCase()}`}
                                            </span>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <select
                                                    value={
                                                        selectedCategory || ""
                                                    }
                                                    onChange={(e) =>
                                                        setSelectedCategory(
                                                            e.target.value ||
                                                                null
                                                        )
                                                    }
                                                    className="px-2 py-1.5 text-xs bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
                                                    title="Pick a category before installing"
                                                >
                                                    <option value="" disabled>
                                                        Pick a category…
                                                    </option>
                                                    {VALID_CATEGORIES.map(
                                                        (c) => (
                                                            <option
                                                                key={c}
                                                                value={c}
                                                            >
                                                                {c}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                                <button
                                                    onClick={handleInstall}
                                                    disabled={
                                                        !selectedCategory ||
                                                        (isRemixMode &&
                                                            editMode ===
                                                                "remix" &&
                                                            !remixName)
                                                    }
                                                    className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                                                    title={
                                                        !selectedCategory
                                                            ? "Pick a category first"
                                                            : editMode ===
                                                                  "remix" &&
                                                              !remixName
                                                            ? "Enter a name for the remix"
                                                            : undefined
                                                    }
                                                >
                                                    {!isRemixMode
                                                        ? "Install Widget"
                                                        : editMode === "update"
                                                        ? "Update Widget"
                                                        : "Remix Widget"}
                                                </button>
                                            </div>
                                        </div>
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
                                            {!isRemixMode
                                                ? "Widget Installed!"
                                                : editMode === "update"
                                                ? "Widget Updated!"
                                                : "Widget Remixed!"}
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            <span className="font-mono text-gray-300">
                                                {installStatus.widgetName}
                                            </span>{" "}
                                            {!isRemixMode
                                                ? "is now in the widget selector."
                                                : editMode === "update"
                                                ? "has been updated in place."
                                                : "has been swapped into your dashboard."}
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
                    )}

                    {/* Code editor (visible when Code tab is active) */}
                    {activeTab === "code" && detectedCode.componentCode && (
                        <div className="flex flex-1 min-h-0 overflow-hidden">
                            {/* File explorer sidebar */}
                            <div
                                className={`w-48 border-r ${borderColor} shrink-0 overflow-auto py-1`}
                            >
                                <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                    Files
                                </div>
                                <button
                                    onClick={() => setActiveFile("component")}
                                    className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate transition-colors ${
                                        activeFile === "component"
                                            ? "bg-indigo-600/15 text-indigo-300"
                                            : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                    }`}
                                >
                                    <FontAwesomeIcon
                                        icon="file-code"
                                        className="h-2.5 w-2.5 mr-1.5"
                                    />
                                    {widgetName || "Widget"}.js
                                </button>
                                <button
                                    onClick={() => setActiveFile("config")}
                                    className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate transition-colors ${
                                        activeFile === "config"
                                            ? "bg-indigo-600/15 text-indigo-300"
                                            : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                    }`}
                                >
                                    <FontAwesomeIcon
                                        icon="cog"
                                        className="h-2.5 w-2.5 mr-1.5"
                                    />
                                    {widgetName || "Widget"}.dash.js
                                </button>
                            </div>
                            {/* Editor pane with breadcrumb header */}
                            <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
                                {/* Breadcrumb path */}
                                <div
                                    className={`flex items-center gap-1 px-3 py-1.5 border-b ${borderColor} shrink-0 text-xs`}
                                >
                                    <span className="text-gray-600">
                                        @ai-built
                                    </span>
                                    <span className="text-gray-700">/</span>
                                    <span className="text-gray-600">
                                        {(widgetName || "widget").toLowerCase()}
                                    </span>
                                    <span className="text-gray-700">/</span>
                                    <span className="text-gray-600">
                                        widgets
                                    </span>
                                    <span className="text-gray-700">/</span>
                                    <span className="text-gray-300 font-medium">
                                        {widgetName || "Widget"}
                                        {activeFile === "config"
                                            ? ".dash.js"
                                            : ".js"}
                                    </span>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden relative">
                                    <div className="absolute inset-0">
                                        <CodeEditorVS
                                            key={activeFile}
                                            code={
                                                editBuffer[activeFile] ??
                                                (activeFile === "component"
                                                    ? detectedCode.componentCode
                                                    : detectedCode.configCode ||
                                                      "")
                                            }
                                            language="javascript"
                                            onChange={handleCodeEdit}
                                            readOnly={false}
                                            minimapEnabled={false}
                                            padding="p-0"
                                        />
                                    </div>
                                </div>
                                {/* Footer bar — always visible */}
                                <div
                                    className={`flex items-center justify-between px-3 py-2 border-t ${borderColor} shrink-0`}
                                >
                                    <span className="text-[10px] text-gray-600">
                                        {hasUnsavedEdits
                                            ? "Unsaved changes"
                                            : ""}
                                    </span>
                                    {hasUnsavedEdits ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleCancelEdits}
                                                className="px-3 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEdits}
                                                className="px-3 py-1 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                                            >
                                                Save &amp; Compile
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-gray-600">
                                            JavaScript
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Configure tab */}
                    {activeTab === "configure" &&
                        detectedCode.componentCode && (
                            <WidgetConfigureTab
                                configCode={detectedCode.configCode || ""}
                                componentName={widgetName}
                                borderColor={borderColor}
                                onSave={(newConfigCode) => {
                                    const updated = {
                                        ...detectedCode,
                                        configCode: newConfigCode,
                                    };
                                    setDetectedCode(updated);
                                    lastCompiledCode.current = null;
                                    compilePreview(updated);
                                }}
                            />
                        )}
                </div>

                {/* Right: Chat (1/3) */}
                <div
                    className={`flex flex-col flex-1 min-w-0 border-l ${borderColor}`}
                >
                    <ChatCore
                        title=""
                        model={model}
                        systemPrompt={
                            editContext?.componentCode
                                ? `${SYSTEM_PROMPT}\n\nYou are editing an existing widget. The user will describe what changes they want. Here is the CURRENT source code you are modifying:\n\nComponent (jsx):\n\`\`\`jsx\n${
                                      editContext.componentCode
                                  }\n\`\`\`\n\nConfig (.dash.js):\n\`\`\`javascript\n${
                                      editContext.configCode || ""
                                  }\n\`\`\`\n\nWhen the user describes changes, output BOTH updated code blocks (the full component and full config) incorporating their requested changes. Do NOT ask the user to share the code — you already have it above.`
                                : SYSTEM_PROMPT
                        }
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
