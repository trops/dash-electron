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
    makeScopedComponentId,
} from "@trops/dash-core";
import { WidgetConfigureTab } from "./WidgetConfigureTab";
import { ChatProviderGate } from "./ChatProviderGate";

/**
 * Wraps the preview widget in the full context stack (AppContext,
 * ThemeContext, WidgetContext) so hooks like useMcpProvider work.
 * Auto-selects the first matching provider for each type declared
 * in the widget config.
 */
/**
 * Parse `providers: [...]` out of a .dash.js config string. Returns
 * [{ type, providerClass }]. Used by the preview to know which
 * provider declarations the widget has so we can offer a picker.
 */
function extractProviderDeclarations(configCode) {
    const providers = [];
    if (!configCode) return providers;
    const providerMatch = configCode.match(/providers\s*:\s*\[([\s\S]*?)\]/);
    if (!providerMatch) return providers;
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
            providerClass: classes[i] || "credential",
        });
        i++;
    }
    return providers;
}

/**
 * Small picker strip rendered above the live widget preview. For each
 * provider type the widget declares, surfaces the compatible providers
 * the user has configured in the app and lets them pick one. The picker
 * never auto-selects — an explicit choice is required before the widget
 * sees a real provider. This avoids surprising the user by sending
 * traffic from preview to a provider they didn't expect.
 */
function PreviewProviderPicker({
    configCode,
    appProviders,
    selection,
    onChange,
}) {
    const declarations = React.useMemo(
        () => extractProviderDeclarations(configCode || ""),
        [configCode]
    );

    // Group the user's configured providers by type, matching type only
    // (providerClass is often unset or inconsistent across widget authors,
    // so being strict here would hide valid matches).
    const compatibleByType = React.useMemo(() => {
        const map = {};
        if (!appProviders) return map;
        for (const decl of declarations) {
            map[decl.type] = Object.values(appProviders).filter(
                (p) => p.type === decl.type
            );
        }
        return map;
    }, [declarations, appProviders]);

    if (declarations.length === 0) return null;

    return (
        <div className="px-4 pt-2 pb-3 border-b border-gray-800/60 shrink-0 space-y-2">
            {declarations.map((decl) => {
                const options = compatibleByType[decl.type] || [];
                const current = selection?.[decl.type] || "";
                const label = decl.type.replace(/^./, (c) => c.toUpperCase());
                return (
                    <div
                        key={decl.type}
                        className="flex items-center gap-2 text-xs"
                    >
                        <span className="text-gray-400 shrink-0">
                            {label} provider:
                        </span>
                        {options.length === 0 ? (
                            <button
                                type="button"
                                onClick={() => {
                                    // Cross-modal nav: dash-electron's
                                    // Dash.js listens for this and closes
                                    // the WidgetBuilderModal; dash-core's
                                    // DashboardStage listens for the same
                                    // event and opens Settings →
                                    // Providers in create mode with the
                                    // type pre-selected (catalog detail
                                    // for mcp class, credential form for
                                    // credential class).
                                    try {
                                        window.dispatchEvent(
                                            new CustomEvent(
                                                "dash:open-settings-create-provider",
                                                {
                                                    detail: {
                                                        type: decl.type,
                                                        providerClass:
                                                            decl.providerClass ||
                                                            null,
                                                    },
                                                }
                                            )
                                        );
                                    } catch (err) {
                                        console.warn(
                                            "[PreviewProviderPicker] Failed to dispatch open-settings-create-provider:",
                                            err
                                        );
                                    }
                                }}
                                className="text-[11px] px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-700/40 transition-colors"
                            >
                                + Add new {label} provider
                            </button>
                        ) : (
                            <select
                                value={current}
                                onChange={(e) =>
                                    onChange({
                                        ...(selection || {}),
                                        [decl.type]: e.target.value,
                                    })
                                }
                                className="flex-1 max-w-xs px-2 py-1 bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
                            >
                                <option value="">— Select a provider —</option>
                                {options.map((p) => (
                                    <option key={p.name} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function PreviewContextWrapper({
    appCtx,
    themeCtx,
    editContext,
    previewProviderSelection,
    children,
}) {
    const widgetData = React.useMemo(() => {
        const providers = extractProviderDeclarations(
            editContext?.configCode || ""
        );
        // Precedence for the widget's selectedProviders:
        //   1. Explicit user selection made in the preview picker
        //   2. editContext.selectedProviders (Edit-with-AI carries over the
        //      providers already wired to the widget on the dashboard)
        //   3. Empty — the widget renders its own "not configured" state
        const selectedProviders = {
            ...(editContext?.selectedProviders || {}),
            ...(previewProviderSelection || {}),
        };
        // userPrefs from the dashboard widget instance — threaded in
        // via Edit-with-AI so the preview renders with the same title,
        // defaults, and configured state the user sees on the live
        // dashboard instead of blank values.
        return {
            providers,
            selectedProviders,
            userPrefs: editContext?.userPrefs || null,
            uuidString: "preview-widget",
        };
    }, [
        editContext?.configCode,
        editContext?.selectedProviders,
        editContext?.userPrefs,
        previewProviderSelection,
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

// ─── System prompt builder ──────────────────────────────────────────
//
// The widget-builder system prompt is assembled at modal-mount time so we
// can splice in dynamic context — specifically the live MCP catalogs —
// alongside the static rules. The static parts (component cheatsheet,
// styling guardrails, multi-file protocol, MCP-first decision tree)
// don't change between sessions, but they all live here as one builder
// so the entire prompt is in one place when reading or auditing.
//
// Sections in order (static unless marked DYNAMIC):
//   1. Output protocol (single- or multi-file via `File:` markers)
//   2. Component-library cheatsheet (dash-react)
//   3. Styling rules (Tailwind safelist guardrails)
//   4. Provider integration pattern
//   5. ## Available MCP providers (built-in) — DYNAMIC, from local catalog
//   6. ## Other known MCP servers — DYNAMIC, from curated allow-list
//   7. ## When the user asks for a widget that needs external data
//      (the MCP-first decision tree)
//   8. Critical rules (no tools, no skills, etc.)

function formatBuiltInCatalogForPrompt(servers) {
    if (!Array.isArray(servers) || servers.length === 0) {
        return "(none configured — only build widgets that don't need external services until the user adds providers)";
    }
    return servers
        .map((s) => {
            const credKeys = Object.keys(s.credentialSchema || {});
            const credNote =
                credKeys.length > 0
                    ? `requires: ${credKeys.join(", ")}`
                    : "no credentials needed";
            return `- ${s.id} — ${s.name}: ${
                s.description || ""
            } (${credNote})`;
        })
        .join("\n");
}

function formatKnownExternalForPrompt(servers) {
    if (!Array.isArray(servers) || servers.length === 0) return "(none)";
    return servers
        .map((s) => `- ${s.id} — ${s.name}: ${s.description || ""}`)
        .join("\n");
}

/**
 * Format the user's currently-installed providers for the prompt.
 * The AI uses this to detect "this widget needs algolia, the user
 * already has an algolia provider, no install required" — saving the
 * user from reconfiguring credentials they've already set up.
 */
function formatInstalledProvidersForPrompt(providersMap) {
    if (!providersMap || typeof providersMap !== "object") return "(none)";
    const entries = Object.values(providersMap).filter(
        (p) => p && typeof p === "object" && p.type
    );
    if (entries.length === 0) return "(none)";
    return entries
        .map((p) => {
            const cls = p.providerClass || "credential";
            return `- ${p.name} — type: \`${p.type}\`, class: \`${cls}\``;
        })
        .join("\n");
}

function buildSystemPrompt({
    builtInCatalog = [],
    knownExternalCatalog = [],
    installedProviders = {},
    selectedProvider = null,
} = {}) {
    // The user picks a provider via the WidgetProviderPicker BEFORE
    // sending a chat message. When a provider is selected, the prompt
    // gets a single focused "use this exact provider" section and the
    // catalogs + decision tree + HARD RULE are dropped entirely. This
    // takes the provider-selection decision out of the LLM's hands so
    // it can stop wavering between MCP/credential and just write code.
    const hasPicked =
        selectedProvider &&
        (selectedProvider.sentinel === "none" ||
            (selectedProvider.type && selectedProvider.providerClass));
    const isPickedNone = selectedProvider?.sentinel === "none";
    const pickedType = selectedProvider?.type;
    const pickedClass = selectedProvider?.providerClass;

    // Catalogs are still useful when no specific provider is picked
    // yet — keep the legacy decision-tree path so the modal still
    // works during the brief window between modal-open and picker-
    // selection. Once the picker fires, the focused branch wins.
    const installedTypeSet = new Set();
    for (const p of Object.values(installedProviders || {})) {
        if (p && typeof p === "object" && p.type) {
            installedTypeSet.add(p.type);
        }
    }
    const filteredBuiltIn = (builtInCatalog || []).filter(
        (s) => s && !installedTypeSet.has(s.id)
    );
    const filteredKnownExternal = (knownExternalCatalog || []).filter(
        (s) => s && !installedTypeSet.has(s.id)
    );

    // Focused branch: the user has picked. Emit only what the AI needs.
    if (hasPicked && !isPickedNone) {
        return `You are the Dash Widget Builder. The user has pre-selected the provider for this widget. Your job is to write code that uses it.

## Provider for this widget (PRE-SELECTED — DO NOT DEVIATE)

- Type: ${pickedType}
- Class: ${pickedClass}

The widget config MUST declare:
\`\`\`javascript
providers: [{ type: "${pickedType}", providerClass: "${pickedClass}", required: true }]
\`\`\`

Consume the provider via the hook for class \`${pickedClass}\`:

${
    pickedClass === "credential"
        ? `\`\`\`jsx
import React, { useState, useEffect } from "react";
import { useWidgetProviders, useProviderClient } from "@trops/dash-core";
import { Panel, EmptyState } from "@trops/dash-react";

export default function MyWidget({ title }) {
  const { hasProvider, getProvider } = useWidgetProviders();
  if (!hasProvider("${pickedType}")) {
    return <Panel><EmptyState message="Configure a ${pickedType} provider in Settings → Providers" /></Panel>;
  }
  const provider = getProvider("${pickedType}");
  const pc = useProviderClient(provider);
  // pc is { providerHash, providerName, dashboardAppId }
  // For provider-specific API calls, use the host IPC, e.g. for algolia:
  //   const result = await window.mainApi.algolia.search(pc, { indexName, query });
  // If no host IPC exists for this type yet, leave a TODO comment in the
  // call site — the user will wire it.
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    // TODO: replace with the appropriate window.mainApi.<service>.<method>(pc, ...)
    // call for type "${pickedType}".
    return () => { cancelled = true; };
  }, [pc?.providerHash]);
  return <Panel>{/* render data */}</Panel>;
}
\`\`\``
        : `\`\`\`jsx
import React, { useState, useEffect } from "react";
import { useMcpProvider } from "@trops/dash-core";
import { Panel, ErrorMessage, Skeleton } from "@trops/dash-react";

export default function MyWidget() {
  const { callTool, tools, isConnected, error } = useMcpProvider("${pickedType}");
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    // TODO: pick the right tool from \`tools\` (or pass an explicit name) for
    // the user's intent and call it. Tool calls are async, must go in a
    // useEffect, never at render.
    // Example shape:
    //   callTool("<tool_name>", { /* args */ })
    //     .then((r) => { if (!cancelled) setData(r); })
    //     .catch(() => {});
    return () => { cancelled = true; };
  }, [isConnected, callTool]);
  if (error) return <Panel><ErrorMessage message={error} /></Panel>;
  if (!isConnected) return <Panel><Skeleton /></Panel>;
  return <Panel>{/* render data */}</Panel>;
}
\`\`\``
}

DO NOT change the provider class. DO NOT pick a different provider type. DO NOT use \`useMcpProvider\` if the class above is \`credential\`, and vice versa. The user has already configured this provider — your only job is to write a working widget that consumes it.

## Output protocol

You can output either a single-file widget (component + config) or a multi-file package.

SINGLE-FILE (default for most widgets):
1. A \`\`\`jsx code block with the React component
2. A \`\`\`javascript code block with the .dash.js config

That's it — no \`File:\` markers needed. The app saves them as
\`widgets/<Name>.js\` and \`widgets/<Name>.dash.js\`.

MULTI-FILE (when the package needs shared utilities, multiple widgets, or supporting files):
Prefix each fenced code block with a \`File: <relative-path>\` marker on its own line.

Allowed paths:
- \`widgets/<Name>.js\` and \`widgets/<Name>.dash.js\` for each widget
- \`widgets/<subdir>/foo.js\` for shared utilities
- Package-root files: \`README.md\`, \`<package>.config.js\`
- DO NOT write to \`dist/\`, \`node_modules/\`, \`.git/\`, or any hidden dotfile path
- DO NOT use \`..\` segments or absolute paths

For multi-widget packages, every widget needs BOTH a \`<Name>.js\` and matching \`<Name>.dash.js\`.

## Widget config rules

- Default export the component: \`export default function WidgetName(props) { ... }\`
- Import React hooks from 'react': \`import React, { useState, useEffect } from 'react';\`
- NEVER import useState, useEffect, or any React hooks from '@trops/dash-react' — they MUST come from 'react'
- Wrap the component in \`<Panel>…</Panel>\` (it's the canonical widget chrome).
- Config MUST include: \`component\` (matching function name), \`name\` (display name with spaces), \`type: "widget"\`, \`canHaveChildren: false\`, \`workspace: "ai-built"\`, plus the \`providers: [...]\` array shown above.

### How userConfig values reach the component

The \`userConfig\` block is a SCHEMA. The host passes each field's value as a flat top-level prop (named after the field key). Read \`props.fieldName\` directly. NEVER use \`props.userConfig.X\` or \`props.config.X\` — those don't exist.

Example: \`userConfig: { defaultJql: { type: "text", defaultValue: "X", displayName: "Default JQL" } }\` → component reads \`props.defaultJql\` (not \`props.userConfig.defaultJql\`). Always provide a fallback: \`const v = props.defaultJql || "X";\`.

## Component library — @trops/dash-react

All widgets MUST use @trops/dash-react components instead of raw HTML — they pick up the active theme automatically.

Components: Panel (REQUIRED widget wrapper), Card, DashPanel, LayoutContainer, Heading/2/3, SubHeading/2/3, Paragraph, Tag, Button, ButtonIcon, InputText, TextArea, SelectInput, Toggle, Switch, Checkbox, RadioGroup, Slider, SearchInput, Menu, MenuItem, DropdownPanel, Alert, AlertBanner, Toast, ProgressBar, EmptyState, Skeleton, ErrorMessage, Table, Tabs, Accordion, DataList, StatCard, FontAwesomeIcon, Modal.

Forms accept a \`label\` prop, NOT children. Buttons/Tags/Headings prefer prop form (\`title\`, \`text\`) over children for visible text.

## Styling rules — TAILWIND SAFELIST IS NARROW

ALLOWED: \`bg/text/border-{color}-{shade}\` (gray, slate, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose; shades 50-950), \`opacity-0..100\`, \`grid-cols-{1..12}\`, gradient \`from/via/to-{color}-{shade}\`, hover variants on bg/text/border colors, standard layout/spacing utilities at standard sizes.

DO NOT USE (silently fail): opacity modifiers (\`bg-white/10\`), arbitrary values (\`text-[10px]\`, \`w-[440px]\`, \`bg-[#abc]\`), \`ring-*\`, \`divide-*\` color variants, \`outline-*\` color variants. Use inline \`style={{...}}\` for non-safelisted needs.

## Critical rules

- Do NOT use Read, Write, Edit, Bash, Glob, or Grep tools.
- Do NOT invoke the dash-widget-builder skill or any other skill.
- Do NOT read files, scan directories, or run shell commands.
- Do NOT call any tools — the provider is already chosen.
- ONLY output text + code blocks (with optional \`File:\` markers).
- ALWAYS output COMPLETE code blocks. Never partial diffs or snippets.
- ALWAYS emit BOTH a \`\`\`jsx component block AND a \`\`\`javascript config block — never just one. Without the config block the widget will not install. The config block MUST contain the \`providers: [...]\` array shown above.
- Widget code runs in the BROWSER (renderer process). DO NOT use Node-only APIs: \`process.cwd()\`, \`process.env\` (except \`process.env.NODE_ENV\`), \`__dirname\`, \`__filename\`, \`require()\`, or imports of \`fs\` / \`path\` / \`os\` / \`child_process\` / \`crypto\` / \`stream\`. For paths default to literal strings like \`"/"\` or \`"~/"\`, or take a path from \`props\` / \`userConfig\`. To talk to the OS, go through the provider hooks (mcp \`callTool\` or credential \`window.mainApi.<service>\`).
- DEFENSIVE on every MCP tool response. Shapes are provider-specific and undocumented; never assume a field exists. Guard before calling string/array methods: \`typeof item.name === "string" ? item.name.split(".").pop() : ""\`, \`Array.isArray(result?.entries) ? result.entries : []\`, \`const name = typeof item === "string" ? item : item?.name\`. Use optional chaining (\`item?.type === "directory"\`). Errors like "Cannot read properties of undefined" or "X is not a function" on first render are NOT acceptable.
- For MCP widgets: DON'T hardcode tool names like \`callTool("read_directory", ...)\`. Tool names are server-specific and AI guesses are usually wrong (e.g., the official filesystem server exposes \`list_directory\`, not \`read_directory\`). Discover the right tool from the live \`tools\` array returned by \`useMcpProvider\`: \`const tool = tools.find(t => t.name === "list_directory") || tools.find(t => t.name.includes("list"))\`. If no tool matches, render an actionable error (\`<ErrorMessage message={\\\`No directory-listing tool. Available: \\\${tools.map(t => t.name).join(", ")}\\\`} />\`), NOT an empty state.
- **MCP response envelope.** Tool responses follow the protocol shape \`{ content: [{ type: "text", text: "…" }, …] }\`. The actual data is INSIDE the \`text\` field of each content item, NOT at the top of \`result\`. Extract before parsing: \`const text = result?.content?.find(c => c?.type === "text")?.text; const lines = typeof text === "string" ? text.split("\\\\n").filter(Boolean) : [];\`. Server-specific format inside \`text\` varies (newline-separated list, JSON, plain prose) — parse per the server's documented format. The standard filesystem server's \`list_directory\` returns lines like \`[FILE] foo.txt\` and \`[DIR] subdir/\`. DON'T assume \`callTool(...)\` returns a structured array directly — that's the protocol envelope, not the data.
- **NEVER silently swallow errors.** A \`catch\` block MUST render the error to the user via \`<ErrorMessage message={err.message} />\` (or equivalent visible feedback in the widget) — NOT just \`setData([])\` followed by a blank state. An empty array is fine when the data really IS empty; an empty array as the *result of a caught exception* is a silent failure that leaves the user wondering whether the widget loaded. Every error path needs a user-visible signal.
- Respond immediately with the code.`;
    }

    // No-provider branch: user explicitly picked "no external provider".
    // Skip ALL provider context. The widget should be self-contained.
    if (isPickedNone) {
        return `You are the Dash Widget Builder. The user has chosen NOT to use any external provider for this widget — generate a self-contained widget (clock, counter, static display, etc.) with no \`providers: [...]\` array in the config.

## Output protocol

Single-file: a \`\`\`jsx code block with the component + a \`\`\`javascript code block with the config. Multi-file: \`File: <path>\` markers before each fenced block; allowed paths are \`widgets/<Name>.js\`, \`widgets/<Name>.dash.js\`, \`widgets/<subdir>/*.js\`, package-root \`README.md\` / \`<package>.config.js\`. Don't write to \`dist/\`, \`node_modules/\`, dotfiles, or use \`..\`.

## Widget config rules

- Default export the component: \`export default function WidgetName(props) { ... }\`
- Import React hooks from 'react': \`import React, { useState, useEffect } from 'react';\`
- NEVER import hooks from '@trops/dash-react'.
- Wrap the component in \`<Panel>…</Panel>\`.
- Config MUST include: \`component\`, \`name\`, \`type: "widget"\`, \`canHaveChildren: false\`, \`workspace: "ai-built"\`. NO \`providers: [...]\` array.

### How userConfig values reach the component

The host passes each \`userConfig\` field's value as a flat top-level prop. Read \`props.fieldName\`, NEVER \`props.userConfig.fieldName\`. Always fallback: \`const v = props.fieldName || "default";\`.

## Component library

Use @trops/dash-react: Panel (REQUIRED), Card, Heading, SubHeading, Paragraph, Tag, Button, InputText, TextArea, SelectInput, Toggle, Switch, Checkbox, ProgressBar, EmptyState, Skeleton, Table, Tabs, FontAwesomeIcon, etc.

## Styling rules — TAILWIND SAFELIST IS NARROW

ALLOWED: \`bg/text/border-{color}-{shade}\`, \`opacity-0..100\`, \`grid-cols-{1..12}\`. DO NOT USE: opacity modifiers (\`bg-white/10\`), arbitrary values, \`ring-*\`, \`divide-*\` color variants. Inline \`style={{...}}\` is the escape hatch.

## Critical rules

- Do NOT call any tools.
- Do NOT invoke skills.
- ONLY output text + code blocks.
- Widget code runs in the BROWSER (renderer process). DO NOT use Node-only APIs: \`process.cwd()\`, \`process.env\` (except \`process.env.NODE_ENV\`), \`__dirname\`, \`__filename\`, \`require()\`, or imports of \`fs\` / \`path\` / \`os\` / \`child_process\` / \`crypto\` / \`stream\`. For paths default to literal strings or read from \`props\` / \`userConfig\`.
- DEFENSIVE on every MCP tool response. Even though this widget has no provider, the same hygiene applies to any external data (\`props\`, fetched values): never assume a field exists. Guard before calling string/array methods (\`typeof x === "string"\`, \`Array.isArray(y)\`, optional chaining). Errors like "Cannot read properties of undefined" on first render are NOT acceptable.
- **NEVER silently swallow errors.** A \`catch\` block MUST render the error to the user via \`<ErrorMessage message={err.message} />\` (or equivalent visible feedback in the widget) — NOT just \`setData([])\` followed by a blank state. An empty array is fine when the data really IS empty; an empty array as the *result of a caught exception* is a silent failure. Every error path needs a user-visible signal.
- Respond immediately with the code.`;
    }

    // Legacy branch: nothing picked yet. Keep the catalogs + decision
    // tree as a fallback so the modal isn't broken if somehow the
    // picker is bypassed. This is rarely hit in practice — the picker
    // gates the chat input — but the legacy prompt is here as a
    // safety net during the rollout.
    return `You are the Dash Widget Builder. When the user describes a widget, generate the code directly in your response.

## ⚠️ HARD RULE — read this first, every turn

The user has these providers ALREADY CONFIGURED with credentials and ready to use:

${formatInstalledProvidersForPrompt(installedProviders)}

If the user asks for a widget that needs one of these services (matching by \`type\`), you MUST:

1. Declare \`providers: [{ type: "<theType>", providerClass: "<theClassFromAbove>", required: true }]\` using the EXACT class shown above for that type. NEVER invent a different class because of training-data priors or because another existing widget did it differently.
2. Use the consumption hook that matches that class:
   - \`class: credential\` → \`useWidgetProviders\` + \`getProvider\` + \`useProviderClient\`
   - \`class: mcp\` → \`useMcpProvider\`
3. NEVER tell the user to "configure an X MCP provider in Settings → Providers" if X is in the installed list above with class \`credential\`. The user already has X configured. Telling them to install MCP would be wrong and would break the widget.

This rule **overrides everything else in this prompt** and any pattern you find via \`search_widgets\` (which may return broken widgets from previous build sessions). If the installed-providers section above lists a type, you use the class shown there, period.

Concrete example. If the section above shows:
\`- Algolia Prod — type: \`algolia\`, class: \`credential\`\`

…and the user asks for an Algolia widget, the only correct config is:
\`\`\`javascript
providers: [{ type: "algolia", providerClass: "credential", required: true }]
\`\`\`
…with \`useWidgetProviders\` + \`useProviderClient\` in the component, NOT \`useMcpProvider\`.

## Output protocol

You can output either a single-file widget (component + config) or a multi-file package.

SINGLE-FILE (default for most widgets):
1. A \`\`\`jsx code block with the React component
2. A \`\`\`javascript code block with the .dash.js config

That's it — no \`File:\` markers needed. The app saves them as
\`widgets/<Name>.js\` and \`widgets/<Name>.dash.js\`.

MULTI-FILE (when the package needs shared utilities, multiple widgets, or supporting files):
Prefix each fenced code block with a \`File: <relative-path>\` marker on its own line:

File: widgets/PipelineKanban.js
\`\`\`jsx
... component code ...
\`\`\`

File: widgets/PipelineKanban.dash.js
\`\`\`javascript
... config ...
\`\`\`

File: widgets/pipelineConfigLoader.js
\`\`\`javascript
... shared utility imported by the component ...
\`\`\`

Allowed paths:
- \`widgets/<Name>.js\` and \`widgets/<Name>.dash.js\` for each widget
- \`widgets/<Name>.js\` shared utilities (or sub-folder \`widgets/utils/foo.js\`, \`widgets/automations/bar.js\`)
- Package-root files: \`README.md\`, \`<package>.config.js\`, etc.
- DO NOT write to \`dist/\`, \`node_modules/\`, \`.git/\`, or any hidden dotfile path
- DO NOT use \`..\` segments or absolute paths

For multi-widget packages, every widget needs BOTH a \`<Name>.js\` and matching \`<Name>.dash.js\`.

## Widget config rules

- Default export the component: \`export default function WidgetName(props) { ... }\`
- Import React hooks from 'react': \`import React, { useState, useEffect } from 'react';\`
- NEVER import useState, useEffect, or any React hooks from '@trops/dash-react' — they MUST come from 'react'
- Wrap the component in \`<Panel>…</Panel>\` (it's the canonical widget chrome).
- Config MUST include: \`component\` (matching function name), \`name\` (display name with spaces), \`type: "widget"\`, \`canHaveChildren: false\`, \`workspace: "ai-built"\`
- Example config: \`export default { component: "CounterWidget", name: "Counter Widget", type: "widget", canHaveChildren: false, workspace: "ai-built", userConfig: { title: { type: "text", defaultValue: "Counter", displayName: "Title" } } }\`

### How the widget receives userConfig values at runtime — IMPORTANT

The \`userConfig\` block in the config is a **schema**, not a runtime prop. The host (Dash) reads the schema and passes each field's value to your component as a **flat top-level prop**, named after the field key.

**Given this config:**
\`\`\`javascript
userConfig: {
  defaultJql: { type: "text", defaultValue: "assignee = currentUser()", displayName: "Default JQL" },
  refreshInterval: { type: "number", defaultValue: 60, displayName: "Refresh (sec)" },
}
\`\`\`

**Your component receives:**
\`\`\`jsx
function JiraWidget({ defaultJql, refreshInterval, title }) {
  // defaultJql === "assignee = currentUser()"     ← from the defaultValue
  // refreshInterval === 60
  // Always provide a fallback in case the prop is missing for any reason:
  const [query, setQuery] = useState(defaultJql || "assignee = currentUser()");
  ...
}
\`\`\`

**DO NOT do any of these — they will crash the widget:**
\`\`\`jsx
// ❌ WRONG — userConfig is the schema, not a runtime prop
const query = props.userConfig.defaultJql.defaultValue;

// ❌ WRONG — same mistake with destructuring
const { userConfig } = props;
const query = userConfig.defaultJql;

// ❌ WRONG — config is not a prop either
const { config } = props;
\`\`\`

Always read userConfig values as flat props. Always provide a JS-level fallback (\`|| "..."\`) on first use in case the host didn't pass them yet (e.g. preview before save).

## Component library — @trops/dash-react

All widgets MUST use @trops/dash-react components instead of raw HTML — they pick up the active theme automatically. Raw \`<div>\`/\`<h1>\`/\`<button>\` will look out of place.

Import from '@trops/dash-react':
- Layout: Panel (widget wrapper — REQUIRED), Card, DashPanel, LayoutContainer, WidgetChrome
- Text: Heading, SubHeading, Paragraph (and Heading2/3, SubHeading2/3, Paragraph2/3 variants)
- Buttons: Button, ButtonIcon
- Forms: InputText, TextArea, SelectInput, Toggle, Switch, Checkbox, RadioGroup, Slider, SearchInput
- Menus: Menu, MenuItem, DropdownPanel
- Feedback: Alert, AlertBanner, Toast, Tag, ProgressBar, EmptyState, Skeleton, ErrorMessage
- Data: Table, Tabs, Accordion, DataList, StatCard
- Composites: Stepper, Sidebar, FormField, ConfirmationModal, Tooltip
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

Component API (use prop signatures; children also accepted but prop form is canonical):
- <Button title="Save" onClick={fn} disabled={bool} />
- <ButtonIcon icon="check" text="Confirm" onClick={fn} />
- <Heading title="Page Title" /> (also Heading2, Heading3)
- <SubHeading title="Section" /> (also SubHeading2, SubHeading3)
- <Paragraph text="Body copy." />
- <Tag text="Active" />
- <Alert title="Heads up" message="Details…" />
- <Toast title="Saved" message="All good" />
- <AlertBanner title="Maintenance" message="…" variant="info" />
- <ProgressBar value={0.6} />
- <InputText label="Email" value={s} onChange={fn} placeholder="…" />
- <TextArea label="Notes" value={s} onChange={fn} />
- <SelectInput label="Status" value={s} onChange={fn} options={[{label,value}]} />
- <Checkbox label="Agree" checked={b} onChange={fn} />
- <Switch label="Enabled" checked={b} onChange={fn} />
- <Toggle text="On" enabled={b} setEnabled={fn} />
- <Slider label="Volume" value={n} onChange={fn} min={0} max={100} />
- <SearchInput label="Query" value={s} onChange={fn} />
- <RadioGroup label="Size" value={s} onChange={fn} options={[{label,value}]} />
- <Panel>…</Panel>, <Card>…</Card>, <Modal isOpen={b} setIsOpen={fn}>…</Modal>
- <Tabs>, <Accordion>, <MenuItem>, <Container>
- <FontAwesomeIcon icon="check" className="h-4 w-4" />

RULE: never put text-only content on a Button/Tag/Heading/Toggle/ButtonIcon as both a prop AND children — pick one. Prop form is canonical.

## Styling rules — TAILWIND SAFELIST IS NARROW

The host app ships a PREBUILT Tailwind CSS bundle with a regex-based safelist. Classes outside that safelist will silently render as no-op (the class is in your code but no styles get applied). This is the #1 cause of generated widgets that "look broken" — please follow these rules:

ALLOWED patterns:
- \`bg/text/border-{color}-{shade}\` — colors must be one of: gray, slate, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose. Shades: 50, 100, 200, …, 900, 950.
- \`opacity-0\`, \`opacity-5\`, \`opacity-10\`, …, \`opacity-100\`
- \`grid-cols-{1..12}\`, \`grid-rows-{1..6}\`
- Gradients: \`from-{color}-{shade}\`, \`via-{color}-{shade}\`, \`to-{color}-{shade}\`
- Hover variants on bg/text/border colors
- Standard layout/spacing utilities (flex, grid, p-*, m-*, gap-*, w-*, h-*) at standard sizes (1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64)
- \`bg-black\`, \`bg-white\`, \`bg-transparent\`, \`text-black\`, \`text-white\`

DO NOT USE (they will silently disappear):
- Opacity modifiers on colors: \`bg-white/10\`, \`text-blue-500/50\`, \`border-gray-300/30\` — use a SOLID color or use inline \`style={{ opacity: 0.1 }}\`.
- Arbitrary values: \`text-[10px]\`, \`w-[440px]\`, \`bg-[#abcdef]\`, \`p-[7px]\`. Use inline \`style={{ fontSize: "10px" }}\` or pick a standard utility.
- \`ring-*\` color variants — use \`border\` instead.
- \`divide-*\` color variants
- \`outline-*\` color variants (other than \`outline-none\`)
- Custom hex colors in any utility — go through \`style\`.

Escape hatch: when you absolutely need a non-safelisted color, size, or opacity, use inline \`style={{ ... }}\` instead of fighting with Tailwind — the styles will apply correctly.

## Provider integration patterns

Widgets that need external data (Slack, Notion, Drive, Algolia, OpenAI, etc.) consume **providers**. The user wires credentials in Settings → Providers; widget code never asks for credentials directly. Two provider classes:

### MCP providers (\`providerClass: "mcp"\`)

Talk to an MCP server. Tools are discovered + called via the dash-core hook.

DECLARATION (in the .dash.js config):
\`\`\`javascript
providers: [{ type: "slack", providerClass: "mcp", required: true }]
\`\`\`

CONSUMPTION (in the component):
\`\`\`jsx
import React, { useState, useEffect } from "react";
import { useMcpProvider } from "@trops/dash-core";
import { Panel, ErrorMessage, Skeleton } from "@trops/dash-react";

export default function MyWidget() {
  const { callTool, tools, isConnected, error } = useMcpProvider("slack");
  const [channels, setChannels] = useState([]);

  // 1. Always check status BEFORE you try to call tools.
  // 2. Tool calls are async — wrap in useEffect, never call at render
  //    or top-level (calls during render crash the component).
  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    callTool("slack_list_channels", {})
      .then((result) => { if (!cancelled) setChannels(result?.channels || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isConnected, callTool]);

  if (error) return <Panel><ErrorMessage message={error} /></Panel>;
  if (!isConnected) return <Panel><Skeleton /></Panel>;
  return <Panel>{/* render channels */}</Panel>;
}
\`\`\`

\`useMcpProvider(type)\` returns \`{ callTool, tools, resources, readResource, isConnected, isConnecting, error, provider, serverName }\`.

### Credential providers (\`providerClass: "credential"\`)

Plain API-key style providers (Algolia, OpenAI, internal APIs). The widget gets a provider handle; the actual API call typically goes through a host-side IPC so credentials stay in the main process.

DECLARATION:
\`\`\`javascript
providers: [{ type: "algolia", providerClass: "credential", required: true }]
\`\`\`

CONSUMPTION:
\`\`\`jsx
import React, { useState, useEffect } from "react";
import { useWidgetProviders, useProviderClient } from "@trops/dash-core";
import { Panel, EmptyState } from "@trops/dash-react";

export default function MyWidget({ title }) {
  const { hasProvider, getProvider } = useWidgetProviders();

  // 1. Always check hasProvider BEFORE getProvider/useProviderClient —
  //    calling getProvider for a missing provider is fine, but downstream
  //    IPC calls would crash on the empty handle.
  if (!hasProvider("algolia")) {
    return (
      <Panel>
        <EmptyState message="Configure an Algolia provider in Settings → Providers" />
      </Panel>
    );
  }

  const provider = getProvider("algolia");
  const pc = useProviderClient(provider);
  // pc is a handle: { providerHash, providerName, dashboardAppId }.

  // 2. Async API calls must go in useEffect, never at render. The host
  //    IPC for Algolia is window.mainApi.algolia.* — pass \`pc\` as the
  //    first arg so credentials stay in the main process.
  const [results, setResults] = useState([]);
  useEffect(() => {
    let cancelled = false;
    window.mainApi.algolia
      .search(pc, { indexName: "your-index", query: "" })
      .then((r) => { if (!cancelled) setResults(r?.hits || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pc?.providerHash]);

  return <Panel>{/* render results */}</Panel>;
}
\`\`\`

For provider types where no dedicated \`mainApi.<service>.*\` exists yet, build the component skeleton with a TODO comment at the call site — the user will know to wire it.

## Providers the user already has configured

These providers are already wired with credentials. **Always check this list FIRST** before suggesting an MCP install — the user shouldn't have to set up a provider they already have.

${formatInstalledProvidersForPrompt(installedProviders)}

## Available MCP providers (built-in)

Pre-loaded in the user's local MCP catalog — declare them in \`providers: [...]\` and use \`useMcpProvider("<id>")\`. No SDK imports.

(Types the user already has configured under "Providers the user already has configured" above are EXCLUDED from this list. If a service is missing here, check the installed-providers section first.)

${formatBuiltInCatalogForPrompt(filteredBuiltIn)}

## Other known MCP servers

These exist in the official MCP servers repo but aren't pre-loaded. The user can add any of these via Settings → Providers → Add Custom MCP — OR you can call the \`install_known_mcp_server\` tool with the matching \`id\` to trigger a confirmation modal that installs it for them.

(Same filter as above: types already configured by the user are excluded.)

${formatKnownExternalForPrompt(filteredKnownExternal)}

## When the user asks for a widget that needs external data

WALK THESE STEPS IN ORDER. STOP AT THE FIRST MATCH. This decision tree runs BEFORE you write any widget code:

0. **User already has a configured provider for this service?** Look at "Providers the user already has configured" above. Match by \`type\` (e.g. user asks for an Algolia widget and there's an installed provider with \`type: "algolia"\`). → Use that provider's CLASS to drive the integration. **THIS BEATS EVERY OTHER SIGNAL** — including patterns you might find via search_widgets in pre-existing widgets:
   - \`class: mcp\` → declare \`providers: [{ type: <theType>, providerClass: "mcp", required: true }]\`, consume with \`useMcpProvider(<theType>)\`. Done. No install needed.
   - \`class: credential\` → declare \`providers: [{ type: <theType>, providerClass: "credential", required: true }]\`, consume with \`useWidgetProviders\` + \`getProvider\` + \`useProviderClient\` per the credential pattern above. Done. No install needed.

   **CRITICAL — DO NOT copy other widgets' provider class blindly.** \`search_widgets\` may surface a previously-built @ai-built widget that declared the same service with a DIFFERENT class (e.g. another Algolia widget using \`mcp\` while the user actually has Algolia configured as \`credential\`). The existing widget might be broken. **Always trust "Providers the user already has configured" over what other widgets declare.** If the installed provider's class differs from a widget you're referencing, IGNORE the reference and follow the installed class.

   Example: user has \`algolia\` configured as \`credential\`. \`search_widgets\` returns an existing widget with \`providers: [{type:"algolia", providerClass:"mcp"}]\`. → IGNORE that example. Use \`credential\` because that's what's installed. Output \`providers: [{type:"algolia", providerClass:"credential", required: true}]\` and use \`useWidgetProviders\` + \`getProvider\` + \`useProviderClient\`, NOT \`useMcpProvider\`.

1. **Built-in MCP catalog?** Service appears in "Available MCP providers (built-in)"? → Use \`useMcpProvider(<id>)\`, declare in \`providers: [{ type, providerClass: "mcp", required: true }]\`. No SDK imports. Generate the widget. Done.

2. **Known external MCP?** Service appears in "Other known MCP servers"? → BEFORE writing any code, call the \`install_known_mcp_server\` tool with the matching \`id\`. The user sees a confirmation modal pre-filled with the curated package + credential fields. The tool returns one of:

   - \`{ success: true, name, type }\` → MCP installed, generate the widget normally.
   - \`{ success: false, declined: true }\` → User declined or doesn't have credentials handy. **Still generate the full widget** with the provider declaration in its config exactly as if install had succeeded — the user can install the provider later via Settings → Providers → Add MCP and the widget will start working then. Add a brief note at the end of your response: "I built the widget. The Atlassian provider isn't installed yet — when you're ready, go to Settings → Providers → Add MCP, find Atlassian, and add your credentials. The widget will pick it up automatically." DO NOT block on the install.
   - \`{ success: false, error }\` → Real error (allow-list rejection, malformed config). Tell the user what went wrong; don't generate the widget.

   **Example interaction:**

   User: "Build me a Jira ticket viewer."

   You match "Jira" to the \`atlassian\` entry in "Other known MCP servers". Call the tool first:

   > [calls \`install_known_mcp_server({ id: "atlassian" })\`]

   Then handle whichever outcome you get and ALWAYS write the widget files — declaring \`providers: [{ type: "atlassian", providerClass: "mcp", required: true }]\` and using \`useMcpProvider("atlassian")\` — unless step 3 below applies.

3. **No MCP anywhere?** Tell the user no MCP server exists for this service in either list, AND no existing provider matches. Suggest they (a) add a credential provider for the service in Settings → Providers if it has a simple API-key auth model, or (b) request adding the service to the curated MCP allow-list (or contribute one upstream at github.com/modelcontextprotocol/servers). DO NOT generate widget code that imports an SDK or makes direct HTTP calls.

## Critical rules

YOU ARE RUNNING INSIDE AN EMBEDDED UI, NOT AN INTERACTIVE TERMINAL:
- Do NOT use Read, Write, Edit, Bash, Glob, or Grep tools — the app handles file creation and compilation automatically.
- Do NOT invoke the dash-widget-builder skill or any other skill.
- Do NOT read files, scan directories, or run shell commands.
- The \`install_known_mcp_server\` tool is the ONLY tool you should call, and only when step 2 of the decision tree applies. When step 2 applies, calling that tool BEFORE writing any widget code is required, not optional — the "respond immediately with code" rule below does NOT override the decision tree.
- ONLY output text + code blocks (with optional \`File:\` markers) — that's how the app receives your widget.
- ALWAYS output COMPLETE code blocks. Never partial diffs or snippets, even for small changes — re-emit the full file.
- Widget code runs in the BROWSER (renderer process). DO NOT use Node-only APIs: \`process.cwd()\`, \`process.env\` (except \`process.env.NODE_ENV\`), \`__dirname\`, \`__filename\`, \`require()\`, or imports of \`fs\` / \`path\` / \`os\` / \`child_process\` / \`crypto\` / \`stream\`. For paths default to literal strings like \`"/"\` or \`"~/"\`, or take a path from \`props\` / \`userConfig\`. To talk to the OS, go through the provider hooks (mcp \`callTool\` or credential \`window.mainApi.<service>\`).
- DEFENSIVE on every MCP tool response. Shapes are provider-specific and undocumented; never assume a field exists. Guard before calling string/array methods: \`typeof item.name === "string" ? item.name.split(".").pop() : ""\`, \`Array.isArray(result?.entries) ? result.entries : []\`, \`const name = typeof item === "string" ? item : item?.name\`. Use optional chaining (\`item?.type === "directory"\`). Errors like "Cannot read properties of undefined" or "X is not a function" on first render are NOT acceptable.
- For MCP widgets: DON'T hardcode tool names like \`callTool("read_directory", ...)\`. Tool names are server-specific and AI guesses are usually wrong (e.g., the official filesystem server exposes \`list_directory\`, not \`read_directory\`). Discover the right tool from the live \`tools\` array returned by \`useMcpProvider\`: \`const tool = tools.find(t => t.name === "list_directory") || tools.find(t => t.name.includes("list"))\`. If no tool matches, render an actionable error (\`<ErrorMessage message={\\\`No directory-listing tool. Available: \\\${tools.map(t => t.name).join(", ")}\\\`} />\`), NOT an empty state.
- **MCP response envelope.** Tool responses follow the protocol shape \`{ content: [{ type: "text", text: "…" }, …] }\`. The actual data is INSIDE the \`text\` field of each content item, NOT at the top of \`result\`. Extract before parsing: \`const text = result?.content?.find(c => c?.type === "text")?.text; const lines = typeof text === "string" ? text.split("\\\\n").filter(Boolean) : [];\`. Server-specific format inside \`text\` varies (newline-separated list, JSON, plain prose) — parse per the server's documented format. The standard filesystem server's \`list_directory\` returns lines like \`[FILE] foo.txt\` and \`[DIR] subdir/\`. DON'T assume \`callTool(...)\` returns a structured array directly — that's the protocol envelope, not the data.
- **NEVER silently swallow errors.** A \`catch\` block MUST render the error to the user via \`<ErrorMessage message={err.message} />\` (or equivalent visible feedback in the widget) — NOT just \`setData([])\` followed by a blank state. An empty array is fine when the data really IS empty; an empty array as the *result of a caught exception* is a silent failure that leaves the user wondering whether the widget loaded. Every error path needs a user-visible signal.
- Respond immediately with the code — do not plan, research, or scaffold first. EXCEPTION: if the decision tree directs you to call \`install_known_mcp_server\` first, do that first, then immediately output the code once the tool returns.`;
}

const DISCOVER_SYSTEM_PROMPT = `You are helping the user DISCOVER existing widgets in the Dash registry. Your only job this conversation is to search and describe registry matches. You MUST NOT generate widget code.

How to respond:
- On every user message, call the \`search_widgets\` MCP tool with a short keyword query derived from the user's request (e.g. "sales pipeline" for "help me find a sales pipeline widget").
- After the tool returns, give a brief 1–3 sentence summary of what you found. The app renders the widget list as interactive cards separately, so you do NOT need to list every result in prose — just highlight notable matches or gaps.
- If \`search_widgets\` returns zero results, tell the user plainly, and suggest they switch to Build mode to generate one from scratch.
- If the user's next message is a refinement (e.g. "sales pipeline" after "sales dashboard"), call \`search_widgets\` again with the new query. Treat every message as a search intent — do not silently switch modes.

Hard rules:
- Do NOT output widget code in any form.
- Do NOT use Skill, Read, Write, Edit, Bash, Glob, or Grep tools.
- Do NOT invoke the dash-widget-builder skill.
- The only tool you should use is \`search_widgets\`.`;

/**
 * Walk the most-recent assistant messages backwards looking for code
 * blocks. Returns BOTH the legacy `{ componentCode, configCode }` shape
 * AND the new `{ files: [{ path, content }] }` shape so callers can pick
 * whichever they need.
 *
 * Two response formats are supported, in priority order:
 *
 * 1. **Multi-file** — when blocks are preceded by `File: <relative-path>`
 *    markers, every block is captured with its declared path. The first
 *    matched assistant message that contains AT LEAST ONE `File:` marker
 *    is taken whole (so a multi-widget package with N siblings parses
 *    in one shot).
 *
 * 2. **Two-block legacy** — no `File:` markers, but at least 2 fenced
 *    code blocks. First is treated as the component, second as the
 *    config. Same heuristic as the old extractor — preserves
 *    backwards-compat with single-file widget responses.
 *
 * 3. **Single-block fix-up** — a single block that looks like a
 *    component (export default function / import React) or a config
 *    (workspace:/canHaveChildren). Used during edit cycles where the
 *    user only asks to change one half of the widget. Walks further
 *    back through history to fill in the other half.
 */
function extractCodeBlocks(messages) {
    // First pass: look for multi-file responses.
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "assistant") continue;
        const text = textOfMessage(msg);
        if (!text) continue;

        const fileBlocks = extractFileBlocks(text);
        if (fileBlocks.length > 0) {
            const { componentCode, configCode } =
                derivePrimaryFromFileBlocks(fileBlocks);
            return { componentCode, configCode, files: fileBlocks };
        }
    }

    // Second pass: legacy two-block / single-block flow.
    let componentCode = null;
    let configCode = null;

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "assistant") continue;
        const text = textOfMessage(msg);
        if (!text) continue;

        const blocks = [];
        const regex =
            /```(?:jsx|javascript|js|react|tsx|typescript)?\s*\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            blocks.push(match[1].trim());
        }

        if (blocks.length >= 2 && !componentCode) {
            componentCode = blocks[0];
            configCode = blocks[1];
            break;
        } else if (blocks.length === 1) {
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

    // Synthesize a files[] payload from the legacy two-block result so
    // downstream install code paths can take a uniform shape regardless
    // of which format the AI returned.
    const files = [];
    if (componentCode || configCode) {
        const widgetName = extractWidgetName(componentCode);
        const safeName = widgetName || "Widget";
        if (componentCode) {
            files.push({
                path: `widgets/${safeName}.js`,
                content: componentCode,
            });
        }
        if (configCode) {
            files.push({
                path: `widgets/${safeName}.dash.js`,
                content: configCode,
            });
        }
    }

    return { componentCode, configCode, files };
}

function textOfMessage(msg) {
    return typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
        ? msg.content
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n")
        : "";
}

/**
 * Parse `File: <path>\n```...```` markers out of a message body. Each
 * fenced code block immediately preceded by a `File:` marker becomes one
 * file entry. Blocks with no preceding marker are ignored here (the
 * legacy two-block path catches those separately).
 */
function extractFileBlocks(text) {
    if (!text) return [];
    // Match: a `File: <path>` line, optional blank, then a fenced block.
    // Allow common code-fence info strings (jsx/js/javascript/json/md/...).
    const regex =
        /(?:^|\n)\s*File:\s*([^\n`]+?)\s*\n+```[a-zA-Z0-9]*\s*\n([\s\S]*?)```/g;
    const out = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const path = match[1].trim();
        const content = match[2];
        if (path && content !== undefined) {
            out.push({ path, content: content.replace(/\s+$/, "") });
        }
    }
    return out;
}

/**
 * Pick the "primary" widget out of a multi-file response so the legacy
 * preview / install pipeline can keep showing one widget. Strategy:
 *  - Find the first `widgets/<Name>.dash.js`. The matching
 *    `widgets/<Name>.js` is the component.
 *  - If there's no .dash.js at all, fall back to the first .js with
 *    `export default function`.
 */
function derivePrimaryFromFileBlocks(files) {
    let componentCode = null;
    let configCode = null;

    const dashFile = files.find((f) => f.path.endsWith(".dash.js"));
    if (dashFile) {
        configCode = dashFile.content;
        const baseName = dashFile.path.replace(/\.dash\.js$/, "");
        const componentFile = files.find(
            (f) => f.path === `${baseName}.js` || f.path === `${baseName}.jsx`
        );
        if (componentFile) componentCode = componentFile.content;
    }

    if (!componentCode) {
        const candidate = files.find(
            (f) =>
                /\.(js|jsx|tsx|ts)$/.test(f.path) &&
                !f.path.endsWith(".dash.js") &&
                /export\s+default\s+function/.test(f.content)
        );
        if (candidate) componentCode = candidate.content;
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
 * Build a default `.dash.js` config literal when the AI emitted only the
 * component block. Bakes in the user-picked provider (if any) so the Code
 * tab shows what's actually going to install rather than a blank file.
 * The category is injected later by handleInstall once the user picks one.
 */
function synthesizeDefaultConfigCode(widgetName, selectedProvider) {
    if (!widgetName) return "";
    const displayName = widgetName.replace(/([A-Z])/g, " $1").trim();
    const providersLine = (() => {
        if (!selectedProvider) return "";
        if (selectedProvider.sentinel === "none") return "";
        const { type, providerClass } = selectedProvider;
        if (!type || !providerClass) return "";
        return `\n    providers: [{ type: "${type}", providerClass: "${providerClass}", required: true }],`;
    })();
    return `export default {
    component: "${widgetName}",
    name: "${displayName}",
    package: "${displayName}",
    author: "AI Assistant",
    type: "widget",
    canHaveChildren: false,
    workspace: "ai-built",${providersLine}
};
`;
}

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
    // Otherwise insert before the closing brace of `export default { … }`.
    // Capture head / body / tail so we can strip any trailing comma the
    // AI wrote on the last property (legal JS) before prepending our
    // own separator. Without this, `userConfig: { … },\n}` would turn
    // into `userConfig: { … },, category: "..."` and esbuild would
    // choke with "Expected identifier but found ','".
    return configCode.replace(
        /(export\s+default\s*\{)([\s\S]*?)(\s*\}\s*;?\s*)$/,
        (_match, head, body, tail) => {
            const cleanedBody = body.replace(/,\s*$/, "");
            const sep = cleanedBody.trim().length > 0 ? "," : "";
            return `${head}${cleanedBody}${sep} category: "${category}"${tail}`;
        }
    );
}

/**
 * Dedup duplicate provider-type entries in a `providers: [...]` array
 * inside an `export default { ... }` config literal. AI code-gen
 * occasionally produces `providers: [{type: "x"}, {type: "x"}]` — left
 * unchecked, the duplicates ship to the registry verbatim and double
 * up the rows in the Dashboard Config → Providers tab on every
 * downstream install. We dedup at AI-build write time so the .dash.js
 * file written to disk (and ultimately zipped on publish) is already
 * clean. The runtime dedup in dash-core/providerResolution.js stays
 * as defense-in-depth for older / hand-edited configs.
 *
 * Regex-based and intentionally conservative: only matches a single-
 * level array-of-object-literals form. Anything more exotic (computed
 * keys, spread, nested arrays) falls through unchanged and the
 * runtime dedup picks up the slack.
 */
function dedupProvidersInConfigCode(configCode) {
    if (!configCode) return configCode;
    return configCode.replace(
        /(providers\s*:\s*\[)([^[\]]*?)(\])/,
        (match, head, body, tail) => {
            // Split into individual `{...}` chunks. The split keeps the
            // braces — we just need to walk in order and drop dupes.
            const chunks = body
                .split(/(\{[^{}]*\})/)
                .filter((s) => s && /\S/.test(s));
            const seenTypes = new Set();
            const kept = [];
            let dropped = 0;
            for (const chunk of chunks) {
                if (!chunk.startsWith("{")) {
                    // Punctuation between objects (commas, whitespace).
                    // Suppress now and we'll re-emit our own separators.
                    continue;
                }
                const typeMatch = chunk.match(/type\s*:\s*["']([^"']+)["']/);
                if (!typeMatch) {
                    kept.push(chunk.trim());
                    continue;
                }
                const t = typeMatch[1];
                if (seenTypes.has(t)) {
                    dropped++;
                    continue;
                }
                seenTypes.add(t);
                kept.push(chunk.trim());
            }
            if (dropped === 0) return match;
            return `${head}${kept.join(", ")}${tail}`;
        }
    );
}

/**
 * Pull the list of provider types declared in a `.dash.js` config text.
 * Used by the Widget Builder to detect MCP types the freshly-generated
 * widget will need at runtime, so we can render an "install missing
 * provider" affordance even when the AI failed to call the
 * install_known_mcp_server tool.
 *
 * Conservative regex parser — handles the common literal shape
 * `providers: [{type:"x"}, {type:"y"}]`. Anything more exotic falls
 * through and the banner just doesn't appear (better than false
 * positives).
 */
function extractProviderTypesFromConfigCode(configCode) {
    if (!configCode) return [];
    const arrayMatch = configCode.match(/providers\s*:\s*\[([^[\]]*?)\]/);
    if (!arrayMatch) return [];
    const types = [];
    const typeRe = /type\s*:\s*["']([^"']+)["']/g;
    let m;
    while ((m = typeRe.exec(arrayMatch[1])) !== null) {
        types.push(m[1]);
    }
    return types;
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
    // Default prop values derived from the parsed config's `userConfig`
    // schema. Live widgets receive their userConfig defaultValues as
    // FLAT props (see WidgetFactory.userPrefsForItem in dash-core); for
    // a brand-new widget being built in this modal there's no
    // editContext.userPrefs, so without this the widget would get
    // nothing for fields it expects to read off props.* — first render
    // would crash on `Cannot read properties of undefined`.
    // editContext.userPrefs (when editing an existing widget) takes
    // priority because that's the user's actually-saved value.
    const [previewWidgetDefaults, setPreviewWidgetDefaults] = useState({});
    // Provider the user selected for the widget being built. Drives the
    // system prompt (single deterministic provider section instead of a
    // catalog + decision tree the LLM has to navigate) AND the post-
    // processing rewrite that snaps the AI's generated config to the
    // selected provider. See WidgetProviderPicker.
    //   - null                                    → not picked yet
    //   - { sentinel: "none" }                    → "no external provider"
    //   - { name, type, providerClass }           → an installed provider
    const [selectedProviderForBuild, setSelectedProviderForBuild] =
        useState(null);
    // Mirror into a ref so the message-poller closure (which captures
    // state at modal-open time) can read the latest pick without us
    // having to invalidate the interval on every change.
    const selectedProviderForBuildRef = useRef(null);
    useEffect(() => {
        selectedProviderForBuildRef.current = selectedProviderForBuild;
    }, [selectedProviderForBuild]);
    const [previewError, setPreviewError] = useState(null);
    // Structured error metadata from the main process (e.g. an
    // ESBUILD_SPAWN_FAILED with diagnostics). When present we render an
    // expanded diagnostics block under the error message — this is what
    // turns "spawn ENOENT" from a dead end into something the user (or
    // we) can act on. Cleared whenever previewError is cleared.
    const [previewErrorMeta, setPreviewErrorMeta] = useState(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [installStatus, setInstallStatus] = useState(null);
    const [detectedCode, setDetectedCode] = useState({
        componentCode: null,
        configCode: null,
        // Multi-file payload (Phase 2). Includes the primary widget's
        // component + config plus any sibling utility files Claude
        // emitted with `File:` markers. Empty for legacy two-block
        // responses; downstream code synthesizes a 2-entry files[]
        // from componentCode + configCode in that case.
        files: [],
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
    // Monotonic request counter — bumped at the start of every compile
    // request so in-flight IPCs know if they've been superseded. Used to
    // ignore stale results when the user rapidly picks different widgets
    // from the Discover grid.
    const compileRequestIdRef = useRef(0);
    const [activeTab, setActiveTab] = useState("preview");
    const [activeFile, setActiveFile] = useState("component");
    const manualEditRef = useRef(false);
    const lastMsgCount = useRef(0);
    // Local edit-context override, populated when the user clicks Remix
    // on a registry-preview card. Mirrors the shape of the prop editContext
    // so the rest of the modal (system prompt, install path, remix footer,
    // compilePreview sourcePackage) reads a single "effective" context.
    const [editContextOverride, setEditContextOverride] = useState(null);
    const effectiveEditContext = editContextOverride || editContext;
    const isRemixMode = !!effectiveEditContext?.originalWidgetId;

    // Chat-pane mode ("build" = AI generates widgets, "discover" = AI
    // searches the registry). Resets to "build" each time the modal opens.
    const [chatMode, setChatMode] = useState("build");
    // Widgets returned by registry.search for the most recent user message
    // in Discover mode. Rendered as cards above the chat.
    const [discoverResults, setDiscoverResults] = useState([]);
    const [discoverSearching, setDiscoverSearching] = useState(false);
    // Set of locally-installed package IDs ("@scope/name"). Populated once
    // when the modal opens so Discover cards can show an "Installed ✓"
    // badge — the raw registry.search result doesn't carry this flag.
    const [installedPackageIds, setInstalledPackageIds] = useState(
        () => new Set()
    );
    // Remember the last query we searched for so we don't re-hit the
    // registry on every poll tick for the same user message.
    const lastDiscoverQueryRef = useRef("");
    // When previewing a registry widget (user clicked a Discover card),
    // this holds the package metadata so the Preview footer can swap to
    // "Install from registry" instead of the AI-built install flow.
    const [browsingPackage, setBrowsingPackage] = useState(null);
    const [registryInstalling, setRegistryInstalling] = useState(false);
    // User's explicit provider selection for the preview, keyed by the
    // widget-declared provider type (e.g. { algolia: "My Algolia Account" }).
    // Passed through to PreviewContextWrapper so the widget sees a real
    // provider and renders its live UX. In Edit-with-AI mode this is
    // pre-filled from the dashboard widget instance's selectedProviders
    // so the dropdown reflects the live binding instead of showing
    // blank — see the editContext-change effect below.
    const [previewProviderSelection, setPreviewProviderSelection] = useState(
        {}
    );
    // Pre-fill the provider picker from the dashboard widget's existing
    // bindings whenever a new Edit-with-AI context opens. Without this,
    // the dropdown reads empty and the user can't tell which provider
    // the live widget is currently wired to. Keyed by originalWidgetId
    // (not selectedProviders) so switching between edited widgets
    // resets correctly but the user's in-session dropdown changes
    // don't get clobbered by this initializer.
    React.useEffect(() => {
        if (effectiveEditContext?.selectedProviders) {
            setPreviewProviderSelection({
                ...effectiveEditContext.selectedProviders,
            });
        } else {
            setPreviewProviderSelection({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveEditContext?.originalWidgetId]);

    // Pre-populate the provider picker from edit-context when editing
    // an existing widget. If the existing config declares a provider
    // type that matches one of the user's installed providers, pick
    // that one. Otherwise leave the picker null so the user picks
    // explicitly.
    React.useEffect(() => {
        if (!effectiveEditContext?.configCode) return;
        const types = extractProviderTypesFromConfigCode(
            effectiveEditContext.configCode
        );
        if (types.length === 0) {
            // Existing widget has no provider declared → "no external".
            setSelectedProviderForBuild({ sentinel: "none" });
            return;
        }
        // Type-first architecture: derive just { type, providerClass }
        // from the existing widget's config. Class is determined by
        // matching an installed provider of that type, or falling back
        // to "credential" (the more common case for non-MCP providers).
        const wantedType = types[0];
        const installed = Object.values(providers || {}).find(
            (p) => p && typeof p === "object" && p.type === wantedType
        );
        setSelectedProviderForBuild({
            type: wantedType,
            providerClass:
                installed?.providerClass ||
                // No installed match — guess "mcp" if the type appears
                // in the MCP catalog (heuristic), else default to
                // "credential". Either way the user can change later.
                "credential",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        effectiveEditContext?.configCode,
        effectiveEditContext?.originalWidgetId,
    ]);
    // Device-code sign-in flow for the registry. When the user clicks
    // "Sign in to preview", we stash the flow here so we can display the
    // user code + poll for completion.
    const [signInFlow, setSignInFlow] = useState(null);
    const signInPollRef = useRef(null);

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
    const widgetScope =
        effectiveEditContext?.originalPackage?.match(/^@([^/]+)\//)?.[1];
    const isOwner =
        widgetScope === "ai-built" ||
        (registryUsername && widgetScope === registryUsername);

    // Reset the chat mode toggle to "build" each time the modal reopens.
    useEffect(() => {
        if (isOpen) {
            setChatMode("build");
            setDiscoverResults([]);
            lastDiscoverQueryRef.current = "";
        }
    }, [isOpen]);

    // Probe Claude CLI / esbuild / @ai-built dir on every modal open so
    // we can surface failures BEFORE the user tries to compile and hits
    // a raw "spawn ENOENT" with no path forward. Result is rendered as a
    // yellow banner at the top of the modal — only shown when something
    // is actually wrong.
    const [healthCheck, setHealthCheck] = useState(null);
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const result =
                    await window.mainApi?.aiAssistant?.healthCheck?.();
                if (!cancelled) setHealthCheck(result || null);
            } catch (err) {
                if (!cancelled)
                    setHealthCheck({
                        cli: { ok: false, error: err.message },
                        compiler: { ok: false, error: err.message },
                        aiBuiltDir: { ok: false, error: err.message },
                    });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    // Pull both MCP catalogs (built-in + known-external) so the system
    // prompt can advertise them to Claude. Refetched on every open so a
    // newly-added custom MCP shows up without restarting the modal.
    const [builtInCatalog, setBuiltInCatalog] = useState([]);
    const [knownExternalCatalog, setKnownExternalCatalog] = useState([]);
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const [local, external] = await Promise.all([
                    window.mainApi?.mcp?.getCatalog?.(),
                    window.mainApi?.mcp?.getKnownExternalCatalog?.(),
                ]);
                if (cancelled) return;
                setBuiltInCatalog(local?.catalog || []);
                setKnownExternalCatalog(external?.servers || []);
            } catch (err) {
                console.warn(
                    "[WidgetBuilderModal] MCP catalog fetch failed:",
                    err
                );
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    // Cross-reference the freshly-generated config's `providers: [...]`
    // against the installed-providers map + the known-external catalog
    // so we can render an "install missing provider" banner. This is the
    // safety net for cases where the AI declared a provider in the
    // config but didn't call the install_known_mcp_server tool — without
    // this, the user has no path forward. Re-checks whenever the
    // installed-providers map or the catalogs change (the modal also
    // listens for `dash:provider-installed` to force a re-fetch of the
    // installed list after the user installs via the banner button).
    const installedProviderTypes = React.useMemo(() => {
        const set = new Set();
        for (const p of Object.values(providers || {})) {
            if (p && typeof p === "object" && p.type) set.add(p.type);
        }
        return set;
        // `providers` is freshly-derived from appContext on every render,
        // so we depend on it as-is. The set value is identity-stable
        // across renders that produce the same types, which is what
        // matters for the downstream useMemo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(Object.keys(providers || {}).sort())]);

    const missingExternalProviders = React.useMemo(() => {
        const types = extractProviderTypesFromConfigCode(
            detectedCode.configCode
        );
        const seen = new Set();
        const out = [];
        for (const type of types) {
            if (seen.has(type)) continue;
            seen.add(type);
            if (installedProviderTypes.has(type)) continue;
            const entry = (knownExternalCatalog || []).find(
                (s) => s && s.id === type
            );
            if (entry) out.push(entry);
        }
        // Debug breadcrumb — visible in Electron devtools, helps
        // diagnose when the banner doesn't appear despite a config
        // that declares a provider. Stripped from production builds
        // (rollup-plugin-strip removes console.* in dash-core but
        // dash-electron keeps these).
        try {
            window.__DASH_AI_BUILDER_DEBUG = {
                detectedConfigCodePresent: !!detectedCode.configCode,
                detectedConfigCodeLength: detectedCode.configCode
                    ? detectedCode.configCode.length
                    : 0,
                detectedTypes: types,
                installedTypes: Array.from(installedProviderTypes || []),
                knownExternalCount: (knownExternalCatalog || []).length,
                knownExternalIds: (knownExternalCatalog || []).map(
                    (s) => s && s.id
                ),
                missingMatches: out.map((s) => s && s.id),
                computedAt: new Date().toISOString(),
            };
        } catch (e) {
            /* noop — debug only */
        }
        return out;
    }, [detectedCode.configCode, installedProviderTypes, knownExternalCatalog]);

    const healthCheckIssues = healthCheck
        ? [
              healthCheck.cli && healthCheck.cli.ok === false
                  ? {
                        label: "Claude CLI",
                        detail:
                            healthCheck.cli.error ||
                            "Not found — chat will not work until installed",
                    }
                  : null,
              healthCheck.compiler && healthCheck.compiler.ok === false
                  ? {
                        label: "Widget compiler",
                        detail:
                            (healthCheck.compiler.error ||
                                "esbuild not available") +
                            (healthCheck.compiler.diagnostics
                                ? ` (arch ${
                                      healthCheck.compiler.diagnostics.arch
                                  }, native binary ${
                                      healthCheck.compiler.diagnostics
                                          .nativeBinaryExists
                                          ? "present"
                                          : "missing"
                                  } at ${
                                      healthCheck.compiler.diagnostics
                                          .nativeBinaryPath || "<unresolved>"
                                  })`
                                : ""),
                        diagnostics: healthCheck.compiler.diagnostics,
                    }
                  : null,
              healthCheck.aiBuiltDir && healthCheck.aiBuiltDir.ok === false
                  ? {
                        label: "Widget output dir",
                        detail: `${
                            healthCheck.aiBuiltDir.error || "Not writable"
                        } (${healthCheck.aiBuiltDir.path || "unknown path"})`,
                    }
                  : null,
          ].filter(Boolean)
        : [];

    // Fetch the set of installed package IDs whenever the modal opens so
    // Discover cards can show accurate "Installed ✓" badges. Refreshed
    // after a successful install so the badge updates in-place.
    const refreshInstalledPackageIds = useCallback(async () => {
        try {
            const list = await window.mainApi?.widgets?.list();
            const ids = new Set();
            for (const w of list || []) {
                const id = w?.packageId || w?.name;
                if (id) ids.add(id);
            }
            setInstalledPackageIds(ids);
        } catch {
            /* ignore — cards just won't show badges */
        }
    }, []);

    useEffect(() => {
        if (isOpen) refreshInstalledPackageIds();
    }, [isOpen, refreshInstalledPackageIds]);

    // When the installed set changes (e.g. user just installed a package
    // via this modal), re-compute the `installed` flag on already-rendered
    // cards in-place so badges light up without re-running the AI search.
    useEffect(() => {
        setDiscoverResults((prev) => {
            if (!prev.length) return prev;
            let changed = false;
            const next = prev.map((pkg) => {
                const scopedId = pkg.scope
                    ? `@${pkg.scope.replace(/^@/, "")}/${
                          pkg.package || pkg.name
                      }`
                    : pkg.package || pkg.name;
                const installed =
                    !!pkg.installed || installedPackageIds.has(scopedId);
                if (installed === pkg.installed) return pkg;
                changed = true;
                return { ...pkg, installed };
            });
            return changed ? next : prev;
        });
    }, [installedPackageIds]);

    // Clear results when switching away from Discover so stale cards don't
    // linger when the user goes back to Discover later; re-running a new
    // search will repopulate them.
    useEffect(() => {
        if (chatMode !== "discover") {
            lastDiscoverQueryRef.current = "";
        }
    }, [chatMode]);

    // Populate the Discover results strip by watching ChatCore's persisted
    // messages for the AI's own search_widgets tool call. Priority:
    //  1. The AI's extracted input.query (best: "clock" vs "find some clock widgets")
    //  2. The user's most recent message text (fallback when the tool
    //     name doesn't match or tool_use is still streaming)
    //
    // The poll runs any time the modal is open — not gated by chatMode —
    // so if the AI searches in Build mode the cards are still ready to
    // show when the user flips to Discover, and users who chat freely
    // see results sooner.
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(async () => {
            try {
                const raw = localStorage.getItem("dash-widget-builder");
                if (!raw) return;
                const data = JSON.parse(raw);
                const msgs = data?.messages || [];
                // Claude Code CLI prefixes MCP tools as
                // "mcp__<server>__<tool>"; the Anthropic API backend
                // passes the bare name. Match anything that contains
                // "search_widgets" as a defensive net.
                const isSearchWidgets = (name) =>
                    typeof name === "string" &&
                    name.toLowerCase().includes("search_widgets");
                let query = "";
                outer: for (let i = msgs.length - 1; i >= 0; i--) {
                    const m = msgs[i];
                    const calls = Array.isArray(m?.toolCalls)
                        ? m.toolCalls
                        : [];
                    for (let j = calls.length - 1; j >= 0; j--) {
                        const c = calls[j];
                        if (!isSearchWidgets(c?.toolName)) continue;
                        const q =
                            c?.input?.query ??
                            (typeof c?.input === "string" ? c.input : "");
                        if (q && String(q).trim()) {
                            query = String(q).trim();
                            break outer;
                        }
                    }
                }
                // Fallback: if no tool-call query found, use the latest
                // user message as the search keyword. Imperfect (raw
                // conversational text rarely substring-matches widget
                // metadata) but strictly better than no cards at all.
                if (!query) {
                    for (let i = msgs.length - 1; i >= 0; i--) {
                        const m = msgs[i];
                        if (m?.role !== "user") continue;
                        const t =
                            typeof m.content === "string"
                                ? m.content
                                : Array.isArray(m.content)
                                ? m.content
                                      .filter((c) => c?.type === "text")
                                      .map((c) => c.text)
                                      .join(" ")
                                : "";
                        if (t && t.trim()) {
                            query = t.trim();
                            break;
                        }
                    }
                }
                if (!query) return;
                if (query === lastDiscoverQueryRef.current) return;
                lastDiscoverQueryRef.current = query;
                setDiscoverSearching(true);
                try {
                    const result = await window.mainApi?.registry?.search(
                        query,
                        { type: "widget" }
                    );
                    // Flatten packages → widget cards (same shape our cards
                    // expect: {name, displayName, description, package,
                    // scope, installed, downloadUrl, version}).
                    const widgets = [];
                    for (const pkg of result?.packages || []) {
                        const scopedId = pkg.scope
                            ? `@${pkg.scope.replace(/^@/, "")}/${pkg.name}`
                            : pkg.name;
                        // registry.search doesn't set `installed`; consult
                        // the locally-cached set we populated on open.
                        const installed =
                            !!pkg.installed ||
                            installedPackageIds.has(scopedId);
                        const base = {
                            package: pkg.name,
                            scope: pkg.scope || null,
                            installed,
                            downloadUrl: pkg.downloadUrl,
                            version: pkg.version,
                        };
                        const sub = pkg.widgets || [];
                        if (sub.length === 0) {
                            widgets.push({
                                ...base,
                                name: pkg.name,
                                displayName: pkg.displayName || pkg.name,
                                description: pkg.description || "",
                            });
                        } else {
                            for (const w of sub) {
                                widgets.push({
                                    ...base,
                                    name:
                                        pkg.scope && w.name
                                            ? `${pkg.scope}.${pkg.name}.${w.name}`
                                            : w.name || pkg.name,
                                    displayName:
                                        w.displayName ||
                                        w.name ||
                                        pkg.displayName ||
                                        pkg.name,
                                    description:
                                        w.description || pkg.description || "",
                                });
                            }
                        }
                    }
                    setDiscoverResults(widgets);
                } finally {
                    setDiscoverSearching(false);
                }
            } catch {
                /* ignore — next tick will retry */
            }
        }, 1200);
        return () => clearInterval(interval);
    }, [isOpen, installedPackageIds]);

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

    // Isolate widget-preview runtime errors so buggy user code (AI-
    // generated or registry) can't crash the rest of the app. React's
    // PreviewErrorBoundary catches RENDER errors only; event-handler
    // and async errors bypass it, and in dev mode react-error-overlay
    // will blanket the Electron window with its red full-screen UI if
    // any such error reaches the window-level error handler.
    //
    // While the modal is open we trap EVERY unhandled error at the
    // window level — filtering by stack is unreliable (callbacks from
    // fetch, timers, MCP IPC all come in through different frames).
    // This briefly suppresses errors from anywhere in the app, but
    // the trade-off is worth it: the modal is ephemeral, and the cost
    // of one missed app error is far lower than an AI widget
    // whiting-out the entire Electron window with no recovery.
    useEffect(() => {
        if (!isOpen) return;

        // Tells the early-boot error listener in public/index.html to
        // stay quiet — we own all error handling while the modal is
        // open, and double-logging just confuses the user.
        window.__DASH_WIDGET_BUILDER_OPEN = true;

        const handleCapture = (message) => {
            console.warn("[WidgetBuilderModal] suppressed error:", message);
            setPreviewError(message || "Widget runtime error");
            setPreviewComponent(null);
        };

        const errorHandler = (event) => {
            const msg =
                event.error?.message || event.message || "Widget runtime error";
            event.preventDefault();
            event.stopImmediatePropagation();
            handleCapture(msg);
        };

        const rejectionHandler = (event) => {
            const msg =
                event.reason?.message ||
                String(event.reason || "Widget async error");
            event.preventDefault();
            event.stopImmediatePropagation();
            handleCapture(msg);
        };

        // Silence the classic window.onerror hook too — react-error-overlay
        // uses addEventListener, but some polyfills / logging layers still
        // hit the old hook. Returning true tells the browser the error was
        // handled and should not be reported further.
        const prevOnError = window.onerror;
        const prevOnRejection = window.onunhandledrejection;
        window.onerror = (message, _src, _ln, _col, error) => {
            handleCapture(error?.message || message || "Widget runtime error");
            return true;
        };
        window.onunhandledrejection = (event) => {
            handleCapture(
                event?.reason?.message || String(event?.reason || "async error")
            );
            return true;
        };

        // Capture phase so we run BEFORE react-error-overlay's listeners
        // and can stopImmediatePropagation to keep its full-screen red
        // overlay from taking over the window.
        window.addEventListener("error", errorHandler, true);
        window.addEventListener("unhandledrejection", rejectionHandler, true);
        return () => {
            window.removeEventListener("error", errorHandler, true);
            window.removeEventListener(
                "unhandledrejection",
                rejectionHandler,
                true
            );
            window.onerror = prevOnError;
            window.onunhandledrejection = prevOnRejection;
            delete window.__DASH_WIDGET_BUILDER_OPEN;
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
                        !effectiveEditContext?.componentCode
                    ) {
                        setPreviewComponent(null);
                        setPreviewError(null);
                        setDetectedCode({
                            componentCode: null,
                            configCode: null,
                        });
                        setInstallStatus(null);
                        // Reset the provider gate so it reappears for the
                        // user to re-pick (matches user-stated UX: "if the
                        // user would like to change the provider, the
                        // session would end, a new chat would begin and the
                        // provider view would show as if they started from
                        // the beginning").
                        setSelectedProviderForBuild(null);
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
                            // If AI emitted only the component (no .dash.js
                            // block), synthesize a default config bound to
                            // the picker selection so the Code tab shows
                            // the file the user is actually going to
                            // install. Without this the .dash.js editor
                            // appears empty and the user can't see that
                            // their picked provider is wired in.
                            let normalized = extracted;
                            if (!extracted.configCode) {
                                // Derive widgetName from the AI's component
                                // code rather than reading the stale captured
                                // closure variable (this poller was set up
                                // when the modal first opened and detectedCode
                                // was empty).
                                const liveWidgetName = extractWidgetName(
                                    extracted.componentCode
                                );
                                const livePick =
                                    selectedProviderForBuildRef.current;
                                const synthesized = synthesizeDefaultConfigCode(
                                    liveWidgetName,
                                    livePick
                                );
                                if (synthesized && liveWidgetName) {
                                    const filesWithConfig = (() => {
                                        const out = Array.isArray(
                                            extracted.files
                                        )
                                            ? [...extracted.files]
                                            : [];
                                        const dashPath = `widgets/${liveWidgetName}.dash.js`;
                                        const existing = out.findIndex(
                                            (f) => f?.path === dashPath
                                        );
                                        if (existing >= 0) {
                                            out[existing] = {
                                                path: dashPath,
                                                content: synthesized,
                                            };
                                        } else {
                                            out.push({
                                                path: dashPath,
                                                content: synthesized,
                                            });
                                        }
                                        return out;
                                    })();
                                    normalized = {
                                        ...extracted,
                                        configCode: synthesized,
                                        files: filesWithConfig,
                                    };
                                }
                            }
                            setDetectedCode(normalized);
                            compilePreview(normalized);
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
        async (code, sourcePackageOverride = null) => {
            const name = extractWidgetName(code.componentCode);
            if (!name || !code.componentCode) return;

            // Bump the request counter. Any in-flight compile for an
            // earlier widget will see that its id is stale and bail out
            // before overwriting state. Fixes the A → Back → B race where
            // A's slower compile could overwrite B's rendered preview.
            const requestId = ++compileRequestIdRef.current;
            const isStale = () => compileRequestIdRef.current !== requestId;

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
                        // resolve relative imports from the installed
                        // package (e.g. Algolia widgets that import from
                        // ../hooks/, ../components/, etc.). Callers can
                        // pass a per-call override (used by the Discover
                        // flow before editContext gets promoted).
                        sourcePackageOverride ||
                            effectiveEditContext?.originalPackage ||
                            null,
                        // Multi-file payload (Phase 2): when the AI
                        // emitted sibling utility files alongside the
                        // primary widget, hand them to the main process
                        // so esbuild sees the full package and can
                        // resolve relative imports during preview.
                        Array.isArray(code.files) && code.files.length > 0
                            ? code.files
                            : null,
                        // Provider the user pre-selected — main process
                        // auto-corrects any drift in the AI's config.
                        selectedProviderForBuild
                    );

                if (isStale()) return;

                if (!result?.success) {
                    setPreviewError(result?.error || "Compilation failed");
                    setPreviewErrorMeta(
                        result?.code || result?.diagnostics
                            ? {
                                  code: result?.code || null,
                                  diagnostics: result?.diagnostics || null,
                              }
                            : null
                    );
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

                if (isStale()) return;

                if (match && typeof match.config.component === "function") {
                    // Compute default props from the parsed userConfig
                    // schema. Each entry of the form
                    // `{ fieldName: { defaultValue: X } }` becomes a
                    // flat prop `fieldName: X`. This mirrors what
                    // dash-core's WidgetFactory does for live-rendered
                    // widgets, so AI-generated code that reads
                    // `props.defaultJql` / `props.title` / etc. gets a
                    // sensible value instead of undefined.
                    const userConfig = match.config?.userConfig || {};
                    const defaults = {};
                    for (const [fieldName, spec] of Object.entries(
                        userConfig
                    )) {
                        if (
                            spec &&
                            typeof spec === "object" &&
                            "defaultValue" in spec
                        ) {
                            defaults[fieldName] = spec.defaultValue;
                        }
                    }
                    setPreviewWidgetDefaults(defaults);

                    // Let PreviewErrorBoundary catch runtime errors in React's context
                    setPreviewComponent(() => match.config.component);
                    setPreviewError(null);
                } else {
                    setPreviewWidgetDefaults({});
                    setPreviewError(
                        "Could not resolve widget component from bundle."
                    );
                    setPreviewComponent(null);
                }
            } catch (err) {
                if (isStale()) return;
                setPreviewError(err.message);
                setPreviewComponent(null);
            } finally {
                if (!isStale()) setIsCompiling(false);
            }
        },
        [effectiveEditContext?.originalPackage, selectedProviderForBuild]
    );

    // Fetch a registry widget's source (no install), hand it to the existing
    // compilePreview pipeline, and switch to the Preview tab.
    //
    // `pkg` may come from two shapes:
    //  1. registryController.searchRegistry — .name is the bare package name
    //  2. MCP search_widgets tool result — .name is a dotted scoped id
    //     (e.g. "trops.clock.Analog") and .package is the bare name
    // We normalize on .package (bare) when present, falling back to .name.
    //
    // If the widget is already installed locally, read the source from disk
    // (mainApi.widgets.readSources) to avoid the registry's auth-gated
    // download endpoint. Only un-installed widgets fall back to previewFetch.
    const handleSelectRegistryPackage = useCallback(
        async (pkg) => {
            const packageName = pkg.package || pkg.name;
            const scopedPackage = pkg.scope
                ? `@${pkg.scope.replace(/^@/, "")}/${packageName}`
                : packageName;
            // Bump the shared compile request counter up front so any
            // in-flight readSources/previewFetch/compile from a
            // previously-clicked card knows it's stale and bails out
            // before overwriting state. Fixes the A → Back → B race.
            const requestId = ++compileRequestIdRef.current;
            const isStale = () => compileRequestIdRef.current !== requestId;

            // Extract the bare widget component name from the card's
            // dotted id (e.g. "trops.chat.ChatClaudeCodeWidget" →
            // "ChatClaudeCodeWidget"). Used for readSources (disk files
            // are named by the bare name).
            const widgetComponentName = pkg.name?.includes(".")
                ? pkg.name.split(".").pop()
                : pkg.name;
            // The full dotted scoped id is what ComponentManager actually
            // keys widgets by (from config.id in the bundle). Dash.js's
            // `dash:place-widget-in-cell` does exact-match lookup, so we
            // need THIS value — not the bare component name — when handing
            // off to onInstalled for placement.
            const registryId =
                pkg.scope && packageName && widgetComponentName
                    ? `${pkg.scope.replace(
                          /^@/,
                          ""
                      )}.${packageName}.${widgetComponentName}`
                    : pkg.name || widgetComponentName;
            setBrowsingPackage({
                packageName,
                scopedPackage,
                componentName: widgetComponentName,
                registryId,
                displayName: pkg.displayName || packageName,
                description: pkg.description || "",
                downloadUrl: pkg.downloadUrl,
                version: pkg.version,
                installed: !!pkg.installed,
                scope: pkg.scope,
            });
            setActiveTab("preview");
            setPreviewError(null);
            setPreviewComponent(null);
            setInstallStatus(null);
            setPreviewProviderSelection({});
            setIsCompiling(true);
            try {
                let componentCode = null;
                let configCode = null;
                let resolvedDownloadUrl = null;

                // Always try the local installed copy first — it's the
                // only path that can read a specific widget out of a
                // multi-widget package by componentName. `mainApi.registry.search`
                // doesn't tell us whether the package is installed, so we
                // can't gate on `pkg.installed` (it's undefined and would
                // force every click into the registry-download fallback,
                // which always returns the alphabetically-first widget).
                const local = await window.mainApi?.widgets?.readSources(
                    scopedPackage,
                    widgetComponentName
                );
                if (isStale()) return;
                if (local?.success && local.componentCode) {
                    componentCode = local.componentCode;
                    configCode = local.configCode;
                }

                if (!componentCode) {
                    // Package isn't installed locally — fall back to the
                    // registry download. dash-core v0.1.391+ honors the
                    // componentName hint so multi-widget packages return
                    // the right widget.
                    const source = await window.mainApi?.registry?.previewFetch(
                        packageName,
                        widgetComponentName
                    );
                    if (isStale()) return;
                    if (!source?.componentCode) {
                        throw new Error(
                            "This package has no previewable component source."
                        );
                    }
                    componentCode = source.componentCode;
                    configCode = source.configCode;
                    resolvedDownloadUrl = source.downloadUrl;
                }

                if (isStale()) return;
                setDetectedCode({ componentCode, configCode });
                if (resolvedDownloadUrl) {
                    setBrowsingPackage((prev) =>
                        prev
                            ? { ...prev, downloadUrl: resolvedDownloadUrl }
                            : prev
                    );
                }
                // Pass scopedPackage so the compile IPC can resolve
                // sibling imports from the installed package dir (or
                // short-circuit to the pre-built bundle when the source
                // hasn't been modified yet).
                await compilePreview(
                    { componentCode, configCode },
                    scopedPackage
                );
            } catch (err) {
                if (isStale()) return;
                setPreviewError(err?.message || "Failed to load preview");
                setIsCompiling(false);
            }
        },
        [compilePreview]
    );

    // Install the currently-previewed registry package through the existing
    // widget install IPC. Uses the scoped ID (@scope/name) as the install
    // key and resolves {version}/{name} placeholders in the downloadUrl.
    const handleInstallRegistryPackage = useCallback(async () => {
        if (!browsingPackage || browsingPackage.installed) return;
        const scopedId = browsingPackage.scope
            ? `@${browsingPackage.scope.replace(/^@/, "")}/${
                  browsingPackage.packageName
              }`
            : browsingPackage.packageName;
        const resolvedUrl = (browsingPackage.downloadUrl || "")
            .replace(/\{version\}/g, browsingPackage.version || "")
            .replace(/\{name\}/g, browsingPackage.packageName);
        setRegistryInstalling(true);
        try {
            await window.mainApi?.widgets?.install(scopedId, resolvedUrl);
            setInstallStatus({ success: true, widgetName: scopedId });
            setBrowsingPackage((prev) =>
                prev ? { ...prev, installed: true } : prev
            );
            setDiscoverResults((prev) =>
                prev.map((p) =>
                    p.name === browsingPackage.packageName
                        ? { ...p, installed: true }
                        : p
                )
            );
            // Refresh the installed-package set so other cards from the
            // same package also show the badge, and so a subsequent
            // AI search re-flattens with the accurate install state.
            refreshInstalledPackageIds();
            if (typeof onInstalled === "function") {
                // Pass the full dotted registry id (e.g.
                // "trops.chat.ChatClaudeCodeWidget") as the first arg —
                // that's the key ComponentManager registers under and
                // LayoutBuilder looks up when placing into the cell.
                onInstalled(
                    browsingPackage.registryId || browsingPackage.packageName,
                    scopedId
                );
            }
        } catch (err) {
            setInstallStatus({
                error: err?.message || "Install failed",
            });
        } finally {
            setRegistryInstalling(false);
        }
    }, [browsingPackage, onInstalled, refreshInstalledPackageIds]);

    // Clear the current registry-widget preview so the user can pick
    // another card from the Discover results strip.
    const handleBackToDiscover = useCallback(() => {
        setBrowsingPackage(null);
        setDetectedCode({ componentCode: null, configCode: null });
        setPreviewComponent(null);
        setPreviewError(null);
        setInstallStatus(null);
        setEditContextOverride(null);
        setPreviewProviderSelection({});
        lastCompiledCode.current = null;
    }, []);

    // Place an already-installed registry widget into the user's current
    // grid cell. Mirrors what the AI-build flow does at the end — calls
    // the onInstalled callback so Dash.js dispatches the
    // `dash:place-widget-in-cell` event, then shows the success screen.
    const handleAddInstalledToDashboard = useCallback(() => {
        if (!browsingPackage) return;
        const scopedId = browsingPackage.scopedPackage
            ? browsingPackage.scopedPackage
            : browsingPackage.scope
            ? `@${browsingPackage.scope.replace(/^@/, "")}/${
                  browsingPackage.packageName
              }`
            : browsingPackage.packageName;
        setInstallStatus({ success: true, widgetName: scopedId });
        if (typeof onInstalled === "function") {
            // Full dotted registry id is required for the cell-placement
            // handoff — see the comment in handleInstallRegistryPackage.
            onInstalled(
                browsingPackage.registryId || browsingPackage.packageName,
                scopedId
            );
        }
    }, [browsingPackage, onInstalled]);

    // Remix a registry widget: keep the fetched source + preview in place,
    // promote the package into an internal edit-context override so the
    // modal transitions to its edit/remix flow (AI chat now knows the
    // source code; Install footer becomes the existing remix/rename
    // footer; handleInstall records remixedFrom attribution).
    const handleRemixRegistryPackage = useCallback(() => {
        if (!browsingPackage || !detectedCode?.componentCode) return;
        const scoped = browsingPackage.scopedPackage
            ? browsingPackage.scopedPackage
            : browsingPackage.scope
            ? `@${browsingPackage.scope.replace(/^@/, "")}/${
                  browsingPackage.packageName
              }`
            : browsingPackage.packageName;
        const originalComponentName = extractWidgetName(
            detectedCode.componentCode
        );
        setEditContextOverride({
            componentCode: detectedCode.componentCode,
            configCode: detectedCode.configCode || "",
            originalPackage: scoped,
            originalComponentName,
            originalWidgetId: `${scoped}/${
                originalComponentName || browsingPackage.packageName
            }`,
            manifest: {
                author: "Unknown",
                version: browsingPackage.version || "1.0.0",
            },
        });
        // Seed the remix name so the footer's rename input is pre-filled.
        const base = (originalComponentName || "").replace(/Remix\d*$/, "");
        setRemixName(base ? `${base}Remix` : "");
        setEditMode("remix");
        // Hand off from browsing-registry footer to the normal remix
        // footer by clearing browsingPackage.
        setBrowsingPackage(null);
        setInstallStatus(null);
        // Clear the chat so the user can describe their changes from a
        // clean slate — the system prompt will now include the source.
        try {
            localStorage.setItem(
                "dash-widget-builder",
                JSON.stringify({ messages: [] })
            );
        } catch {
            /* ignore */
        }
    }, [browsingPackage, detectedCode]);

    // Kick off the registry device-code sign-in flow: open the browser
    // to the verification URL and start polling for the resulting token.
    // When polling succeeds, auto-retry the current registry preview.
    const handleSignInForPreview = useCallback(async () => {
        try {
            const flow = await window.mainApi?.registryAuth?.initiateLogin();
            if (!flow?.deviceCode) {
                throw new Error(
                    "Could not start sign-in flow. Please try again."
                );
            }
            setSignInFlow(flow);
            if (flow.verificationUrlComplete) {
                window.mainApi?.shell?.openExternal?.(
                    flow.verificationUrlComplete
                );
            }
            if (signInPollRef.current) {
                clearInterval(signInPollRef.current);
            }
            const intervalMs = (flow.interval || 5) * 1000;
            signInPollRef.current = setInterval(async () => {
                try {
                    const res = await window.mainApi?.registryAuth?.pollToken(
                        flow.deviceCode
                    );
                    if (res?.status === "authorized") {
                        clearInterval(signInPollRef.current);
                        signInPollRef.current = null;
                        setSignInFlow(null);
                        setPreviewError(null);
                        // Refresh auth status so the Discover "sign in as
                        // guest" banner disappears and any edit-with-AI
                        // ownership checks see the user as logged in.
                        try {
                            const status =
                                await window.mainApi?.registryAuth?.getStatus();
                            if (status?.authenticated) {
                                const profile =
                                    await window.mainApi?.registryAuth?.getProfile();
                                setRegistryUsername(profile?.username || null);
                            }
                        } catch {
                            /* ignore */
                        }
                        // Auto-retry the current registry package
                        if (browsingPackage) {
                            const retry = {
                                name: browsingPackage.packageName,
                                package: browsingPackage.packageName,
                                scope: browsingPackage.scope,
                                displayName: browsingPackage.displayName,
                                description: browsingPackage.description,
                                downloadUrl: browsingPackage.downloadUrl,
                                version: browsingPackage.version,
                                installed: browsingPackage.installed,
                            };
                            handleSelectRegistryPackage(retry);
                        }
                    } else if (res?.status === "expired") {
                        clearInterval(signInPollRef.current);
                        signInPollRef.current = null;
                        setSignInFlow(null);
                        setPreviewError(
                            "Sign-in code expired. Click Sign in to try again."
                        );
                    }
                } catch {
                    /* keep polling */
                }
            }, intervalMs);
        } catch (err) {
            setPreviewError(err?.message || "Could not start sign-in flow.");
        }
    }, [browsingPackage, handleSelectRegistryPackage]);

    useEffect(() => {
        return () => {
            if (signInPollRef.current) {
                clearInterval(signInPollRef.current);
                signInPollRef.current = null;
            }
        };
    }, []);

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
                              package:
                                  effectiveEditContext.originalPackage ||
                                  "unknown",
                              component:
                                  effectiveEditContext.originalComponentName ||
                                  "unknown",
                              author:
                                  effectiveEditContext.manifest?.author ||
                                  "Unknown",
                              version:
                                  effectiveEditContext.manifest?.version ||
                                  "1.0.0",
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
                finalConfigCode = dedupProvidersInConfigCode(finalConfigCode);
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
                // Same synthesizer the message-poller uses, with the
                // user-picked category baked in. Picker selection drives
                // the providers array.
                finalConfigCode = synthesizeDefaultConfigCode(
                    installName,
                    selectedProviderForBuild
                );
                finalConfigCode = injectCategoryIntoConfigCode(
                    finalConfigCode,
                    selectedCategory
                );
            }

            // Build the final multi-file payload. Start from the
            // detected files[] (which may contain sibling utilities)
            // and replace the primary widget's component + config with
            // the post-processed strings (category injected, rename
            // applied). For legacy two-block responses where files[]
            // was synthesized from componentCode+configCode, this just
            // overwrites the same two entries we already had.
            const finalFiles = (() => {
                const out = [];
                const primaryComponentPath = `widgets/${installName}.js`;
                const primaryConfigPath = `widgets/${installName}.dash.js`;
                const detectedFiles = Array.isArray(detectedCode.files)
                    ? detectedCode.files
                    : [];
                let wroteComponent = false;
                let wroteConfig = false;

                for (const f of detectedFiles) {
                    if (!f?.path || f.content == null) continue;
                    const isPrimaryConfig =
                        f.path.endsWith(".dash.js") &&
                        !wroteConfig &&
                        // Match either the original or the renamed widget
                        (f.path === primaryConfigPath ||
                            f.path === `widgets/${widgetName}.dash.js`);
                    const isPrimaryComponent =
                        !isPrimaryConfig &&
                        !f.path.endsWith(".dash.js") &&
                        !wroteComponent &&
                        (f.path === primaryComponentPath ||
                            f.path === `widgets/${widgetName}.js` ||
                            f.path === `widgets/${widgetName}.jsx`);
                    if (isPrimaryConfig) {
                        out.push({
                            path: primaryConfigPath,
                            content: finalConfigCode,
                        });
                        wroteConfig = true;
                    } else if (isPrimaryComponent) {
                        out.push({
                            path: primaryComponentPath,
                            content: installComponentCode,
                        });
                        wroteComponent = true;
                    } else {
                        out.push({ path: f.path, content: f.content });
                    }
                }

                if (!wroteComponent) {
                    out.push({
                        path: primaryComponentPath,
                        content: installComponentCode,
                    });
                }
                if (!wroteConfig) {
                    out.push({
                        path: primaryConfigPath,
                        content: finalConfigCode,
                    });
                }
                return out;
            })();

            const result = await window.mainApi?.widgetBuilder?.aiBuild(
                installName,
                installComponentCode,
                finalConfigCode,
                `AI-generated widget: ${installName}`,
                cellContext || null,
                process.env.REACT_APP_IDENTIFIER || "@trops/dash-electron",
                remixMeta,
                finalFiles,
                // Provider the user pre-selected — main process
                // auto-corrects any drift in the AI's config to match.
                selectedProviderForBuild
            );
            if (result?.success) {
                setInstallStatus({
                    success: true,
                    widgetName: result.widgetName,
                });
                if (onInstalled) {
                    // Pass the canonical scoped component id (e.g.
                    // "ai-built.mywidget.MyWidget") — that's the key
                    // ComponentManager registers under post-v0.1.432
                    // and the cell-placement handler expects. Passing
                    // the bare component name lands a layout item
                    // whose `component:` field doesn't resolve via the
                    // render-path lookups, so the new widget silently
                    // doesn't appear on the dashboard. The registry-
                    // install path was fixed for this in ca166ff; the
                    // AI-build path was missed.
                    const scopedRegistryId = result.widgetName
                        ? makeScopedComponentId(result.widgetName, installName)
                        : installName;
                    onInstalled(scopedRegistryId, result.widgetName);
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
        effectiveEditContext,
        isRemixMode,
        editMode,
        remixName,
        selectedProviderForBuild,
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

            {/* Health-check banner — only renders when something is
                actually broken. Kept above the split pane so it's
                visible regardless of which tab the user is on. */}
            {healthCheckIssues.length > 0 && (
                <div className="flex flex-col gap-1 px-4 py-2 bg-amber-900/20 border-b border-amber-700/30 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                        <FontAwesomeIcon
                            icon="triangle-exclamation"
                            className="h-3 w-3"
                        />
                        AI Assistant setup issue
                        {healthCheckIssues.length > 1
                            ? ` (${healthCheckIssues.length})`
                            : ""}
                    </div>
                    {healthCheckIssues.map((issue, idx) => (
                        <div
                            key={idx}
                            className="text-xs text-amber-200/80 pl-5"
                        >
                            <span className="font-medium">{issue.label}:</span>{" "}
                            {issue.detail}
                        </div>
                    ))}
                </div>
            )}

            {/* Missing-provider banner — appears when the freshly-generated
                widget config declares an MCP `provider` that the user
                hasn't installed yet AND the curated allow-list has an
                entry for it. Lets the user install the provider in one
                click without going back to Settings or relying on the AI
                to call install_known_mcp_server. Disappears once the
                provider is added (driven by the `providers` map from
                AppContext). */}
            {missingExternalProviders.length > 0 && (
                <div className="flex flex-col gap-2 px-4 py-2 bg-indigo-900/20 border-b border-indigo-700/30 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200">
                        <FontAwesomeIcon icon="plug" className="h-3 w-3" />
                        This widget needs{" "}
                        {missingExternalProviders.length === 1
                            ? "1 provider"
                            : `${missingExternalProviders.length} providers`}{" "}
                        you haven't installed yet.
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-5">
                        {missingExternalProviders.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new CustomEvent(
                                            "dash:install-known-external",
                                            {
                                                detail: { id: entry.id },
                                            }
                                        )
                                    )
                                }
                                className="text-xs px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
                            >
                                Install {entry.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

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
                            {effectiveEditContext?.sourceError &&
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
                                                Can't load widget source
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {effectiveEditContext.originalComponentName
                                                    ? `"${effectiveEditContext.originalComponentName}" `
                                                    : "This widget "}
                                                source couldn't be read. Try
                                                re-publishing the widget package
                                                with source files included, or
                                                generate a fresh widget below.
                                            </p>
                                            {effectiveEditContext.originalPackage && (
                                                <p className="text-[10px] text-gray-600 font-mono">
                                                    package:{" "}
                                                    {
                                                        effectiveEditContext.originalPackage
                                                    }
                                                </p>
                                            )}
                                            <p className="text-[10px] text-gray-600 font-mono break-words">
                                                reason:{" "}
                                                {
                                                    effectiveEditContext.sourceError
                                                }
                                            </p>
                                            <p className="text-xs text-gray-600 mt-2">
                                                You can still describe a new
                                                widget from scratch using the
                                                chat.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            {/* Empty state: Discover cards grid OR
                                "Describe your widget" prompt for Build mode. */}
                            {!previewComponent &&
                                !previewError &&
                                !isCompiling &&
                                !effectiveEditContext?.sourceError &&
                                (() => {
                                    const hasDiscoverActivity =
                                        discoverSearching ||
                                        discoverResults.length > 0 ||
                                        !!lastDiscoverQueryRef.current;
                                    if (hasDiscoverActivity) {
                                        return (
                                            <div className="flex flex-col h-full">
                                                <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-800/60">
                                                    <div className="flex items-baseline gap-2 min-w-0">
                                                        <span className="text-sm font-semibold text-gray-200">
                                                            {discoverSearching
                                                                ? "Searching registry..."
                                                                : `${
                                                                      discoverResults.length
                                                                  } match${
                                                                      discoverResults.length ===
                                                                      1
                                                                          ? ""
                                                                          : "es"
                                                                  }`}
                                                        </span>
                                                        {lastDiscoverQueryRef.current && (
                                                            <span className="text-xs text-gray-500 truncate">
                                                                for “
                                                                {
                                                                    lastDiscoverQueryRef.current
                                                                }
                                                                ”
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0">
                                                        Click a widget to
                                                        preview
                                                    </span>
                                                </div>
                                                {/* Sign-in nudge: the
                                                    registry only returns
                                                    public packages to
                                                    anonymous users, so
                                                    missing private/entitled
                                                    widgets can be surfaced
                                                    with one click. */}
                                                {registryChecked &&
                                                    !registryUsername && (
                                                        <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-900/15 border border-amber-700/30">
                                                            <p className="flex-1 text-xs text-amber-200 leading-snug">
                                                                You're browsing
                                                                as a guest —
                                                                sign in to also
                                                                see private
                                                                widgets you own
                                                                or have access
                                                                to.
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    handleSignInForPreview
                                                                }
                                                                className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 transition-colors"
                                                            >
                                                                Sign in
                                                            </button>
                                                        </div>
                                                    )}
                                                {!discoverSearching &&
                                                    discoverResults.length ===
                                                        0 && (
                                                        <div className="flex-1 flex items-center justify-center text-center text-sm text-gray-500 px-6">
                                                            No registry widgets
                                                            matched “
                                                            {
                                                                lastDiscoverQueryRef.current
                                                            }
                                                            ”. Try different
                                                            keywords, or switch
                                                            to Build mode to
                                                            generate one.
                                                        </div>
                                                    )}
                                                {discoverResults.length > 0 && (
                                                    <div className="flex-1 overflow-auto pt-3">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {discoverResults.map(
                                                                (pkg) => (
                                                                    <button
                                                                        key={`${
                                                                            pkg.scope ||
                                                                            ""
                                                                        }/${
                                                                            pkg.name
                                                                        }`}
                                                                        onClick={() =>
                                                                            handleSelectRegistryPackage(
                                                                                pkg
                                                                            )
                                                                        }
                                                                        className="group text-left rounded-lg border border-gray-700/60 bg-gray-800/40 hover:bg-gray-800/80 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-950/50 p-4 transition-all cursor-pointer"
                                                                    >
                                                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                                                            <div className="font-semibold text-sm text-gray-200 truncate group-hover:text-indigo-200">
                                                                                {pkg.displayName ||
                                                                                    pkg.name}
                                                                            </div>
                                                                            {pkg.installed && (
                                                                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-green-900/40 text-green-300 border border-green-700/40">
                                                                                    Installed
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[11px] text-gray-500 truncate font-mono mb-2">
                                                                            {pkg.scope
                                                                                ? `@${pkg.scope.replace(
                                                                                      /^@/,
                                                                                      ""
                                                                                  )}/${
                                                                                      pkg.package ||
                                                                                      pkg.name
                                                                                  }`
                                                                                : pkg.package ||
                                                                                  pkg.name}
                                                                        </div>
                                                                        {pkg.description && (
                                                                            <div
                                                                                className="text-xs text-gray-400 overflow-hidden leading-relaxed"
                                                                                style={{
                                                                                    display:
                                                                                        "-webkit-box",
                                                                                    WebkitLineClamp: 3,
                                                                                    WebkitBoxOrient:
                                                                                        "vertical",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    pkg.description
                                                                                }
                                                                            </div>
                                                                        )}
                                                                        <div className="mt-3 text-[10px] uppercase tracking-wide text-indigo-400/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            Click
                                                                            to
                                                                            preview
                                                                            →
                                                                        </div>
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                            <div className="w-16 h-16 rounded-2xl bg-gray-800/80 border border-gray-700/30 flex items-center justify-center">
                                                <FontAwesomeIcon
                                                    icon="wand-magic-sparkles"
                                                    className="h-7 w-7 text-indigo-400/40"
                                                />
                                            </div>
                                            <div className="space-y-2 max-w-sm">
                                                <p className="text-sm font-medium text-gray-300">
                                                    {chatMode === "discover"
                                                        ? "Search the registry"
                                                        : "Describe your widget"}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {chatMode === "discover"
                                                        ? "Tell the AI what kind of widget you're looking for and registry matches will appear here."
                                                        : "The AI will generate code and a live preview will appear here automatically."}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                            {/* Auth-gated preview: friendlier than a red error */}
                            {previewError &&
                                /authentic|unauth|401|sign.?in/i.test(
                                    previewError
                                ) && (
                                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                                        <div className="w-full max-w-lg rounded-lg border border-amber-700/30 bg-amber-900/10 p-4 space-y-3">
                                            <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                                                <FontAwesomeIcon
                                                    icon="lock"
                                                    className="h-4 w-4"
                                                />
                                                Sign in to preview
                                            </div>
                                            <p className="text-xs text-amber-100/80 leading-relaxed">
                                                The registry requires sign-in to
                                                download this package. Click
                                                below to open the sign-in page
                                                in your browser.
                                            </p>
                                            {signInFlow ? (
                                                <div className="space-y-2">
                                                    <p className="text-xs text-amber-100/90">
                                                        A browser tab should
                                                        have opened. Verify the
                                                        code there matches:
                                                    </p>
                                                    <div className="font-mono text-lg tracking-widest text-amber-200 bg-black/30 rounded px-3 py-2 text-center select-all">
                                                        {signInFlow.userCode ||
                                                            "—"}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-amber-200/70">
                                                        <span className="inline-flex gap-0.5">
                                                            <span
                                                                className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce"
                                                                style={{
                                                                    animationDelay:
                                                                        "0ms",
                                                                }}
                                                            />
                                                            <span
                                                                className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce"
                                                                style={{
                                                                    animationDelay:
                                                                        "150ms",
                                                                }}
                                                            />
                                                            <span
                                                                className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce"
                                                                style={{
                                                                    animationDelay:
                                                                        "300ms",
                                                                }}
                                                            />
                                                        </span>
                                                        Waiting for sign-in…
                                                        we'll retry
                                                        automatically.
                                                    </div>
                                                    {signInFlow.verificationUrlComplete && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                window.mainApi?.shell?.openExternal?.(
                                                                    signInFlow.verificationUrlComplete
                                                                )
                                                            }
                                                            className="text-xs text-indigo-300 hover:text-indigo-200 underline"
                                                        >
                                                            Reopen sign-in page
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleSignInForPreview
                                                    }
                                                    className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                                                >
                                                    Sign in
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                            {/* Compile error (non-auth) */}
                            {previewError &&
                                !/authentic|unauth|401|sign.?in/i.test(
                                    previewError
                                ) && (
                                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                                        <div className="w-full max-w-lg rounded-lg border border-red-700/30 bg-red-900/10 p-4 space-y-2">
                                            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                                <FontAwesomeIcon
                                                    icon="exclamation-circle"
                                                    className="h-4 w-4"
                                                />
                                                {previewErrorMeta?.code ===
                                                "ESBUILD_SPAWN_FAILED"
                                                    ? "Widget compiler unavailable"
                                                    : "Compilation Error"}
                                            </div>
                                            <pre className="text-xs text-red-300/70 bg-black/20 rounded p-2 overflow-auto max-h-32">
                                                {previewError}
                                            </pre>
                                            {previewErrorMeta?.diagnostics && (
                                                <details className="text-xs text-red-300/70 bg-black/20 rounded p-2 overflow-auto">
                                                    <summary className="cursor-pointer text-red-400 select-none">
                                                        Diagnostics — share this
                                                        if you report a bug
                                                    </summary>
                                                    <pre className="mt-2 whitespace-pre-wrap break-all">
                                                        {JSON.stringify(
                                                            previewErrorMeta.diagnostics,
                                                            null,
                                                            2
                                                        )}
                                                    </pre>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            try {
                                                                navigator.clipboard.writeText(
                                                                    `${previewError}\n\n${JSON.stringify(
                                                                        previewErrorMeta.diagnostics,
                                                                        null,
                                                                        2
                                                                    )}`
                                                                );
                                                            } catch {
                                                                /* noop */
                                                            }
                                                        }}
                                                        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                                    >
                                                        Copy diagnostics
                                                    </button>
                                                </details>
                                            )}
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
                                                                    messages:
                                                                        msgs,
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
                                    {/* Provider picker — shown when the
                                        widget declares providers. Without a
                                        selection the widget renders its own
                                        "not configured" empty state, same
                                        as on a real dashboard. */}
                                    <PreviewProviderPicker
                                        configCode={detectedCode.configCode}
                                        appProviders={
                                            (previewAppCtx || appContext)
                                                ?.providers
                                        }
                                        selection={previewProviderSelection}
                                        onChange={setPreviewProviderSelection}
                                    />
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
                                                editContext={
                                                    effectiveEditContext
                                                }
                                                previewProviderSelection={
                                                    previewProviderSelection
                                                }
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
                                                            // userConfig defaults first
                                                            // (so brand-new widgets render
                                                            // with the AI's defaults
                                                            // instead of undefined), then
                                                            // userPrefs from the edit
                                                            // context (so editing-an-
                                                            // existing-widget shows the
                                                            // user's saved values).
                                                            {...previewWidgetDefaults}
                                                            {...(effectiveEditContext?.userPrefs ||
                                                                {})}
                                                        />
                                                    </React.Suspense>
                                                </PreviewErrorBoundary>
                                            </PreviewContextWrapper>
                                        </div>
                                    </div>
                                    {/* Registry-preview footer (shown when user is browsing a registry widget) */}
                                    {browsingPackage && (
                                        <div
                                            className={`px-6 py-3 border-t ${borderColor} shrink-0 space-y-2`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleBackToDiscover
                                                    }
                                                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                                >
                                                    <FontAwesomeIcon
                                                        icon="arrow-left"
                                                        className="h-2.5 w-2.5"
                                                    />
                                                    Back to Discover
                                                </button>
                                                <div className="text-xs text-gray-400 truncate flex-1 text-right font-mono">
                                                    {browsingPackage.scope
                                                        ? `@${browsingPackage.scope.replace(
                                                              /^@/,
                                                              ""
                                                          )}/${
                                                              browsingPackage.packageName
                                                          }`
                                                        : browsingPackage.packageName}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs text-gray-500 truncate">
                                                    {browsingPackage.installed
                                                        ? "Already installed in your widget library."
                                                        : "Preview this widget, then install or remix."}
                                                </span>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={
                                                            handleRemixRegistryPackage
                                                        }
                                                        disabled={
                                                            !detectedCode?.componentCode
                                                        }
                                                        title="Fork this widget into @ai-built/ and edit it with AI"
                                                        className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-200 text-sm font-medium transition-colors"
                                                    >
                                                        Remix
                                                    </button>
                                                    {browsingPackage.installed ? (
                                                        <button
                                                            type="button"
                                                            onClick={
                                                                handleAddInstalledToDashboard
                                                            }
                                                            disabled={
                                                                !cellContext
                                                            }
                                                            title={
                                                                cellContext
                                                                    ? "Place this widget in the dashboard cell you opened the builder from"
                                                                    : "Open the builder from an empty grid cell to place widgets"
                                                            }
                                                            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                                                        >
                                                            Add to Dashboard
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={
                                                                handleInstallRegistryPackage
                                                            }
                                                            disabled={
                                                                registryInstalling
                                                            }
                                                            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                                                        >
                                                            {registryInstalling
                                                                ? "Installing..."
                                                                : cellContext
                                                                ? "Install + Add to Dashboard"
                                                                : "Install"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {installStatus?.error && (
                                                <div className="text-xs text-red-400">
                                                    {installStatus.error}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Footer — mode toggle, name (remix), category + Install */}
                                    {!browsingPackage && (
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
                                                                    Sign in to
                                                                    the registry
                                                                    to update
                                                                    your own
                                                                    widgets in
                                                                    place
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
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase() +
                                                                        raw.slice(
                                                                            1
                                                                        )
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
                                                              effectiveEditContext.originalPackage ||
                                                              `@ai-built/${widgetName?.toLowerCase()}`
                                                          }`
                                                        : `Remixes ${
                                                              effectiveEditContext.originalComponentName
                                                          } → @ai-built/${(
                                                              remixName ||
                                                              widgetName
                                                          )?.toLowerCase()}`}
                                                </span>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <select
                                                        value={
                                                            selectedCategory ||
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            setSelectedCategory(
                                                                e.target
                                                                    .value ||
                                                                    null
                                                            )
                                                        }
                                                        className="px-2 py-1.5 text-xs bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
                                                        title="Pick a category before installing"
                                                    >
                                                        <option
                                                            value=""
                                                            disabled
                                                        >
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
                                                            : editMode ===
                                                              "update"
                                                            ? "Update Widget"
                                                            : "Remix Widget"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                                                if (browsingPackage) {
                                                    setBrowsingPackage(null);
                                                }
                                            }}
                                            className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
                                        >
                                            {browsingPackage
                                                ? "Browse More"
                                                : "Build Another"}
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
                    {/* Build / Discover mode toggle */}
                    <div className="flex items-center gap-2 px-3 pt-2 shrink-0">
                        <div className="flex items-center gap-1 bg-gray-800/50 rounded-md border border-gray-700/50 p-0.5">
                            <button
                                type="button"
                                onClick={() => setChatMode("build")}
                                className={`px-3 py-1 text-xs rounded transition-colors ${
                                    chatMode === "build"
                                        ? "bg-indigo-600/30 text-indigo-300 font-medium"
                                        : "text-gray-500 hover:text-gray-300"
                                }`}
                                title="Generate a custom widget from scratch with AI"
                            >
                                Build
                            </button>
                            <button
                                type="button"
                                onClick={() => setChatMode("discover")}
                                className={`px-3 py-1 text-xs rounded transition-colors ${
                                    chatMode === "discover"
                                        ? "bg-indigo-600/30 text-indigo-300 font-medium"
                                        : "text-gray-500 hover:text-gray-300"
                                }`}
                                title="Search the Dash registry for existing widgets"
                            >
                                Discover
                            </button>
                        </div>
                        <span className="text-[11px] text-gray-500 truncate">
                            {chatMode === "build"
                                ? "AI will generate a custom widget"
                                : "AI will search the registry"}
                        </span>
                    </div>

                    {/* Chat content + provider gate. Relative wrapper
                        so the gate's `absolute inset-0` covers only
                        this region — the mode toggle above stays
                        clickable so the user can switch to Discover.
                        The gate appears when in build mode and no
                        provider has been picked yet (Edit-with-AI
                        auto-derives via the useEffect at line ~1467
                        and skips the gate). New Chat clears messages
                        which triggers the message-poller's reset
                        block to also null `selectedProviderForBuild`,
                        re-opening the gate. */}
                    <div className="relative flex flex-col flex-1 min-h-0">
                        {chatMode === "build" &&
                            selectedProviderForBuild === null && (
                                <ChatProviderGate
                                    onChange={setSelectedProviderForBuild}
                                    builtInCatalog={builtInCatalog}
                                    knownExternalCatalog={knownExternalCatalog}
                                />
                            )}

                        <ChatCore
                            title=""
                            model={model}
                            systemPrompt={(() => {
                                if (chatMode === "discover") {
                                    return DISCOVER_SYSTEM_PROMPT;
                                }
                                const base = buildSystemPrompt({
                                    builtInCatalog,
                                    knownExternalCatalog,
                                    installedProviders: providers,
                                    selectedProvider: selectedProviderForBuild,
                                });
                                if (effectiveEditContext?.componentCode) {
                                    return `${base}\n\nYou are editing an existing widget. The user will describe what changes they want. Here is the CURRENT source code you are modifying:\n\nComponent (jsx):\n\`\`\`jsx\n${
                                        effectiveEditContext.componentCode
                                    }\n\`\`\`\n\nConfig (.dash.js):\n\`\`\`javascript\n${
                                        effectiveEditContext.configCode || ""
                                    }\n\`\`\`\n\nWhen the user describes changes, output BOTH updated code blocks (the full component and full config) incorporating their requested changes. Do NOT ask the user to share the code — you already have it above.\n\nIf this is your FIRST response in the conversation, do NOT output code. Reply with 1–2 short sentences: confirm you see the widget by name and ask what they'd like to change. No lists, no bullet points, no sections, no suggestions — keep it under 30 words total.`;
                                }
                                return `${base}\n\nIf this is your FIRST response in the conversation, do NOT output code. Reply with 1–2 short sentences inviting the user to describe the widget they want to build (what it should show, what data source it pulls from, what interactions it needs). No lists, no bullet points, no examples — keep it under 30 words total.`;
                            })()}
                            maxToolRounds="10"
                            apiKey={apiKey}
                            backend={preferredBackend}
                            persistKey="dash-widget-builder"
                            hideToolsBanner={true}
                            initialMessage={
                                chatMode === "discover"
                                    ? "Tell me what kind of widget you're looking for."
                                    : effectiveEditContext?.componentCode
                                    ? "Hello, let's make some edits to this widget."
                                    : "Hi, I'd like to build a new widget."
                            }
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};
