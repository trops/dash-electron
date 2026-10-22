/**
 * WidgetBuilderModal — the Widget Builder, for building a widget by hand
 * (consolidation Phase 3b: every AI build goes through the Dash team in
 * Create; this builder has no AI of its own).
 *
 * Left: the live preview and the Preview / Code / Configure / Logs /
 * Style checks tabs (Console and Scorecard until consolidation Phase 4d).
 * Right: Compose (pick a kind of widget, lay out its parts) for a new
 * widget; hidden when editing an installed widget's code, which
 * opens on the Code tab.
 *
 * Every version is checked (the code checks, then the Dash team's Checker)
 * and Install waits for a pass of that exact code; problems are shown for
 * the user to fix.
 */
import React, {
    useState,
    useContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from "react";
import {
    Modal,
    Button,
    Button2,
    Button3,
    ButtonIcon3,
    ChoiceMenu,
    FontAwesomeIcon,
    InputText,
    ListRow,
    PanelHeader,
    SegmentedControl,
    ThemeContext,
    CodeEditorVS,
    getStatusColors,
} from "@trops/dash-react";
import {
    AppContext,
    evaluateBundle,
    extractWidgetConfigs,
    makeScopedComponentId,
    // Shared with the Widgets page (who may publish / edit a package).
    deriveWidgetOwnership,
    runTeamRole,
} from "@trops/dash-core";
import { WidgetConfigureTab } from "./WidgetConfigureTab";
import { extractWidgetName } from "./extractWidgetName";
import { WidgetDraftsList } from "./WidgetDraftsList";
import { builderTheme, useBuilderTheme } from "./useBuilderTheme";
import { WidgetConsolePane } from "./WidgetConsolePane";
import { ChecksStatus } from "./ChecksStatus";
import { UnsavedWorkPrompt } from "./UnsavedWorkPrompt";
import {
    codeKeyOf,
    fastCheckProblems,
    verdictOf,
    draftCheckRequest,
} from "./draftCheck";
import { ComposerPaneV2 } from "./composer/ComposerPaneV2";
// Slice 19G.2: installWidgetConsoleCapture is no longer wired into
// production — widgets render in an iframe so host-window capture
// can't see them. The module file stays for its tests + any future
// inline-render surface; we simply don't install it here anymore.
// (Kept as a comment to make the absence intentional.)
import * as transforms from "./widgetCodeTransforms";
import {
    extractProviderDeclarations,
    buildPreviewWidgetData,
} from "./widgetPreviewData";
import { PreviewIframe } from "./PreviewIframe";
import {
    AcceptanceScorecard,
    evaluateScorecard,
} from "./composer/AcceptanceScorecard";
import {
    validateProviderApiUsage,
    validateNoModalUsage,
    validateNoBotCalls,
    validateEventPublishing,
    validateComponentReferences,
} from "./widgetCodeValidator";
import { scanCredentialMethodCalls } from "./widgetCredentialPermissionScanner";
import { setGrants as setCredentialGrants } from "./widgetCredentialGrants";
import { WidgetCredentialPermissionModal } from "./WidgetCredentialPermissionModal";

// Slice 17c — iframe-isolated preview is the only path. The legacy
// localStorage opt-out (`dash:preview-iframe = "0"`) used to flip to
// the inline path; that path is gone now (17c.7) so the helper has
// been removed too. AI-generated widget code runs in an iframe with
// its own React tree, DOM, and JS context — render errors,
// event-handler errors, async rejections, commit-phase failures,
// CSS leaks, and global pollution are kernel-isolated from the host
// React tree.

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
    justChanged,
}) {
    const bt = useBuilderTheme();
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
        <div
            className={`px-4 pt-2 pb-3 border-b ${bt.border} shrink-0 space-y-2`}
        >
            {declarations.map((decl) => {
                const options = compatibleByType[decl.type] || [];
                const current = selection?.[decl.type] || "";
                const label = decl.type.replace(/^./, (c) => c.toUpperCase());
                return (
                    <div
                        key={decl.type}
                        className="flex items-center gap-2 text-xs"
                    >
                        <span className={`${bt.muted} shrink-0`}>
                            {label} provider:
                        </span>
                        {options.length === 0 ? (
                            <Button2
                                size="sm"
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
                                title={`Set up a ${label} provider`}
                            />
                        ) : (
                            <select
                                value={current}
                                onChange={(e) =>
                                    onChange(
                                        {
                                            ...(selection || {}),
                                            [decl.type]: e.target.value,
                                        },
                                        decl.type,
                                        e.target.value
                                    )
                                }
                                className={`flex-1 max-w-xs px-2 py-1 ${bt.surface} border ${bt.border} rounded ${bt.text} focus:outline-none`}
                                data-testid={`preview-provider-select-${decl.type}`}
                            >
                                <option value="">— Select a provider —</option>
                                {options.map((p) => (
                                    <option key={p.name} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        {justChanged?.type === decl.type && (
                            <span
                                className={`text-xs ${bt.status.success.icon} flex items-center gap-1`}
                                data-testid="provider-just-changed"
                            >
                                <FontAwesomeIcon
                                    icon="check-circle"
                                    className="h-2.5 w-2.5"
                                />
                                Now using {justChanged.name || "(none)"} —
                                preview reloaded
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * PreviewTestInputsForm
 *
 * Renders one input per userConfig field the AI declared, so the user
 * can fill in test values (e.g. `indexName="airports"`) and watch the
 * previewed widget re-render against real data — without leaving the
 * modal. Decoupled from the parent: parent owns the values state,
 * this component is a controlled view.
 *
 * Field types map to inputs:
 *   - text / number / password / color → <input>
 *   - textarea                         → <textarea>
 *   - boolean                          → <input type="checkbox">
 *   - select (with options[])          → <select>
 *   - anything else                    → falls back to <input>
 *
 * Empty / missing userConfig hides the form entirely (no chrome
 * shown for widgets that don't take inputs).
 */
function PreviewTestInputsForm({
    userConfig,
    defaults,
    values,
    onChange,
    onReset,
}) {
    const bt = useBuilderTheme();
    const fields = userConfig
        ? Object.entries(userConfig).filter(
              ([, spec]) => spec && typeof spec === "object"
          )
        : [];

    // Slice 19D: buffer changes locally and only commit on Apply.
    // Live-as-you-type updates would fire one IPC call per keystroke
    // (e.g., listIndices/searchRules) since widgets typically run a
    // useEffect keyed on the userConfig prop. Per-keystroke API spam
    // is worse than an extra click.
    //
    // The committed snapshot — what's actually applied to the iframe
    // preview — is the parent's `values` prop. Local draft state is
    // independent until the user clicks Apply.
    const valueFor = React.useCallback(
        (fieldName, spec) => {
            if (
                values &&
                Object.prototype.hasOwnProperty.call(values, fieldName)
            ) {
                return values[fieldName];
            }
            if (
                defaults &&
                Object.prototype.hasOwnProperty.call(defaults, fieldName)
            ) {
                return defaults[fieldName];
            }
            if (spec && "defaultValue" in spec) return spec.defaultValue;
            return "";
        },
        [values, defaults]
    );

    // Initialize local draft from currently-effective values.
    const initialDraft = React.useMemo(() => {
        const draft = {};
        for (const [fieldName, spec] of fields) {
            draft[fieldName] = valueFor(fieldName, spec);
        }
        return draft;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userConfig]);

    const [localValues, setLocalValues] = React.useState(initialDraft);

    // Re-sync the local draft whenever the parent commits new values
    // (Apply, Reset, or external swap of userConfig). Non-dirty fields
    // pick up the latest effective value; dirty in-progress edits get
    // overwritten — by design, since the user just confirmed a commit
    // (or reset).
    React.useEffect(() => {
        const next = {};
        for (const [fieldName, spec] of fields) {
            next[fieldName] = valueFor(fieldName, spec);
        }
        setLocalValues(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values, defaults, userConfig]);

    const appliedSnapshot = React.useMemo(() => {
        const snap = {};
        for (const [fieldName, spec] of fields) {
            snap[fieldName] = valueFor(fieldName, spec);
        }
        return snap;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values, defaults, userConfig]);

    // All hooks above this line — early return goes BELOW so
    // useMemo / useEffect / useState always run in the same order
    // every render.
    if (fields.length === 0) return null;

    const valuesEqual = (a, b) => {
        const ak = Object.keys(a || {});
        const bk = Object.keys(b || {});
        if (ak.length !== bk.length) return false;
        for (const k of ak) {
            if (a[k] !== b[k]) return false;
        }
        return true;
    };

    const isDirtyLocal = !valuesEqual(localValues, appliedSnapshot);
    const hasAppliedOverrides = values && Object.keys(values).length > 0;

    const setLocal = (fieldName, value) => {
        setLocalValues((prev) => ({ ...prev, [fieldName]: value }));
    };

    const handleApply = () => {
        for (const [fieldName] of fields) {
            const localVal = localValues[fieldName];
            const appliedVal = appliedSnapshot[fieldName];
            if (localVal !== appliedVal) {
                onChange(fieldName, localVal);
            }
        }
    };

    return (
        <div
            className={`px-4 pt-2 pb-3 border-b ${bt.border} shrink-0 space-y-2`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-medium ${bt.muted}`}>
                    Test inputs
                    {isDirtyLocal && (
                        <span
                            className={`ml-2 ${bt.status.warning.icon} normal-case tracking-normal`}
                        >
                            • unapplied changes
                        </span>
                    )}
                </span>
                <div className="flex items-center gap-2">
                    {hasAppliedOverrides && (
                        <Button3
                            size="sm"
                            onClick={onReset}
                            title="Reset to defaults"
                        />
                    )}
                    <Button2
                        size="sm"
                        onClick={handleApply}
                        disabled={!isDirtyLocal}
                        testId="preview-test-inputs-apply"
                        title="Apply to preview"
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                {fields.map(([fieldName, spec]) => {
                    const label = spec.displayName || fieldName;
                    const v = localValues[fieldName];
                    const t = spec.type || "text";
                    const common = {
                        value: v == null ? "" : v,
                        onChange: (e) => setLocal(fieldName, e.target.value),
                        className: `flex-1 max-w-md px-2 py-1 ${bt.surface} border ${bt.border} rounded text-xs ${bt.text} focus:outline-none`,
                        "data-testid": `preview-test-input-${fieldName}`,
                    };
                    let input;
                    if (t === "boolean") {
                        input = (
                            <input
                                type="checkbox"
                                checked={Boolean(v)}
                                onChange={(e) =>
                                    setLocal(fieldName, e.target.checked)
                                }
                                className="w-4 h-4"
                            />
                        );
                    } else if (t === "textarea") {
                        input = <textarea rows={2} {...common} />;
                    } else if (t === "select" && Array.isArray(spec.options)) {
                        input = (
                            <select {...common}>
                                {spec.options.map((opt) => {
                                    const optVal =
                                        typeof opt === "object" && opt !== null
                                            ? opt.value
                                            : opt;
                                    const optLabel =
                                        typeof opt === "object" && opt !== null
                                            ? opt.displayName ||
                                              opt.label ||
                                              opt.value
                                            : opt;
                                    return (
                                        <option key={optVal} value={optVal}>
                                            {optLabel}
                                        </option>
                                    );
                                })}
                            </select>
                        );
                    } else if (t === "number") {
                        input = (
                            <input
                                type="number"
                                value={v == null ? "" : v}
                                onChange={(e) => {
                                    const n = e.target.value;
                                    setLocal(
                                        fieldName,
                                        n === "" ? "" : Number(n)
                                    );
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && isDirtyLocal) {
                                        e.preventDefault();
                                        handleApply();
                                    }
                                }}
                                className={common.className}
                            />
                        );
                    } else {
                        input = (
                            <input
                                type={t === "password" ? "password" : "text"}
                                {...common}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && isDirtyLocal) {
                                        e.preventDefault();
                                        handleApply();
                                    }
                                }}
                            />
                        );
                    }
                    return (
                        <label
                            key={fieldName}
                            className="flex items-center gap-2 text-xs"
                        >
                            <span
                                className={`${bt.muted} shrink-0`}
                                style={{ minWidth: "8rem" }}
                            >
                                {label}:
                            </span>
                            {input}
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

// Slice 17c.7 — `PreviewContextWrapper` and `PreviewErrorBoundary`
// were the inline-preview wrappers that mounted AI-generated widget
// code directly in the host React tree. They were replaced by the
// iframe-isolated preview path (slices 17c.1 — 17c.6) and removed
// here. The iframe shell now owns the equivalent context wrapping
// (AppContext, ThemeContext, DashboardContext, WidgetContext) inside
// its own React tree, and React error boundaries inside the iframe
// catch render errors that previously needed PreviewErrorBoundary on
// the host side.

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
 * Build a default `.dash.js` config literal for a widget whose code has
 * only the component. The category is injected later by handleInstall
 * once the user picks one.
 */
function synthesizeDefaultConfigCode(widgetName) {
    if (!widgetName) return "";
    const displayName = widgetName.replace(/([A-Z])/g, " $1").trim();
    return `export default {
    component: "${widgetName}",
    name: "${displayName}",
    package: "${displayName}",
    author: "AI Assistant",
    type: "widget",
    canHaveChildren: false,
    workspace: "ai-built",
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

/** Try to extract an existing category from a configCode string. */
function extractCategoryFromConfigCode(configCode) {
    if (!configCode) return null;
    const match = configCode.match(/category:\s*["']([^"']+)["']/);
    return match ? match[1] : null;
}

// The builder's frame inside the Create screen: fills Create's body.
const EmbeddedFrame = ({ children }) => (
    <div className="flex flex-col flex-1 min-h-0 w-full h-full">{children}</div>
);

// The builder as its own modal: one raised surface over the dimmed page
// (design guide, layout rule 2) — both panes sit on it, split by a hairline.
const BuilderModalFrame = ({ surfaceClass = "", children, ...modalProps }) => (
    <Modal {...modalProps}>
        <div
            className={`dr-modal-surface flex flex-col h-full w-full rounded-lg overflow-clip border ${surfaceClass}`}
        >
            {children}
        </div>
    </Modal>
);

// One tab over the preview (Preview / Code / Configure / Logs / Style
// checks): the design guide's underline tabs — the `dr-tab` hooks dash-core's
// tab bars use — with the theme's tokens outside Aurora.
const BuilderTab = ({
    active,
    onClick,
    icon,
    label,
    badge = null,
    disabled = false,
    title = undefined,
    testId = undefined,
    activeClass,
    idleClass,
}) => (
    <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onClick}
        disabled={disabled}
        title={title}
        data-testid={testId}
        className={`dr-tab ${
            active ? `dr-tab-active ${activeClass}` : idleClass
        } flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
    >
        <FontAwesomeIcon icon={icon} className="h-3 w-3" />
        {label}
        {badge}
    </button>
);

/**
 * A widget's category from its package manifest (dash.json): the widget's
 * own entry, else the package's. null when neither says.
 */
function categoryFromManifest(manifest, componentName) {
    if (!manifest || typeof manifest !== "object") return null;
    const bare = String(componentName || "")
        .split(".")
        .pop();
    const entry = (
        Array.isArray(manifest.widgets) ? manifest.widgets : []
    ).find((w) => w && w.name === bare);
    const category = (entry && entry.category) || manifest.category || null;
    return typeof category === "string" && category ? category : null;
}

export const WidgetBuilderModal = ({
    isOpen,
    setIsOpen,
    onInstalled,
    cellContext,
    editContext,
    // When non-null, the modal seeds itself from the saved draft
    // (composer tree + chat history + detected code) on mount.
    // Fired by Settings → Widgets when the user clicks Resume on a
    // Draft-chipped widget. Cleared on close so subsequent opens
    // start from a clean slate.
    resumeDraftId = null,
    // Rendered inside the Create screen (create-entry PRD CRE-005 AC1): the
    // same body without the builder's own modal frame and header — Create's
    // header (← Back, ×) stands in for them. Closing still goes through
    // setIsOpen(false), which the host maps to "finish, then close Create".
    embedded = false,
    // Create's leave guard (embedded): the builder registers a function
    // Create awaits before ← Back / × — it asks about unsaved work.
    setLeaveGuard = null,
}) => {
    // The modal renders outside DashboardStage's context tree, so
    // ThemeContext and AppContext are empty here. We bridge them via
    // window broadcasts from inside the tree:
    //   - previewThemeCtx → dashboard theme for the widget PREVIEW
    //                       (falls back to app-level theme when no
    //                       workspace is open — e.g. modal launched
    //                       from Settings → Widgets)
    //   - previewAppCtx   → providers/settings for MCP provider access
    //   - currentTheme    → the APP theme for the builder's own chrome
    const localThemeCtx = useContext(ThemeContext);
    const readBroadcastTheme = () =>
        (typeof window !== "undefined" &&
            (window.__dashThemeContext || window.__dashAppThemeContext)) ||
        null;
    const [previewTheme, setPreviewTheme] = useState(readBroadcastTheme);
    // The builder's own chrome follows the APP theme. This modal is
    // mounted outside the theme provider, so it reads the broadcast.
    const readAppTheme = () =>
        (typeof window !== "undefined" && window.__dashAppThemeContext) || null;
    const [appTheme, setAppTheme] = useState(readAppTheme);
    const [previewApp, setPreviewApp] = useState(
        () => window.__dashAppContext || null
    );
    useEffect(() => {
        const themeHandler = () => {
            const next = readBroadcastTheme();
            if (next) setPreviewTheme({ ...next });
            const app = readAppTheme();
            if (app) setAppTheme({ ...app });
        };
        const appHandler = () => setPreviewApp({ ...window.__dashAppContext });
        window.addEventListener("dash:theme-changed", themeHandler);
        window.addEventListener("dash:app-context-changed", appHandler);
        return () => {
            window.removeEventListener("dash:theme-changed", themeHandler);
            window.removeEventListener("dash:app-context-changed", appHandler);
        };
    }, []);
    const previewThemeCtx = previewTheme || localThemeCtx;
    const chatThemeCtx = appTheme || localThemeCtx;
    const previewAppCtx = previewApp || null;
    const currentTheme = chatThemeCtx?.currentTheme;
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
    // Slice 17c.2 — the raw esbuild bundle source string + the
    // component name the iframe should mount. Populated by the
    // compile pipeline alongside `previewComponent`. Only consumed
    // when the iframe-preview feature flag is on.
    const [previewBundleSource, setPreviewBundleSource] = useState(null);
    const [previewBundleComponentName, setPreviewBundleComponentName] =
        useState(null);
    // Slice 17c.4 — receive iframe-side errors and surface them
    // through the existing previewError UI. The shell posts every
    // error kind (`uncaught`, `unhandled-rejection`, `bundle-eval`,
    // `mount`, `no-component`, etc.) via `bridge:error`; we collapse
    // them into a friendly message + meta for the error box.
    // Slice 17c.5 — the iframe shell measures its own DOM and posts text
    // length + descendant count via `bridge:render-stats`; a widget that
    // mounted but shows nothing (usually a wrong prop name, e.g. `text=`
    // on Heading) gets a hint instead of a blank canvas.
    const handleIframeRenderStats = useCallback((payload) => {
        const textLength =
            (payload && typeof payload.textLength === "number"
                ? payload.textLength
                : 0) | 0;
        const childCount =
            (payload && typeof payload.childCount === "number"
                ? payload.childCount
                : 0) | 0;
        setPreviewLooksEmpty(textLength === 0 && childCount <= 1);
    }, []);
    const handleIframePreviewError = useCallback((payload) => {
        const kind = (payload && payload.kind) || "iframe-runtime";
        const message =
            (payload && payload.message) || "Widget runtime error in iframe";
        const stack = (payload && payload.stack) || null;
        const friendly = `Widget preview error (${kind}): ${message}`;
        setPreviewError(friendly);
        setPreviewErrorMeta({
            kind: "iframe-error",
            iframeErrorKind: kind,
            message,
            stack,
        });
    }, []);
    // True when the compiled widget mounted but rendered no visible text.
    const [previewLooksEmpty, setPreviewLooksEmpty] = useState(false);
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
    // Resolved config object from the most recent successful preview
    // compile. The Configure tab reads from this directly so its form
    // populates with the AI's actual userConfig / providers / events
    // — same source the runtime renderer uses, no source-string drift.
    const [previewParsedConfig, setPreviewParsedConfig] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    // Test-inputs form state (slice 17b.9). One key per userConfig
    // field — the user types values here to exercise the previewed
    // widget with real data without leaving the modal. Reset when
    // a new config compiles so a stale value from a previous widget
    // doesn't leak into the new one.
    const [previewTestInputs, setPreviewTestInputs] = useState({});
    // Slice 17b: surfaces the main process's "we adjusted the AI's provider
    // config to match your installed provider" rewrite. Cleared whenever
    // a fresh compile starts so the banner doesn't linger after the AI
    // gets it right.
    // Structured error metadata from the main process (e.g. an
    // ESBUILD_SPAWN_FAILED with diagnostics). When present we render an
    // expanded diagnostics block under the error message — this is what
    // turns "spawn ENOENT" from a dead end into something the user (or
    // we) can act on. Cleared whenever previewError is cleared.
    const [previewErrorMeta, setPreviewErrorMeta] = useState(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [installStatus, setInstallStatus] = useState(null);
    // Slice 17d.2 — install-time permission gate. When the AI's
    // generated widget calls credentialed provider methods, we
    // pause the install flow, show the permission modal, and only
    // proceed once the user has explicitly granted (or denied)
    // each method. `pendingInstallContext` stores the original
    // install parameters so the actual install can resume after
    // the user's decision.
    const [pendingInstallContext, setPendingInstallContext] = useState(null);
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
    // A typed widget name not committed yet (Enter / leaving the field
    // commits it): Install waits, or it would install the old name
    // (consolidation Phase 4d).
    const [namePending, setNamePending] = useState(false);
    // Editable widget name for remixes — defaults to <Original>Remix
    const [remixName, setRemixName] = useState("");
    // "update" = overwrite original in-place, "remix" = create new copy
    const [editMode, setEditMode] = useState("remix");
    // The edit's mode (update or remix) has been set from ownership for
    // this edit — checks wait for it (the default "remix" is a placeholder).
    const [editModeSettled, setEditModeSettled] = useState(false);

    // ── Drafts state ──────────────────────────────────────────────
    // viewMode: "drafts" → show the WidgetDraftsList entry view.
    //           "builder" → show the existing chat + preview UI.
    // The modal opens in "drafts" if there are any saved drafts AND
    // we aren't in remix mode (remix mode bypasses the list — the
    // user clicked Remix on a specific widget, not Build New). The
    // open-time decision happens in a one-shot effect below.
    // Starts null so the initial render doesn't flash the empty builder UI
    // before the async drafts check resolves. The drafts-gate useEffect
    // (~line 2099) sets this to "drafts" or "builder" once it knows.
    const [viewMode, setViewMode] = useState(null);
    // Current draft session id. Generated lazily on the first
    // parseable AI response; reused across saves within the same
    // session so we update one row, not pile up. Cleared on close /
    // install / new-chat.
    const draftSessionIdRef = useRef(null);
    // Schema metadata for the draft we resumed from (if any), so the
    // first save reuses its id rather than creating a duplicate row.
    const resumedDraftRef = useRef(null);
    // Registry auth — used to determine ownership for update vs remix
    const [registryUsername, setRegistryUsername] = useState(null);
    const [registryChecked, setRegistryChecked] = useState(false);
    // Monotonic request counter — bumped at the start of every compile
    // request so in-flight IPCs know if they've been superseded. Used to
    // ignore stale results when edits come quickly.
    const compileRequestIdRef = useRef(0);
    const [activeTab, setActiveTab] = useState("preview");
    // Console events from the widget under preview. Captured by
    // widgetConsoleCapture (see useEffect below). Cleared on each new
    // compile so the user sees only output relevant to the current
    // bundle. Append-only during a session — bounded to 500 entries
    // to keep the renderer responsive even with chatty widgets.
    const [consoleEvents, setConsoleEvents] = useState([]);
    const consoleEventsRef = useRef([]);
    const appendConsoleEvent = useCallback((evt) => {
        const next = consoleEventsRef.current.concat([evt]);
        // Drop oldest entries when over the cap.
        const trimmed =
            next.length > 500 ? next.slice(next.length - 500) : next;
        consoleEventsRef.current = trimmed;
        setConsoleEvents(trimmed);
    }, []);
    const clearConsoleEvents = useCallback(() => {
        consoleEventsRef.current = [];
        setConsoleEvents([]);
    }, []);

    // Acceptance scorecard counts — fed by the static-analysis pass
    // over the AI-generated widget source. Drives the Scorecard tab
    // badge (red count when ✗ items > 0). Recomputed only when the
    // emitted componentCode changes; for a 200-line widget the regex
    // pass is sub-millisecond, but memoizing keeps it off the render
    // hot path.
    const scorecardRows = useMemo(() => {
        if (!detectedCode?.componentCode) return [];
        return evaluateScorecard(detectedCode.componentCode);
    }, [detectedCode?.componentCode]);
    const scorecardFailCount = scorecardRows.filter(
        (r) => r.pass === false
    ).length;

    // Surface auto-save activity in the build view: timestamp of the
    // last successful draft save + transient state so the user sees
    // their work is being persisted.
    const [draftLastSavedAt, setDraftLastSavedAt] = useState(null);
    const [draftSaveState, setDraftSaveState] = useState("idle"); // "idle" | "saving" | "saved" | "error"
    const [openingEditor, setOpeningEditor] = useState(false);
    const [editorOpenError, setEditorOpenError] = useState(null);

    // Provider-picker change feedback. When the user picks a different
    // provider, briefly flag that type so the picker can show a "Now
    // using <name> — preview reloaded" caption next to the dropdown.
    // Auto-clears after a short delay.
    const [providerJustChanged, setProviderJustChanged] = useState(null);
    const providerChangedTimerRef = useRef(null);
    const flagProviderChange = useCallback((type, name) => {
        if (providerChangedTimerRef.current) {
            clearTimeout(providerChangedTimerRef.current);
        }
        setProviderJustChanged({ type, name, at: Date.now() });
        providerChangedTimerRef.current = setTimeout(() => {
            setProviderJustChanged(null);
            providerChangedTimerRef.current = null;
        }, 3000);
    }, []);
    useEffect(() => {
        return () => {
            if (providerChangedTimerRef.current) {
                clearTimeout(providerChangedTimerRef.current);
            }
        };
    }, []);

    const [activeFile, setActiveFile] = useState("component");
    // The code editor measures itself once, when it mounts; opened straight
    // on the Code tab it mounts while the window is still animating in and
    // shows a sliver. Remount it once the window has settled.
    const [editorLayoutKey, setEditorLayoutKey] = useState(0);
    useEffect(() => {
        if (!isOpen) return undefined;
        const t = setTimeout(() => setEditorLayoutKey((k) => k + 1), 400);
        return () => clearTimeout(t);
    }, [isOpen]);
    // Local edit-context override, from a resumed draft of an edit (its
    // editOf). Mirrors the shape of the prop editContext so the rest of the
    // modal (install path, update/remix footer, compilePreview
    // sourcePackage) reads a single "effective" context.
    const [editContextOverride, setEditContextOverride] = useState(null);
    const effectiveEditContext = editContextOverride || editContext;
    const isRemixMode = !!effectiveEditContext?.originalWidgetId;

    // A resumed draft with code but no Compose grid (an old chat draft) is
    // edited as code: Compose would replace it with an empty layout.
    const [codeOnly, setCodeOnly] = useState(false);
    // Compose's layout, persisted in the draft alongside the code. A
    // resumed draft seeds the pane, remounted via composerSessionKey.
    const [composerSessionKey, setComposerSessionKey] = useState(0);
    const [composerGrid, setComposerGrid] = useState(null);
    // Seeds the V2 pane when a Compose draft is resumed (remounted via
    // composerSessionKey).
    const [composerInitialGrid, setComposerInitialGrid] = useState(null);
    const composerGridRef = useRef(null);
    useEffect(() => {
        composerGridRef.current = composerGrid;
    }, [composerGrid]);
    // Selected composer node, lifted out of the composer so the
    // preview iframe's click-to-pick can drive the composer's
    // inspector. Also lets us pass the current selection back into
    // the iframe so the highlighted outline stays in sync when the
    // user picks a node in the composition tree.
    const [composerSelectedNodeId, setComposerSelectedNodeId] = useState(null);
    // User's explicit provider selection for the preview, keyed by the
    // widget-declared provider type (e.g. { algolia: "My Algolia Account" }).
    // Passed through to PreviewContextWrapper so the widget sees a real
    // provider and renders its live UX. When editing a widget this is
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

    // Pre-fill the preview's test-input form from the dashboard
    // widget's saved userPrefs whenever a new Edit-with-AI context
    // opens. Without this the user re-types every field (path,
    // query, refresh interval, etc.) they already configured on
    // the live dashboard instance — the editContext carries those
    // values through verbatim, so consuming them here is a pure
    // ergonomic win. The compile-driven prune at the bottom of
    // compilePreview keeps only keys the new userConfig schema
    // still declares, so a stale prefs key from the original widget
    // won't haunt the preview if the user's edit drops a field.
    React.useEffect(() => {
        if (
            effectiveEditContext?.userPrefs &&
            typeof effectiveEditContext.userPrefs === "object"
        ) {
            setPreviewTestInputs({ ...effectiveEditContext.userPrefs });
        } else {
            setPreviewTestInputs({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveEditContext?.originalWidgetId]);

    // Augment the preview's provider selection with global-default
    // fallbacks once the parsed config arrives. The dashboard
    // widget instance's `selectedProviders` only carries per-
    // instance overrides — when it's empty (or missing entries for
    // some required types), the live runtime falls through to the
    // global `isDefaultForType: true` provider for that type
    // (see useMcpProvider.js resolution chain). The preview needs
    // to mirror that fallback so the user sees the same provider
    // their dashboard widget is actually using, not an empty
    // dropdown with the misleading impression that nothing's wired.
    React.useEffect(() => {
        if (!effectiveEditContext?.originalWidgetId) return;
        if (
            !previewParsedConfig?.providers ||
            !Array.isArray(previewParsedConfig.providers)
        )
            return;
        const appProvs = previewAppCtx?.providers;
        if (!appProvs || typeof appProvs !== "object") return;
        const requiredTypes = previewParsedConfig.providers
            .filter((p) => p && p.required !== false && p.type)
            .map((p) => p.type);
        if (requiredTypes.length === 0) return;
        setPreviewProviderSelection((prev) => {
            const next = { ...(prev || {}) };
            let changed = false;
            for (const type of requiredTypes) {
                if (next[type]) continue;
                // Walk appProviders for a default of this type.
                for (const [name, data] of Object.entries(appProvs)) {
                    if (
                        data &&
                        data.type === type &&
                        data.isDefaultForType === true
                    ) {
                        next[type] = name;
                        changed = true;
                        break;
                    }
                }
            }
            return changed ? next : prev;
        });
    }, [
        effectiveEditContext?.originalWidgetId,
        previewParsedConfig,
        previewAppCtx,
    ]);

    // Device-code sign-in flow for the registry. When the user clicks
    // "Sign in" (to update their own widgets in place), we stash the flow
    // here so we can display the user code + poll for completion.
    const [signInFlow, setSignInFlow] = useState(null);
    const signInPollRef = useRef(null);

    // The modal renders OUTSIDE the AppWrapper tree, so the in-tree
    // `appContext` is empty — the real providers/settings arrive via the
    // window bridge (previewAppCtx = window.__dashAppContext). Read from the
    // bridge first so the composer's provider picker sees the user's
    // configured providers (incl. custom MCP). Fall back to appContext when
    // the bridge is absent (e.g. tests).
    const providers = previewAppCtx?.providers || appContext?.providers || {};
    // The builder's chrome follows the APP theme (chatThemeCtx).
    const tk = (key) => currentTheme?.[key] || "";
    const bgDark = tk("bg-primary-dark");
    const borderColor = tk("border-primary-dark");
    // Muted text is a token, never opacity (design guide).
    const chromeMuted = tk("text-primary-medium");
    const accentText = tk("text-secondary-medium");
    // Underline tabs over the preview (BuilderTab).
    const tabActive = `${tk("text-primary-light")} ${tk(
        "border-secondary-medium"
    )}`;
    const tabIdle = `${tk("text-primary-medium")} border-transparent`;
    const status = getStatusColors(chatThemeCtx?.themeVariant || "dark");
    const bt = builderTheme(chatThemeCtx);
    const codeChip = `px-1 rounded font-mono ${tk("bg-primary-very-dark")}`;

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

    // Ownership boundary — gates the Update Original toggle. The
    // derivation lives in dash-core (utils/widgetOwnership.js) so its security-relevant
    // rules can be unit-tested directly instead of through the
    // modal's render tree. See widgetOwnership.test.js for the
    // negative-space coverage (substring matches, Unicode
    // lookalikes, whitespace, null/empty input, etc.) that must
    // stay green for this UI to remain safe.
    const { widgetScope, isOwner } = deriveWidgetOwnership({
        originalPackage: effectiveEditContext?.originalPackage,
        originalComponentName: effectiveEditContext?.originalComponentName,
        registryUsername,
    });

    // Slice 19G.2 — host-side console / error capture is OBSOLETE.
    // Widgets render in an isolated iframe (slice 17c+); the host
    // window's console.* and window.error never see widget-scoped
    // events. The Console tab is now driven entirely by
    // `bridge:console` events forwarded from inside the iframe via
    // <PreviewIframe onConsoleEvent={appendConsoleEvent} />, wired
    // below where PreviewIframe is rendered. The
    // installWidgetConsoleCapture import + tests stay (they're still
    // useful for any future inline-rendering surface), but production
    // installs nothing on the host.

    // On open: decide whether to show the Drafts list or jump straight
    // into the builder. Skip the list in remix mode (the user clicked
    // Remix on a specific widget — they don't want a chooser) and in
    // edit mode (an existing widget is being modified). Otherwise, if
    // any drafts exist, show the list as the entry view. Always reset
    // the per-session draft id so the next save creates a NEW draft
    // unless the user clicks Resume on the list.
    useEffect(() => {
        if (!isOpen) {
            draftSessionIdRef.current = null;
            resumedDraftRef.current = null;
            setSavedCode(null);
            setLeavePrompt(null);
            setEditModeSettled(false);
            setCodeOnly(false);
            // Reset to loading sentinel so the next open shows the loading
            // skeleton instead of whatever view was active when last closed.
            setViewMode(null);
            return;
        }
        if (effectiveEditContext || resumeDraftId) {
            // Editing a widget, or a draft picked to continue — skip the
            // drafts gate. (With a draft, the list would race
            // resumeFromDraft and could land on the list instead.)
            setViewMode("builder");
            return;
        }
        // Reset to loading on every open so we don't briefly show the
        // previous view's leftover state before the async check resolves.
        setViewMode(null);
        let cancelled = false;
        (async () => {
            try {
                const list = (await window.mainApi?.drafts?.list?.()) || [];
                if (cancelled) return;
                if (Array.isArray(list) && list.length > 0) {
                    setViewMode("drafts");
                } else {
                    setViewMode("builder");
                }
            } catch {
                if (!cancelled) setViewMode("builder");
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Save the in-flight widget as a draft — only when the user asks
    // (Save as draft, or Save as draft when leaving with unsaved work), so
    // drafts don't pile up. We persist the latest code and the Compose
    // layout, so resuming picks up where the user left off. Same
    // session = same draft id (one row updated, not piled up). The
    // first save of a session generates the id; subsequent saves
    // reuse it via draftSessionIdRef. A draft we resumed from reuses
    // its id via resumedDraftRef so we don't duplicate the row. An
    // edit's draft remembers what it edits (editOf). → whether it saved.
    const saveDraft = useCallback(async () => {
        if (!detectedCode?.componentCode) return;
        // Compose's empty placeholder isn't worth a draft.
        if (detectedCode.emptyGrid) return;
        let id = draftSessionIdRef.current;
        if (!id) {
            id =
                resumedDraftRef.current?.id ||
                `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            draftSessionIdRef.current = id;
        }
        const componentName =
            extractWidgetName(detectedCode.componentCode) || null;
        const draftName = componentName || "Untitled draft";
        // Build the files[] payload for the main process to
        // materialize on disk. Synthesize a 2-entry array if the AI's
        // multi-file payload was empty (legacy single-file response).
        let files = Array.isArray(detectedCode.files)
            ? detectedCode.files.slice()
            : [];
        if (files.length === 0 && componentName && detectedCode.componentCode) {
            files = [
                {
                    path: `widgets/${componentName}.js`,
                    content: detectedCode.componentCode,
                },
            ];
            if (detectedCode.configCode) {
                files.push({
                    path: `widgets/${componentName}.dash.js`,
                    content: detectedCode.configCode,
                });
            }
        }
        const draft = {
            id,
            name: draftName,
            componentName,
            mode: "compose",
            // Editing an installed widget: what it edits, so resuming
            // the draft edits that widget again.
            editOf: effectiveEditContext
                ? {
                      originalPackage:
                          effectiveEditContext.originalPackage || null,
                      originalComponentName:
                          effectiveEditContext.originalComponentName || null,
                      originalWidgetId:
                          effectiveEditContext.originalWidgetId || null,
                      manifest: effectiveEditContext.manifest || null,
                  }
                : null,
            // Compose persistence: resuming restores the composer to the
            // user's last layout (not just the emitted code).
            composerGrid: composerGridRef.current || null,
        };
        // Pass files alongside so the main process materializes them
        // under @ai-built/<name>-draft-<id>/ and stamps packageDir
        // onto the draft entry. Track save state on the parent so the
        // toolbar's "Saving / Saved Xs ago" indicator can render.
        setDraftSaveState("saving");
        try {
            await window.mainApi?.drafts?.save?.(draft, files);
            setDraftSaveState("saved");
            setDraftLastSavedAt(Date.now());
            setSavedCode({
                componentCode: detectedCode.componentCode,
                configCode: detectedCode.configCode || "",
            });
            return true;
        } catch (err) {
            console.warn("[WidgetBuilder] draft save failed:", err);
            setDraftSaveState("error");
            return false;
        }
    }, [effectiveEditContext, detectedCode]);

    // Unsaved work: code that differs from what was last kept — the
    // installed widget being edited, a resumed or saved draft, or an
    // install. Compose's empty grid isn't work.
    const [savedCode, setSavedCode] = useState(null);
    const hasUnsavedWork =
        !!detectedCode?.componentCode &&
        !detectedCode.emptyGrid &&
        !installStatus?.success &&
        (!savedCode ||
            savedCode.componentCode !== detectedCode.componentCode ||
            (savedCode.configCode || "") !== (detectedCode.configCode || ""));
    const hasUnsavedWorkRef = useRef(false);
    hasUnsavedWorkRef.current = hasUnsavedWork;

    // Leaving with unsaved work asks: Save as draft / Discard / Keep
    // editing. → whether to leave.
    const [leavePrompt, setLeavePrompt] = useState(null);
    const leavePromptRef = useRef(null);
    leavePromptRef.current = leavePrompt;
    const askLeave = useCallback(
        () => new Promise((resolve) => setLeavePrompt({ resolve })),
        []
    );
    const answerLeave = useCallback(
        async (choice) => {
            const prompt = leavePrompt;
            if (!prompt) return;
            let leave = choice === "discard";
            if (choice === "save") leave = (await saveDraft()) === true;
            setLeavePrompt(null);
            prompt.resolve(leave);
        },
        [leavePrompt, saveDraft]
    );
    const requestClose = useCallback(async () => {
        if (leavePromptRef.current) return;
        if (hasUnsavedWorkRef.current && !(await askLeave())) return;
        setIsOpen(false);
    }, [askLeave, setIsOpen]);
    // The builder window's own dismissal (outside click, Escape): the same
    // check. A click on the prompt is "outside" the window, so while the
    // prompt is up the window stays.
    const dismissFrame = useCallback(
        (open) => {
            if (open) setIsOpen(true);
            else requestClose();
        },
        [setIsOpen, requestClose]
    );
    // Inside Create: Create's ← Back and × wait for this.
    useEffect(() => {
        if (typeof setLeaveGuard !== "function") return undefined;
        // While the prompt is up, Create's own dismissal (a click on the
        // prompt counts as outside its window) waits.
        setLeaveGuard(() =>
            leavePromptRef.current
                ? false
                : hasUnsavedWorkRef.current
                ? askLeave()
                : true
        );
        return () => setLeaveGuard(null);
    }, [setLeaveGuard, askLeave]);

    // Probe esbuild / the @ai-built dir on every modal open so
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

    const healthCheckIssues = healthCheck
        ? [
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

    // Isolate widget-preview runtime errors so buggy widget code can't
    // crash the rest of the app. React's
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

    // Pre-load source code for remix/edit mode
    useEffect(() => {
        if (editContext?.componentCode && isOpen) {
            const code = {
                componentCode: editContext.componentCode,
                configCode: editContext.configCode || "",
            };
            setDetectedCode(code);
            // "Edit the code yourself" opens on the code (consolidation
            // Phase 3b); the preview compiles meanwhile, one tab away.
            setActiveTab("code");
            compilePreview(code).catch(() => {});

            // Nothing's changed yet: the installed code is what's kept.
            setSavedCode({
                componentCode: editContext.componentCode || "",
                configCode: editContext.configCode || "",
            });

            // Pre-fill the category picker from the original config (else
            // its package's manifest) so the user can install without
            // re-picking. Falls through to null when neither says: then the
            // user picks one (the registry organizes widgets by category).
            const existing =
                extractCategoryFromConfigCode(editContext.configCode) ||
                categoryFromManifest(
                    editContext.manifest,
                    editContext.originalComponentName
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
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editContext, isOpen]);

    // Set default edit mode once ownership is determined
    useEffect(() => {
        if (!isRemixMode || !registryChecked) return;
        setEditMode(isOwner ? "update" : "remix");
        setEditModeSettled(true);
    }, [isRemixMode, isOwner, registryChecked]);

    const compilePreview = useCallback(
        async (code, sourcePackageOverride = null) => {
            const name = extractWidgetName(code.componentCode);
            if (!code.componentCode) return;
            if (!name) {
                // Can't tell which component to mount — say so, never a
                // silent stall.
                setPreviewComponent(null);
                setPreviewErrorMeta(null);
                setPreviewError(
                    "Couldn't find the widget's component in the code. It needs a named, exported component, for example `export default function MyWidget() { … }`."
                );
                return;
            }

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
            // Console output from a previous bundle is no longer
            // relevant to the new compile — clear so the user only
            // sees output for the widget they're currently looking at.
            clearConsoleEvents();

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
                        // pass a per-call override.
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
                        // No provider pick to correct the config to.
                        null
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
                    // Preserve typed test-input values whose key still
                    // exists in the new userConfig schema; drop only
                    // keys the new schema doesn't have. Recompile fires
                    // on every grid edit / streamed-AI keystroke, so a
                    // blanket reset wiped values the user had just typed
                    // into unrelated fields (e.g. editing a Heading
                    // would clear the `indexName` they entered for the
                    // SearchInput's Algolia wire).
                    setPreviewTestInputs((prev) => {
                        const next = {};
                        for (const key of Object.keys(prev || {})) {
                            if (
                                Object.prototype.hasOwnProperty.call(
                                    userConfig,
                                    key
                                )
                            ) {
                                next[key] = prev[key];
                            }
                        }
                        return next;
                    });

                    // Provider API hallucination guardrail (slice
                    // 17b.12). Walk the AI's component code looking
                    // for `window.mainApi.<service>.<method>(` calls
                    // where <method> isn't in the registry. If the
                    // AI invented a method (e.g. algolia.getRules,
                    // saveRule, deleteRule), set previewError with
                    // a corrective message instead of mounting a
                    // widget that's guaranteed to fail at runtime.
                    // Use `code.componentCode` (the param) rather than
                    // `detectedCode.componentCode` (closed-over state) so
                    // we don't need to add detectedCode to this
                    // useCallback's deps — recompiling the callback on
                    // every keystroke during streaming is unnecessary.
                    const componentSrc = code.componentCode || "";

                    // Slice 17b.13: widgets must not contain Modal /
                    // Dialog / Drawer chrome. Run BEFORE the provider-
                    // API check so a Modal-using widget surfaces the
                    // single-purpose rule first (it's the more
                    // architectural fix; the prop-API hallucination
                    // is downstream of choosing the wrong shape).
                    // TD-005: widgets never start bots themselves — Dash
                    // refuses to install one that does, so stop it here.
                    const botCheck = validateNoBotCalls(componentSrc);
                    if (!botCheck.ok) {
                        setPreviewError(
                            "Widget starts a bot directly, which widgets may not do:\n" +
                                botCheck.errors
                                    .map(
                                        (e) =>
                                            `\`${e.snippet}\` (line ${e.line})`
                                    )
                                    .join("\n") +
                                "\n\nMake it an action widget that publishes an event instead (Code tab)."
                        );
                        setPreviewErrorMeta({
                            kind: "bot-call-in-widget",
                            errors: botCheck.errors,
                        });
                        setPreviewComponent(null);
                        setPreviewParsedConfig(match.config);
                        return;
                    }

                    // Events published with api.publishEvent go out
                    // unprefixed, so no bot or widget hears them (4d-2).
                    const publishCheck = validateEventPublishing(componentSrc);
                    if (!publishCheck.ok) {
                        setPreviewError(
                            "Widget publishes with api.publishEvent, so no bot or widget hears its events:\n" +
                                publishCheck.errors
                                    .map(
                                        (e) =>
                                            `\`${e.snippet}\` (line ${e.line})`
                                    )
                                    .join("\n") +
                                "\n\nPublish with useWidgetEvents instead (Code tab)."
                        );
                        setPreviewErrorMeta({
                            kind: "raw-publish-in-widget",
                            errors: publishCheck.errors,
                        });
                        setPreviewComponent(null);
                        setPreviewParsedConfig(match.config);
                        return;
                    }

                    const modalCheck = validateNoModalUsage(componentSrc);
                    if (!modalCheck.ok) {
                        const list = modalCheck.errors
                            .map(
                                (e) =>
                                    `\`<${e.tag}>\` (line ${e.line}) — ${e.suggestion}`
                            )
                            .join("\n");
                        setPreviewError(
                            "Widget uses popup chrome that's forbidden inside widgets:\n" +
                                list +
                                "\n\nFix it in the Code tab."
                        );
                        setPreviewErrorMeta({
                            kind: "modal-in-widget",
                            errors: modalCheck.errors,
                        });
                        setPreviewComponent(null);
                        setPreviewParsedConfig(match.config);
                        return;
                    }

                    const apiCheck = validateProviderApiUsage(componentSrc);
                    if (!apiCheck.ok) {
                        const list = apiCheck.errors
                            .map(
                                (e) =>
                                    `\`mainApi.${e.service}.${e.method}\` (line ${e.line}) — try: ${e.suggestion}`
                            )
                            .join("\n");
                        setPreviewError(
                            "Widget calls provider methods that don't exist:\n" +
                                list +
                                "\n\nFix it in the Code tab."
                        );
                        setPreviewErrorMeta({
                            kind: "provider-api-hallucination",
                            errors: apiCheck.errors,
                        });
                        setPreviewComponent(null);
                        setPreviewParsedConfig(match.config);
                        return;
                    }

                    // Slice 19G — catch hallucinated / typo'd JSX
                    // component names BEFORE the iframe tries to
                    // render. React's "Element type is invalid" error
                    // shows up deep in the reconciler with no
                    // line-pointer; a static check on the source
                    // gives the user a clean "<Bogus> doesn't exist"
                    // message.
                    const componentCheck =
                        validateComponentReferences(componentSrc);
                    if (!componentCheck.ok) {
                        const list = componentCheck.errors
                            .map(
                                (e) =>
                                    `\`<${e.name}>\` (line ${e.line}) — ${e.suggestion}`
                            )
                            .join("\n");
                        setPreviewError(
                            "Widget uses component names that don't exist:\n" +
                                list +
                                "\n\nFix it in the Code tab."
                        );
                        setPreviewErrorMeta({
                            kind: "component-name-hallucination",
                            errors: componentCheck.errors,
                        });
                        setPreviewComponent(null);
                        setPreviewParsedConfig(match.config);
                        return;
                    }

                    // Let PreviewErrorBoundary catch runtime errors in React's context
                    setPreviewComponent(() => match.config.component);
                    // Slice 17c.2 — also store the raw bundle source +
                    // component name so the iframe-preview path can
                    // ship them to the iframe when the flag is on.
                    // Inline path doesn't read these; cost of carrying
                    // them is one extra setState per compile.
                    setPreviewBundleSource(result.bundleSource);
                    setPreviewBundleComponentName(match.key || name);
                    // Render-stats flip this back if it really is empty.
                    setPreviewLooksEmpty(false);
                    // Hand the resolved config to the Configure tab so
                    // its form reflects what the AI actually generated
                    // (string-parsing the .dash.js source breaks on
                    // imports + identifier component refs).
                    setPreviewParsedConfig(match.config);
                    setPreviewError(null);
                } else {
                    setPreviewWidgetDefaults({});
                    setPreviewTestInputs({});
                    setPreviewParsedConfig(null);
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
        [effectiveEditContext?.originalPackage, clearConsoleEvents]
    );

    // Checked while it's written (Widget Builder edit fixes; draftCheck.js):
    // each new version that compiles gets the fast checks — built inside its
    // package, code checks, must-fix checklist — then the Dash team's
    // Checker on it as draft:<Name>. Problems are listed for the user to fix
    // by hand (consolidation Phase 3b). Install waits for a pass of this
    // exact code.
    const [draftCheck, setDraftCheck] = useState(null);
    const draftCheckRef = useRef(null);
    draftCheckRef.current = draftCheck;
    const checkRunRef = useRef(0);
    // "Check again" after a check that couldn't run.
    const [checkAttempt, setCheckAttempt] = useState(0);
    const retryCheck = useCallback(() => {
        checkRunRef.current += 1;
        setDraftCheck(null);
        setCheckAttempt((n) => n + 1);
    }, []);
    const currentCodeKey = codeKeyOf(detectedCode);
    // A new widget needs a name of the user's (Compose starts with a
    // placeholder one) — nothing is checked or installed before it has one.
    const needsName =
        !isRemixMode && (!widgetName || /^ComposedWidget\d*$/.test(widgetName));
    const editedName = (effectiveEditContext?.originalComponentName || "")
        .split(".")
        .pop();
    // The name the code is checked (and, for an update, installed) under.
    const checkName =
        isRemixMode &&
        editMode === "update" &&
        editedName &&
        editedName !== "ComposedWidget"
            ? editedName
            : widgetName;
    // Update original with nothing changed yet: nothing to save, so
    // nothing to check (a remix can be installed unchanged, so it is).
    const unchangedUpdate =
        isRemixMode &&
        editMode === "update" &&
        !!effectiveEditContext?.componentCode &&
        effectiveEditContext.componentCode === detectedCode?.componentCode &&
        (effectiveEditContext.configCode || "") ===
            (detectedCode?.configCode || "");
    const checkPassed =
        !unchangedUpdate &&
        !!draftCheck &&
        draftCheck.key === currentCodeKey &&
        draftCheck.phase === "passed";
    useEffect(() => {
        if (!isOpen || !currentCodeKey || detectedCode?.emptyGrid) return;
        if (isCompiling || previewError || !previewComponent) return;
        if (installStatus?.success || !checkName) return;
        // Update or remix isn't known until ownership is checked.
        if (isRemixMode && !editModeSettled) return;
        if (unchangedUpdate || needsName) {
            // A check that no longer applies is dropped.
            checkRunRef.current += 1;
            if (draftCheckRef.current) setDraftCheck(null);
            return;
        }
        if (draftCheckRef.current?.key === currentCodeKey) return;
        const key = currentCodeKey;
        const name = checkName;
        const run = ++checkRunRef.current;
        const stale = () => run !== checkRunRef.current;
        const code = detectedCode;
        // What's wrong, for the user to fix in the Code tab.
        const fail = (lines, review) =>
            setDraftCheck({ key, phase: "failed", lines, review });
        // Built by hand, the code changes with every edit: check it once
        // it has settled for a moment, not on each one.
        let timer = null;
        const start = async () => {
            setDraftCheck({ key, phase: "checking" });
            let result;
            try {
                result = await window.mainApi?.widgetBuilder?.checkDraft?.({
                    widgetName: name,
                    componentCode: code.componentCode,
                    configCode: code.configCode || "",
                    sourcePackage:
                        effectiveEditContext?.originalPackage || null,
                    // Helper files beside the widget are built with it.
                    files: code.files || [],
                });
            } catch (err) {
                result = { success: false, error: err?.message || String(err) };
            }
            if (stale()) return;
            // A check that couldn't run isn't a pass (consolidation
            // Phase 1a) — it can be run again.
            if (result === undefined) {
                setDraftCheck({
                    key,
                    phase: "failed",
                    lines: ["The checks aren't available here."],
                    canRetry: true,
                });
                return;
            }
            const lines = fastCheckProblems(result);
            if (lines.length) {
                fail(lines, null);
                return;
            }
            setDraftCheck({ key, phase: "reviewing" });
            // Built by hand: no request to hold it to, only the widget.
            const res = await runTeamRole(
                "checker",
                draftCheckRequest(name, "")
            );
            if (stale()) return;
            // Only a paused or missing Checker skips its review.
            if (res.skipped && (!res.bot || res.bot.paused)) {
                setDraftCheck({
                    key,
                    phase: "passed",
                    reviewSkipped: res.reason,
                });
                return;
            }
            // The Checker is still on an earlier version: try again shortly.
            if (res.skipped && /in progress/i.test(String(res.reason || ""))) {
                setTimeout(() => {
                    if (!stale()) retryCheck();
                }, 4000);
                return;
            }
            if (res.skipped) {
                setDraftCheck({
                    key,
                    phase: "failed",
                    lines: [`The Checker didn't run (${res.reason}).`],
                    canRetry: true,
                });
                return;
            }
            const verdict = verdictOf(res.output);
            if (verdict === "PASSED") {
                setDraftCheck({ key, phase: "passed" });
                return;
            }
            if (!verdict && res.status === "failed" && !res.output) {
                setDraftCheck({
                    key,
                    phase: "failed",
                    lines: [
                        `The Checker couldn't run (${
                            res.error || "no answer"
                        }).`,
                    ],
                    canRetry: true,
                });
                return;
            }
            fail(
                [
                    verdict
                        ? "The Checker found problems:"
                        : "The Checker didn't reach a verdict:",
                ],
                String(res.output || "").trim()
            );
        };
        timer = setTimeout(start, 1500);
        return () => {
            if (timer) clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isOpen,
        currentCodeKey,
        isCompiling,
        previewError,
        previewComponent,
        installStatus,
        checkName,
        unchangedUpdate,
        needsName,
        editModeSettled,
        checkAttempt,
    ]);

    // Resume an in-progress draft. Triggered by the `resumeDraftId`
    // prop (Settings → Widgets → Draft chip → Resume button). Mirrors
    // the WidgetDraftsList onResume callback — fetches the full draft
    // via drafts.get, sets detectedCode, recompiles the preview, restores
    // the composer layout, flips view to builder. Wrapped in useCallback so the useEffect below can fire
    // it without re-running every render.
    const resumeFromDraft = useCallback(
        async (id, fallback = null) => {
            if (!id) return;
            let full = null;
            try {
                full = await window.mainApi?.drafts?.get?.(id);
            } catch (err) {
                console.warn("[WidgetBuilder] resume fetch failed:", err);
            }
            // A legacy (v1) draft's list row still carries its code.
            if (!full) full = fallback;
            if (!full) return;
            resumedDraftRef.current = full;
            draftSessionIdRef.current = full.id;
            const restoredCode = {
                componentCode: full.componentCode || null,
                configCode: full.configCode || null,
                files: Array.isArray(full.files) ? full.files : [],
            };
            setDetectedCode(restoredCode);
            setSavedCode({
                componentCode: restoredCode.componentCode || "",
                configCode: restoredCode.configCode || "",
            });
            // A draft of an edit edits that widget again.
            if (full.editOf) {
                setEditContextOverride({
                    ...full.editOf,
                    componentCode: restoredCode.componentCode,
                    configCode: restoredCode.configCode,
                });
            }
            if (restoredCode.componentCode) {
                compilePreview(restoredCode).catch(() => {});
            }
            // An old chat draft — code without a Compose layout, or saved
            // from the chat (chatMode "build") even with one — is edited as
            // code: Compose would rebuild it from the layout and drop it.
            const asCode =
                !!restoredCode.componentCode &&
                (!full.composerGrid ||
                    (!!full.chatMode && full.chatMode !== "compose"));
            setCodeOnly(asCode);
            if (asCode) setActiveTab("code");
            if (full.composerGrid) {
                setComposerInitialGrid(full.composerGrid);
                setComposerGrid(full.composerGrid);
                setComposerSessionKey((k) => k + 1);
            }
            setInstallStatus(null);
            setViewMode("builder");
        },
        [compilePreview]
    );

    // When the modal opens with a `resumeDraftId` set, seed state
    // from that draft on the next tick so all setters fire after
    // the modal's other open-time useEffects have stabilized.
    useEffect(() => {
        if (!isOpen) return;
        if (!resumeDraftId) return;
        resumeFromDraft(resumeDraftId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, resumeDraftId]);

    // Kick off the registry device-code sign-in flow: open the browser
    // to the verification URL and start polling for the resulting token.
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
                        // Refresh auth status so the ownership check
                        // (Update original) sees the user as signed in.
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
    }, []);

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
        compilePreview(updated);
    }, [editBuffer, detectedCode, compilePreview]);

    // Cancel: discard buffered edits
    const handleCancelEdits = useCallback(() => {
        setEditBuffer({ component: null, config: null });
    }, []);

    const handleInstall = useCallback(
        async (opts = {}) => {
            if (!detectedCode.componentCode || !widgetName) return;
            // Category is required — the registry organizes widgets by it.
            // Prefilled from the widget (config, else its package); the
            // install button is disabled until picked, but guard here too in
            // case this is invoked programmatically.
            if (!selectedCategory) return;
            // Only code that passed the checks is saved.
            if (!checkPassed) return;

            // Determine install name based on edit mode:
            //   "update" → keep original name (overwrites source in-place)
            //   "remix"  → use the user-chosen remix name (new package)
            let installName = widgetName;
            let installComponentCode = detectedCode.componentCode;

            // Safety net: in edit mode, never let the generic compose default
            // ("ComposedWidget") overwrite the widget's real name. If the
            // emitted code fell back to the default but we're editing a named
            // widget, restore the original name (and rename the export to
            // match). This guards the "edited widget reinstalled as
            // ComposedWidget" regression even if an upstream emit slipped the
            // default through.
            const editOrigName = (
                editContext?.originalComponentName || ""
            ).includes(".")
                ? editContext.originalComponentName.split(".").pop()
                : editContext?.originalComponentName || "";
            if (
                !(isRemixMode && editMode === "remix") &&
                editOrigName &&
                editOrigName !== "ComposedWidget" &&
                (!widgetName || widgetName === "ComposedWidget")
            ) {
                installComponentCode = installComponentCode.replace(
                    new RegExp(
                        `(export\\s+default\\s+function\\s+)${
                            widgetName || "ComposedWidget"
                        }\\b`
                    ),
                    `$1${editOrigName}`
                );
                installName = editOrigName;
            }

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

            // Slice 17d.2 — install-time permission gate. When the
            // widget calls credentialed provider methods, pause here
            // and let the user decide which calls to grant. The modal
            // calls back into handleInstall with `opts.skipPermissionGate`
            // once the user has decided.
            if (!opts.skipPermissionGate) {
                const calls = scanCredentialMethodCalls(installComponentCode);
                if (calls.length > 0) {
                    const packageName = `@ai-built/${installName.toLowerCase()}`;
                    setPendingInstallContext({ packageName, calls });
                    return;
                }
            }

            setInstallStatus("installing");
            try {
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
                    finalConfigCode =
                        dedupProvidersInConfigCode(finalConfigCode);
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
                    // A default config, with the user-picked category
                    // baked in.
                    finalConfigCode = synthesizeDefaultConfigCode(installName);
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
                    `Widget: ${installName}`,
                    cellContext || null,
                    process.env.REACT_APP_IDENTIFIER || "@trops/dash-electron",
                    remixMeta,
                    finalFiles,
                    // No provider pick to correct the config to.
                    null,
                    // Update original on one of the user's own packages:
                    // that package is rebuilt in place (lib/aiBuild.cjs),
                    // not copied to @ai-built.
                    isRemixMode && editMode === "update"
                        ? effectiveEditContext?.originalPackage || null
                        : null,
                    // The name the code was checked under — the main process
                    // installs only that exact checked code.
                    checkName
                );
                if (result?.success) {
                    // The widget is now installed — its draft is no longer
                    // useful and shouldn't clutter the Drafts list.
                    const sessionId = draftSessionIdRef.current;
                    if (sessionId) {
                        try {
                            await window.mainApi?.drafts?.delete?.(sessionId);
                        } catch {
                            /* ignore */
                        }
                        draftSessionIdRef.current = null;
                        resumedDraftRef.current = null;
                    }
                    setSavedCode({
                        componentCode: detectedCode.componentCode,
                        configCode: detectedCode.configCode || "",
                    });
                    setInstallStatus({
                        success: true,
                        widgetName: result.widgetName,
                        // Update original on the user's own package: its
                        // new local version.
                        updated: !!result.updated,
                        version: result.version || null,
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
                            ? makeScopedComponentId(
                                  result.widgetName,
                                  installName
                              )
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
        },
        [
            detectedCode,
            widgetName,
            selectedCategory,
            onInstalled,
            cellContext,
            effectiveEditContext,
            editContext,
            isRemixMode,
            editMode,
            remixName,
            checkPassed,
            checkName,
        ]
    );

    // Slice 17d.2 — install-time permission confirm/cancel handlers.
    // The user opens the modal by clicking "Install Widget" when
    // the widget makes credentialed calls. After they choose grants
    // and click confirm, we persist via the localStorage-backed
    // grants store (see widgetCredentialGrants.js) and re-enter
    // handleInstall with `skipPermissionGate: true` to actually
    // install. Cancel clears the pending state and returns the
    // user to the build view.
    const handlePermissionConfirm = useCallback(
        (grants) => {
            const ctx = pendingInstallContext;
            if (!ctx) return;
            try {
                setCredentialGrants(ctx.packageName, grants);
            } catch {
                // localStorage failure is silent — proceed anyway.
                // Future runtime gate (slice 17d.3) will re-prompt.
            }
            setPendingInstallContext(null);
            // Resume install — the gate is now satisfied for this run.
            handleInstall({ skipPermissionGate: true });
        },
        [pendingInstallContext, handleInstall]
    );

    const handlePermissionCancel = useCallback(() => {
        setPendingInstallContext(null);
        setInstallStatus(null);
    }, []);

    // Slice 17c.7 — the inline empty-render detector that read
    // previewWrapperRef.current.textContent has been removed. With
    // the iframe preview as the only path, the iframe shell measures
    // its own DOM after each render commit and posts
    // `bridge:render-stats`, which the host's
    // `handleIframeRenderStats` callback turns into the same
    // `setPreviewLooksEmpty(...)` flip. Cross-document text
    // measurement isn't needed anymore. Reset on each fresh compile
    // happens inside the compile success path.

    if (!isOpen) return null;

    const PreviewComponent = previewComponent;
    const displayName =
        widgetName?.replace(/([A-Z])/g, " $1").trim() || "Widget";
    // Compose is for a new widget; an installed widget's code (or an old
    // chat draft's) is edited as code, with the right side hidden.
    const showCompose = !effectiveEditContext?.componentCode && !codeOnly;
    // Compose's "Rather describe it? Ask the Dash team": the builder closes
    // and Create opens on a new widget with the text (consolidation Phase 3b).
    const askDashTeam = (text) => {
        setIsOpen(false);
        setTimeout(() => {
            window.dispatchEvent(
                new CustomEvent("dash:open-create", {
                    detail: { type: "widget", prompt: text || "" },
                })
            );
        }, 0);
    };

    const Frame = embedded ? EmbeddedFrame : BuilderModalFrame;
    const frameProps = embedded
        ? {}
        : {
              isOpen,
              setIsOpen: dismissFrame,
              width: "w-11/12",
              height: "h-5/6",
              surfaceClass: `${bgDark} ${borderColor}`,
          };

    return (
        <ThemeContext.Provider value={chatThemeCtx}>
            <Frame {...frameProps}>
                {/* e2e anchor — `data-testid="widget-builder-modal"` lets the
                Playwright spec wait for the modal to be in the DOM after
                dispatching `dash:open-widget-builder`. Bound to a wrapper
                div instead of `<Modal>` because dash-react's Modal does
                not forward arbitrary HTML attributes to its root. */}
                <div
                    data-testid="widget-builder-modal"
                    className="contents"
                ></div>
                {/* Header — Create's header replaces it when embedded */}
                {!embedded && (
                    <PanelHeader
                        glyph="wrench"
                        title={
                            <span className="flex items-baseline gap-2 min-w-0">
                                <span className="shrink-0">Widget Builder</span>
                                {/* What's open: a widget's code (by its
                                name), or a new widget built by hand. */}
                                <span
                                    className={`text-sm font-normal truncate ${chromeMuted}`}
                                    title={
                                        effectiveEditContext?.originalComponentName ||
                                        undefined
                                    }
                                >
                                    {effectiveEditContext?.componentCode
                                        ? `${
                                              (
                                                  effectiveEditContext?.originalComponentName ||
                                                  ""
                                              )
                                                  .split(".")
                                                  .pop()
                                                  .replace(
                                                      /([a-z0-9])([A-Z])/g,
                                                      "$1 $2"
                                                  ) || displayName
                                          } · editing the code`
                                        : "Build by hand"}
                                </span>
                            </span>
                        }
                        actions={
                            <ButtonIcon3
                                icon="xmark"
                                ariaLabel="Close"
                                onClick={requestClose}
                            />
                        }
                    />
                )}

                {/* Health-check banner — only renders when something is
                actually broken. Kept above the split pane so it's
                visible regardless of which tab the user is on. */}
                {healthCheckIssues.length > 0 && (
                    <div
                        className={`flex flex-col gap-1 px-4 py-2 border-b shrink-0 ${status.warning.bg} ${status.warning.border}`}
                    >
                        <div
                            className={`flex items-center gap-2 text-xs font-semibold ${status.warning.strongText}`}
                        >
                            <FontAwesomeIcon
                                icon="triangle-exclamation"
                                className="h-3 w-3"
                            />
                            Widget Builder setup issue
                            {healthCheckIssues.length > 1
                                ? ` (${healthCheckIssues.length})`
                                : ""}
                        </div>
                        {healthCheckIssues.map((issue, idx) => (
                            <div
                                key={idx}
                                className={`text-xs pl-5 ${status.warning.text}`}
                            >
                                <span className="font-medium">
                                    {issue.label}:
                                </span>{" "}
                                {issue.detail}
                            </div>
                        ))}
                    </div>
                )}

                {/* Loading sentinel — viewMode is null while the async drafts
                check resolves on open. Without this, the previous viewMode's
                content briefly flashes before the gate decides between
                "drafts" and "builder". */}
                {viewMode === null && (
                    <div
                        className={`flex-1 min-h-0 flex items-center justify-center text-sm ${chromeMuted}`}
                    >
                        Loading…
                    </div>
                )}

                {/* Drafts entry view — shown on open when the user has
                unfinished widgets from prior sessions. Resume restores
                state into the builder; Build New jumps straight in. */}
                {viewMode === "drafts" && (
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <WidgetDraftsList
                            onOpenedInEditor={() => {
                                // Editor handoff is a clean break — close
                                // the modal so the in-pane editor doesn't
                                // get out of sync with whatever the user
                                // does in VS Code. They can reopen and
                                // Install from the drafts list later.
                                setIsOpen(false);
                            }}
                            onStartNew={() => {
                                draftSessionIdRef.current = null;
                                resumedDraftRef.current = null;
                                setCodeOnly(false);
                                setDetectedCode({
                                    componentCode: null,
                                    configCode: null,
                                    files: [],
                                });
                                setPreviewComponent(null);
                                setPreviewError(null);
                                setInstallStatus(null);
                                // Reset compose-mode state so a fresh
                                // session doesn't inherit the tree from
                                // whatever was last loaded.
                                setComposerInitialGrid(null);
                                setComposerGrid(null);
                                setComposerSessionKey((k) => k + 1);
                                setViewMode("builder");
                            }}
                            onResume={(draft) =>
                                resumeFromDraft(draft.id, draft)
                            }
                        />
                    </div>
                )}

                {/* Split pane */}
                {viewMode === "builder" && (
                    <div className="flex flex-row flex-1 min-h-0">
                        {/* Left: Live Preview (2/3) */}
                        <div className="flex flex-col flex-[2] min-w-0 min-h-0 overflow-hidden">
                            {/* Tab bar */}
                            <div
                                className={`dr-tabs flex items-stretch h-12 gap-3 pl-2 pr-3 border-b ${borderColor} shrink-0`}
                            >
                                <div
                                    className="flex items-stretch gap-1"
                                    role="tablist"
                                    aria-label="Widget views"
                                >
                                    <BuilderTab
                                        active={activeTab === "preview"}
                                        onClick={() => setActiveTab("preview")}
                                        icon="eye"
                                        label="Preview"
                                        activeClass={tabActive}
                                        idleClass={tabIdle}
                                    />
                                    <BuilderTab
                                        active={activeTab === "code"}
                                        onClick={() => setActiveTab("code")}
                                        disabled={!detectedCode.componentCode}
                                        icon="code"
                                        label="Code"
                                        activeClass={tabActive}
                                        idleClass={tabIdle}
                                    />
                                    <BuilderTab
                                        active={activeTab === "configure"}
                                        onClick={() =>
                                            setActiveTab("configure")
                                        }
                                        disabled={!detectedCode.componentCode}
                                        icon="cog"
                                        label="Configure"
                                        activeClass={tabActive}
                                        idleClass={tabIdle}
                                    />
                                    <BuilderTab
                                        active={activeTab === "console"}
                                        onClick={() => setActiveTab("console")}
                                        icon="terminal"
                                        label="Logs"
                                        testId="tab-console"
                                        activeClass={tabActive}
                                        idleClass={tabIdle}
                                        badge={
                                            consoleEvents.some(
                                                (e) => e.severity === "error"
                                            ) ? (
                                                <span
                                                    className={`px-1.5 rounded text-xs ${status.error.solidBg} ${bt.onSolid}`}
                                                    title="Error in widget output"
                                                >
                                                    {
                                                        consoleEvents.filter(
                                                            (e) =>
                                                                e.severity ===
                                                                "error"
                                                        ).length
                                                    }
                                                </span>
                                            ) : null
                                        }
                                    />
                                    <BuilderTab
                                        active={activeTab === "scorecard"}
                                        onClick={() =>
                                            setActiveTab("scorecard")
                                        }
                                        disabled={!detectedCode.componentCode}
                                        icon="circle-check"
                                        label="Style checks"
                                        testId="tab-scorecard"
                                        title="How it follows Dash's design rules"
                                        activeClass={tabActive}
                                        idleClass={tabIdle}
                                        badge={
                                            scorecardFailCount > 0 ? (
                                                <span
                                                    className={`px-1.5 rounded text-xs ${status.error.solidBg} ${bt.onSolid}`}
                                                    title={`${scorecardFailCount} style check${
                                                        scorecardFailCount === 1
                                                            ? ""
                                                            : "s"
                                                    } failing`}
                                                >
                                                    {scorecardFailCount}
                                                </span>
                                            ) : null
                                        }
                                    />
                                </div>
                                {isCompiling && (
                                    <div
                                        className={`flex items-center gap-1.5 text-xs ${accentText}`}
                                    >
                                        <span className="inline-flex gap-0.5">
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full animate-bounce ${tk(
                                                    "bg-secondary-medium"
                                                )}`}
                                                style={{
                                                    animationDelay: "0ms",
                                                }}
                                            />
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full animate-bounce ${tk(
                                                    "bg-secondary-medium"
                                                )}`}
                                                style={{
                                                    animationDelay: "150ms",
                                                }}
                                            />
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full animate-bounce ${tk(
                                                    "bg-secondary-medium"
                                                )}`}
                                                style={{
                                                    animationDelay: "300ms",
                                                }}
                                            />
                                        </span>
                                        Compiling...
                                    </div>
                                )}
                                {installStatus?.success && (
                                    <span
                                        className={`text-xs flex items-center gap-1 ${status.success.icon}`}
                                    >
                                        <FontAwesomeIcon
                                            icon="check-circle"
                                            className="h-3 w-3"
                                        />
                                        {isRemixMode
                                            ? "Remixed as"
                                            : "Installed as"}{" "}
                                        {installStatus.widgetName}
                                    </span>
                                )}
                                {/* Right-side draft toolbar — Open in Editor +
                                Save Draft + save status. Visible once
                                there's code. Lives in the
                                tab bar row so the user can act on
                                their in-flight draft without leaving
                                the modal to find the drafts list. */}
                                {detectedCode.componentCode &&
                                    !detectedCode.emptyGrid && (
                                        <div className="ml-auto flex items-center gap-2">
                                            {editorOpenError && (
                                                <span
                                                    className={`text-xs max-w-xs truncate ${status.error.icon}`}
                                                >
                                                    {editorOpenError}
                                                </span>
                                            )}
                                            <span
                                                className={`text-xs ${chromeMuted}`}
                                            >
                                                {draftSaveState === "saving"
                                                    ? "Saving draft…"
                                                    : draftSaveState === "error"
                                                    ? "Save failed"
                                                    : hasUnsavedWork
                                                    ? "Unsaved changes"
                                                    : draftLastSavedAt
                                                    ? `Draft saved ${Math.max(
                                                          0,
                                                          Math.round(
                                                              (Date.now() -
                                                                  draftLastSavedAt) /
                                                                  1000
                                                          )
                                                      )}s ago`
                                                    : ""}
                                            </span>
                                            <span data-testid="builder-save-draft">
                                                <Button3
                                                    size="sm"
                                                    onClick={saveDraft}
                                                    disabled={
                                                        draftSaveState ===
                                                            "saving" ||
                                                        !hasUnsavedWork
                                                    }
                                                    tooltip="Keep this work in Drafts to come back to"
                                                    title="Save as draft"
                                                />
                                            </span>
                                            <span data-testid="builder-open-editor">
                                                <Button3
                                                    size="sm"
                                                    onClick={async () => {
                                                        const id =
                                                            draftSessionIdRef.current;
                                                        if (!id) return;
                                                        setOpeningEditor(true);
                                                        setEditorOpenError(
                                                            null
                                                        );
                                                        try {
                                                            const result =
                                                                await window.mainApi?.drafts?.openInEditor?.(
                                                                    id
                                                                );
                                                            if (
                                                                !result?.success
                                                            ) {
                                                                setEditorOpenError(
                                                                    result?.error ||
                                                                        "Couldn't open the editor"
                                                                );
                                                            } else {
                                                                // Clean break — user
                                                                // is now editing in
                                                                // VS Code. The
                                                                // in-pane editor
                                                                // would drift, so
                                                                // close.
                                                                setIsOpen(
                                                                    false
                                                                );
                                                            }
                                                        } catch (err) {
                                                            setEditorOpenError(
                                                                err?.message ||
                                                                    String(err)
                                                            );
                                                        } finally {
                                                            setOpeningEditor(
                                                                false
                                                            );
                                                        }
                                                    }}
                                                    disabled={openingEditor}
                                                    tooltip="Open this widget's package directory in your editor (VS Code if installed)"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <FontAwesomeIcon
                                                            icon="up-right-from-square"
                                                            className="h-3 w-3"
                                                        />
                                                        {openingEditor
                                                            ? "Opening…"
                                                            : "Open in editor"}
                                                    </span>
                                                </Button3>
                                            </span>
                                        </div>
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
                                                <div
                                                    className={`w-16 h-16 rounded-2xl ${bt.status.warning.bg} border ${bt.status.warning.border} flex items-center justify-center`}
                                                >
                                                    <FontAwesomeIcon
                                                        icon="exclamation-triangle"
                                                        className={`h-7 w-7 ${bt.status.warning.icon}`}
                                                    />
                                                </div>
                                                <div className="space-y-2 max-w-md">
                                                    <p
                                                        className={`text-sm font-medium ${bt.text}`}
                                                    >
                                                        Can't load widget source
                                                    </p>
                                                    <p
                                                        className={`text-xs ${bt.muted}`}
                                                    >
                                                        {effectiveEditContext.originalComponentName
                                                            ? `"${effectiveEditContext.originalComponentName}" `
                                                            : "This widget "}
                                                        source couldn't be read.
                                                        Try re-publishing the
                                                        widget package with
                                                        source files included.
                                                    </p>
                                                    {effectiveEditContext.originalPackage && (
                                                        <p
                                                            className={`text-xs ${bt.muted} font-mono`}
                                                        >
                                                            package:{" "}
                                                            {
                                                                effectiveEditContext.originalPackage
                                                            }
                                                        </p>
                                                    )}
                                                    <p
                                                        className={`text-xs ${bt.muted} font-mono break-words`}
                                                    >
                                                        reason:{" "}
                                                        {
                                                            effectiveEditContext.sourceError
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    {/* Empty state: where the widget will show
                                    (Compose's empty layout isn't a widget yet). */}
                                    {(!previewComponent ||
                                        detectedCode.emptyGrid) &&
                                        !previewError &&
                                        !isCompiling &&
                                        !effectiveEditContext?.sourceError && (
                                            <div
                                                className="flex flex-col items-center justify-center h-full text-center space-y-4"
                                                data-testid="builder-preview-empty"
                                            >
                                                <div
                                                    className={`w-16 h-16 rounded-2xl ${bt.surface} border ${bt.border} flex items-center justify-center`}
                                                >
                                                    <FontAwesomeIcon
                                                        icon="wrench"
                                                        className={`h-7 w-7 ${bt.accent}`}
                                                    />
                                                </div>
                                                <p
                                                    className={`text-sm max-w-sm ${bt.muted}`}
                                                >
                                                    {showCompose
                                                        ? "Pick a kind of widget on the right — it shows here as you build it."
                                                        : "The widget shows here once its code builds."}
                                                </p>
                                            </div>
                                        )}

                                    {/* Auth-gated preview: friendlier than a red error */}
                                    {previewError &&
                                        /authentic|unauth|401|sign.?in/i.test(
                                            previewError
                                        ) && (
                                            <div className="flex flex-col items-center justify-center h-full space-y-4">
                                                <div
                                                    className={`w-full max-w-lg rounded-lg border ${bt.status.warning.border} ${bt.status.warning.bg} p-4 space-y-3`}
                                                >
                                                    <div
                                                        className={`flex items-center gap-2 ${bt.status.warning.icon} text-sm font-medium`}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon="lock"
                                                            className="h-4 w-4"
                                                        />
                                                        Sign in to preview
                                                    </div>
                                                    <p
                                                        className={`text-xs ${bt.status.warning.text} leading-relaxed`}
                                                    >
                                                        The registry requires
                                                        sign-in to download this
                                                        package. Click below to
                                                        open the sign-in page in
                                                        your browser.
                                                    </p>
                                                    {signInFlow ? (
                                                        <div className="space-y-2">
                                                            <p
                                                                className={`text-xs ${bt.status.warning.text}`}
                                                            >
                                                                A browser tab
                                                                should have
                                                                opened. Verify
                                                                the code there
                                                                matches:
                                                            </p>
                                                            <div
                                                                className={`font-mono text-lg tracking-widest ${bt.status.warning.text} ${bt.surface} rounded px-3 py-2 text-center select-all`}
                                                            >
                                                                {signInFlow.userCode ||
                                                                    "—"}
                                                            </div>
                                                            <div
                                                                className={`flex items-center gap-2 text-xs ${bt.status.warning.text}`}
                                                            >
                                                                <span className="inline-flex gap-0.5">
                                                                    <span
                                                                        className={`w-1.5 h-1.5 rounded-full ${bt.status.warning.solidBg} animate-bounce`}
                                                                        style={{
                                                                            animationDelay:
                                                                                "0ms",
                                                                        }}
                                                                    />
                                                                    <span
                                                                        className={`w-1.5 h-1.5 rounded-full ${bt.status.warning.solidBg} animate-bounce`}
                                                                        style={{
                                                                            animationDelay:
                                                                                "150ms",
                                                                        }}
                                                                    />
                                                                    <span
                                                                        className={`w-1.5 h-1.5 rounded-full ${bt.status.warning.solidBg} animate-bounce`}
                                                                        style={{
                                                                            animationDelay:
                                                                                "300ms",
                                                                        }}
                                                                    />
                                                                </span>
                                                                Waiting for
                                                                sign-in… we'll
                                                                retry
                                                                automatically.
                                                            </div>
                                                            {signInFlow.verificationUrlComplete && (
                                                                <Button3
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        window.mainApi?.shell?.openExternal?.(
                                                                            signInFlow.verificationUrlComplete
                                                                        )
                                                                    }
                                                                >
                                                                    Reopen
                                                                    sign-in page
                                                                </Button3>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            onClick={
                                                                handleSignInForPreview
                                                            }
                                                        >
                                                            Sign in
                                                        </Button>
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
                                                <div
                                                    className={`w-full max-w-lg rounded-lg border ${bt.status.error.border} ${bt.status.error.bg} p-4 space-y-2`}
                                                >
                                                    <div
                                                        className={`flex items-center gap-2 ${bt.status.error.icon} text-sm font-medium`}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon="exclamation-circle"
                                                            className="h-4 w-4"
                                                        />
                                                        {previewErrorMeta?.code ===
                                                        "ESBUILD_SPAWN_FAILED"
                                                            ? "Widget compiler unavailable"
                                                            : "Compilation Error"}
                                                    </div>
                                                    <pre
                                                        className={`text-xs ${bt.status.error.icon} ${bt.surface} rounded p-2 overflow-auto max-h-32`}
                                                    >
                                                        {previewError}
                                                    </pre>
                                                    {/* Slice 17b: pretty-print esbuild's
                                                    structured errors so users see line
                                                    numbers + the offending source line
                                                    instead of bare "SyntaxError: ...". */}
                                                    {Array.isArray(
                                                        previewErrorMeta
                                                            ?.diagnostics
                                                            ?.esbuild
                                                    ) &&
                                                        previewErrorMeta
                                                            .diagnostics.esbuild
                                                            .length > 0 && (
                                                            <div className="text-xs space-y-2">
                                                                {previewErrorMeta.diagnostics.esbuild.map(
                                                                    (
                                                                        e,
                                                                        idx
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                idx
                                                                            }
                                                                            className={`${bt.surface} rounded p-2 space-y-1`}
                                                                        >
                                                                            <div
                                                                                className={`${bt.status.error.icon} font-medium`}
                                                                            >
                                                                                {e
                                                                                    .location
                                                                                    ?.file &&
                                                                                    e.location.file
                                                                                        .split(
                                                                                            "/"
                                                                                        )
                                                                                        .pop()}
                                                                                {e
                                                                                    .location
                                                                                    ?.line
                                                                                    ? `:${
                                                                                          e
                                                                                              .location
                                                                                              .line
                                                                                      }${
                                                                                          e
                                                                                              .location
                                                                                              .column
                                                                                              ? ":" +
                                                                                                e
                                                                                                    .location
                                                                                                    .column
                                                                                              : ""
                                                                                      }`
                                                                                    : ""}
                                                                                {e
                                                                                    .location
                                                                                    ?.line
                                                                                    ? "  "
                                                                                    : ""}
                                                                                {
                                                                                    e.text
                                                                                }
                                                                            </div>
                                                                            {e
                                                                                .location
                                                                                ?.lineText && (
                                                                                <pre
                                                                                    className={`text-xs ${bt.status.error.text} ${bt.surface} rounded px-2 py-1 overflow-x-auto whitespace-pre`}
                                                                                >
                                                                                    {
                                                                                        e
                                                                                            .location
                                                                                            .lineText
                                                                                    }
                                                                                </pre>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}
                                                    {/* Slice 17b: hint for an import of a
                                                    file the package doesn't have.
                                                    Only for real import errors
                                                    (esbuild: Could not resolve
                                                    "./x") — not the "Could not
                                                    resolve widget component"
                                                    message. */}
                                                    {/Could not resolve "|cannot find module/i.test(
                                                        previewError || ""
                                                    ) && (
                                                        <div
                                                            className={`text-xs ${bt.status.warning.icon} ${bt.status.warning.bg} border ${bt.status.warning.border} rounded p-2`}
                                                        >
                                                            This widget imports
                                                            a file that isn't in
                                                            its package. Remove
                                                            the import, or keep
                                                            the code in the
                                                            widget's own file.
                                                        </div>
                                                    )}
                                                    {previewErrorMeta?.diagnostics && (
                                                        <details
                                                            className={`text-xs ${bt.status.error.icon} ${bt.surface} rounded p-2 overflow-auto`}
                                                        >
                                                            <summary
                                                                className={`cursor-pointer ${bt.status.error.icon} select-none`}
                                                            >
                                                                Diagnostics —
                                                                share this if
                                                                you report a bug
                                                            </summary>
                                                            <pre className="mt-2 whitespace-pre-wrap break-all">
                                                                {JSON.stringify(
                                                                    previewErrorMeta.diagnostics,
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                            <Button3
                                                                size="sm"
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
                                                            >
                                                                Copy diagnostics
                                                            </Button3>
                                                        </details>
                                                    )}
                                                    {detectedCode.componentCode && (
                                                        <Button2
                                                            size="sm"
                                                            onClick={() =>
                                                                setActiveTab(
                                                                    "code"
                                                                )
                                                            }
                                                        >
                                                            Open Code tab
                                                        </Button2>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    {/* Live widget preview */}
                                    {PreviewComponent &&
                                        !detectedCode.emptyGrid &&
                                        !installStatus && (
                                            <div className="flex flex-col h-full">
                                                {/* Provider picker — shown when the
                                        widget declares providers. Without a
                                        selection the widget renders its own
                                        "not configured" empty state, same
                                        as on a real dashboard. */}
                                                <PreviewProviderPicker
                                                    configCode={
                                                        detectedCode.configCode
                                                    }
                                                    appProviders={
                                                        (
                                                            previewAppCtx ||
                                                            appContext
                                                        )?.providers
                                                    }
                                                    selection={
                                                        previewProviderSelection
                                                    }
                                                    justChanged={
                                                        providerJustChanged
                                                    }
                                                    onChange={(
                                                        next,
                                                        changedType,
                                                        changedValue
                                                    ) => {
                                                        setPreviewProviderSelection(
                                                            next
                                                        );
                                                        if (changedType) {
                                                            flagProviderChange(
                                                                changedType,
                                                                changedValue
                                                            );
                                                        }
                                                    }}
                                                />
                                                {/* Test-inputs form (slice 17b.9) —
                                        renders one row per userConfig field
                                        the AI declared, so the user can
                                        type values into the widget without
                                        leaving the modal (e.g. set
                                        indexName="airports" on an Algolia
                                        rules manager and watch the preview
                                        fetch real data). Empty when the
                                        widget declares no userConfig. */}
                                                <PreviewTestInputsForm
                                                    userConfig={
                                                        previewParsedConfig?.userConfig
                                                    }
                                                    defaults={
                                                        previewWidgetDefaults
                                                    }
                                                    values={previewTestInputs}
                                                    onChange={(field, value) =>
                                                        setPreviewTestInputs(
                                                            (prev) => ({
                                                                ...prev,
                                                                [field]: value,
                                                            })
                                                        )
                                                    }
                                                    onReset={() =>
                                                        setPreviewTestInputs({})
                                                    }
                                                />
                                                {/* A widget that mounted but shows
                                            nothing: a hint for the code. Not
                                            while composing — an empty layout
                                            is expected there. */}
                                                {previewLooksEmpty &&
                                                    !showCompose && (
                                                        <div
                                                            className={`mx-4 mt-2 px-3 py-2 rounded-md border ${bt.status.warning.border} ${bt.status.warning.bg} text-xs ${bt.status.warning.text} space-y-1`}
                                                            data-testid="builder-preview-looks-empty"
                                                        >
                                                            <div
                                                                className={`font-semibold ${bt.status.warning.icon}`}
                                                            >
                                                                Widget rendered
                                                                with no visible
                                                                content
                                                            </div>
                                                            <div>
                                                                Most common
                                                                cause: a wrong
                                                                prop name on a
                                                                dash-react
                                                                component. Use
                                                                title on
                                                                Heading, Button
                                                                and EmptyState
                                                                (not text or
                                                                message).
                                                            </div>
                                                        </div>
                                                    )}
                                                {/* Widget preview — fills available space.
                                                The inner padding keeps the widget off
                                                the frame's edges, like a dashboard cell. */}
                                                <div className="flex-1 p-4 overflow-auto">
                                                    <div
                                                        className={`h-full rounded-lg border overflow-hidden shadow-lg p-3 ${
                                                            previewThemeCtx
                                                                ?.currentTheme?.[
                                                                "border-primary-dark"
                                                            ] || `${bt.border}`
                                                        } ${
                                                            previewThemeCtx
                                                                ?.currentTheme?.[
                                                                "bg-primary-dark"
                                                            ] || `${bt.surface}`
                                                        }`}
                                                    >
                                                        {/* Slice 17c — iframe-isolated preview is the
                                                    only path now. Bundle source flows through
                                                    postMessage; module references go via direct
                                                    cross-window assignment (not serializable).
                                                    Theme, AppContext.providers, and widgetData
                                                    (the shape useWidgetProviders reads) are
                                                    posted as plain JSON; the iframe shell wraps
                                                    the widget in matching context providers so
                                                    dash-core hooks resolve correctly. Errors
                                                    of every kind (render, event-handler,
                                                    async, commit-phase, CSS, globals, memory)
                                                    stay kernel-isolated from the host React
                                                    tree. */}
                                                        {previewBundleSource && (
                                                            <PreviewIframe
                                                                bundleSource={
                                                                    previewBundleSource
                                                                }
                                                                componentName={
                                                                    previewBundleComponentName
                                                                }
                                                                props={{
                                                                    title: displayName,
                                                                    ...previewWidgetDefaults,
                                                                    // Only let NON-empty
                                                                    // test inputs override
                                                                    // the userConfig
                                                                    // defaults — a blank
                                                                    // ("") test value must
                                                                    // not clobber a real
                                                                    // default at preview.
                                                                    ...Object.fromEntries(
                                                                        Object.entries(
                                                                            previewTestInputs ||
                                                                                {}
                                                                        ).filter(
                                                                            ([
                                                                                ,
                                                                                v,
                                                                            ]) =>
                                                                                v !==
                                                                                    "" &&
                                                                                v !==
                                                                                    undefined &&
                                                                                v !==
                                                                                    null
                                                                        )
                                                                    ),
                                                                    ...(effectiveEditContext?.userPrefs ||
                                                                        {}),
                                                                }}
                                                                themeContext={
                                                                    previewThemeCtx
                                                                }
                                                                appContext={{
                                                                    providers:
                                                                        (
                                                                            previewAppCtx ||
                                                                            appContext
                                                                        )
                                                                            ?.providers ||
                                                                        {},
                                                                    credentials:
                                                                        (
                                                                            previewAppCtx ||
                                                                            appContext
                                                                        )
                                                                            ?.credentials ||
                                                                        null,
                                                                }}
                                                                widgetData={buildPreviewWidgetData(
                                                                    {
                                                                        editContext:
                                                                            effectiveEditContext,
                                                                        previewConfigCode:
                                                                            detectedCode.configCode,
                                                                        previewProviderSelection,
                                                                    }
                                                                )}
                                                                onError={
                                                                    handleIframePreviewError
                                                                }
                                                                onRenderStats={
                                                                    handleIframeRenderStats
                                                                }
                                                                onConsoleEvent={
                                                                    appendConsoleEvent
                                                                }
                                                                // Compose's
                                                                // click-to-select;
                                                                // editing code
                                                                // keeps the
                                                                // preview passive
                                                                // so the widget's
                                                                // own clicks work.
                                                                selectable={
                                                                    showCompose
                                                                }
                                                                selectedNodeId={
                                                                    composerSelectedNodeId
                                                                }
                                                                onComposerNodeClick={({
                                                                    nodeId,
                                                                }) =>
                                                                    setComposerSelectedNodeId(
                                                                        nodeId
                                                                    )
                                                                }
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Footer — mode toggle, name (remix), category + Install */}
                                                {
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
                                                                        <div
                                                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${status.warning.bg} ${status.warning.border}`}
                                                                        >
                                                                            <p
                                                                                className={`flex-1 text-xs leading-snug ${status.warning.text}`}
                                                                            >
                                                                                Sign
                                                                                in
                                                                                to
                                                                                the
                                                                                registry
                                                                                to
                                                                                update
                                                                                your
                                                                                own
                                                                                widgets
                                                                                in
                                                                                place
                                                                                instead
                                                                                of
                                                                                duplicating.
                                                                            </p>
                                                                            <Button2
                                                                                size="sm"
                                                                                title="Sign in"
                                                                                onClick={
                                                                                    handleSignInForPreview
                                                                                }
                                                                                className="shrink-0"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                {/* Signed-in-but-not-the-owner hint. Surfaces
                                                            what's actually being compared so the user
                                                            can see why the Update toggle stays hidden
                                                            (mismatched username vs. scope) without us
                                                            having to ship diagnostic logs. The org-
                                                            membership case (publisher in @scope/* but
                                                            signed in under a personal username) isn't
                                                            handled by the scope === username check;
                                                            this surfaces that gap so the user knows
                                                            their options. */}
                                                                {!isOwner &&
                                                                    registryChecked &&
                                                                    registryUsername &&
                                                                    widgetScope &&
                                                                    widgetScope !==
                                                                        "ai-built" && (
                                                                        <div
                                                                            className={`px-3 py-2 rounded-lg border ${status.warning.bg} ${status.warning.border}`}
                                                                        >
                                                                            <p
                                                                                className={`text-xs leading-snug ${status.warning.text}`}
                                                                            >
                                                                                Signed
                                                                                in
                                                                                as{" "}
                                                                                <code
                                                                                    className={
                                                                                        codeChip
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        registryUsername
                                                                                    }
                                                                                </code>{" "}
                                                                                —
                                                                                this
                                                                                widget
                                                                                is
                                                                                under
                                                                                scope{" "}
                                                                                <code
                                                                                    className={
                                                                                        codeChip
                                                                                    }
                                                                                >
                                                                                    @
                                                                                    {
                                                                                        widgetScope
                                                                                    }
                                                                                </code>

                                                                                .
                                                                                Update-in-place
                                                                                is
                                                                                only
                                                                                enabled
                                                                                when
                                                                                the
                                                                                signed-in
                                                                                username
                                                                                matches
                                                                                the
                                                                                scope.
                                                                                Otherwise
                                                                                use
                                                                                Remix
                                                                                to
                                                                                fork
                                                                                into{" "}
                                                                                <code
                                                                                    className={
                                                                                        codeChip
                                                                                    }
                                                                                >
                                                                                    @ai-built/
                                                                                </code>

                                                                                .
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                {/* Update / Remix toggle — only when user is the owner */}
                                                                {isOwner && (
                                                                    <SegmentedControl
                                                                        ariaLabel="Update or remix"
                                                                        value={
                                                                            editMode
                                                                        }
                                                                        onChange={
                                                                            setEditMode
                                                                        }
                                                                        options={[
                                                                            {
                                                                                value: "update",
                                                                                label: "Update original",
                                                                            },
                                                                            {
                                                                                value: "remix",
                                                                                label: "Remix as new",
                                                                            },
                                                                        ]}
                                                                    />
                                                                )}
                                                                {editMode ===
                                                                    "remix" && (
                                                                    <InputText
                                                                        value={
                                                                            remixName
                                                                        }
                                                                        onChange={(
                                                                            value
                                                                        ) => {
                                                                            // PascalCase, letters and digits only.
                                                                            const raw =
                                                                                String(
                                                                                    value ||
                                                                                        ""
                                                                                ).replace(
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
                                                                        ariaLabel="Name for the remixed widget"
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span
                                                                className={`text-xs truncate ${chromeMuted}`}
                                                            >
                                                                {!isRemixMode
                                                                    ? needsName
                                                                        ? showCompose
                                                                            ? "Name the widget on the right to install it"
                                                                            : "Rename its component in the Code tab to install it"
                                                                        : `Goes into your widgets as ${displayName}`
                                                                    : editMode ===
                                                                      "update"
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
                                                                {/* Say why Install is
                                                            greyed out. */}
                                                                <ChecksStatus
                                                                    check={
                                                                        draftCheck &&
                                                                        draftCheck.key ===
                                                                            currentCodeKey
                                                                            ? draftCheck
                                                                            : null
                                                                    }
                                                                    bt={bt}
                                                                    onRetry={
                                                                        retryCheck
                                                                    }
                                                                />
                                                                {checkPassed &&
                                                                    !selectedCategory && (
                                                                        <span
                                                                            data-testid="install-category-hint"
                                                                            className={`text-xs ${chromeMuted}`}
                                                                        >
                                                                            {/* What it's for (consolidation Phase 4d). */}
                                                                            Pick
                                                                            a
                                                                            category
                                                                            to
                                                                            install
                                                                            —
                                                                            it's
                                                                            where
                                                                            the
                                                                            widget
                                                                            is
                                                                            listed
                                                                            when
                                                                            you
                                                                            publish
                                                                            it
                                                                        </span>
                                                                    )}
                                                                <span title="Where it's listed when you publish it.">
                                                                    <ChoiceMenu
                                                                        label="Category"
                                                                        value={
                                                                            selectedCategory ||
                                                                            null
                                                                        }
                                                                        options={
                                                                            VALID_CATEGORIES
                                                                        }
                                                                        onChange={(
                                                                            v
                                                                        ) =>
                                                                            setSelectedCategory(
                                                                                v ||
                                                                                    null
                                                                            )
                                                                        }
                                                                        align="right"
                                                                        direction="up"
                                                                    />
                                                                </span>
                                                                <Button
                                                                    onClick={
                                                                        handleInstall
                                                                    }
                                                                    disabled={
                                                                        namePending ||
                                                                        needsName ||
                                                                        !checkPassed ||
                                                                        !selectedCategory ||
                                                                        (isRemixMode &&
                                                                            editMode ===
                                                                                "remix" &&
                                                                            !remixName)
                                                                    }
                                                                    tooltip={
                                                                        namePending
                                                                            ? "Press Enter to save the name first"
                                                                            : needsName
                                                                            ? "Name the widget first"
                                                                            : !checkPassed
                                                                            ? "Waiting for the checks to pass"
                                                                            : !selectedCategory
                                                                            ? "Pick a category first"
                                                                            : editMode ===
                                                                                  "remix" &&
                                                                              !remixName
                                                                            ? "Enter a name for the remix"
                                                                            : undefined
                                                                    }
                                                                    title={
                                                                        !isRemixMode
                                                                            ? "Install widget"
                                                                            : editMode ===
                                                                              "update"
                                                                            ? "Update widget"
                                                                            : "Remix widget"
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                }
                                            </div>
                                        )}

                                    {/* Installed success */}
                                    {installStatus?.success && (
                                        <div className="flex flex-col items-center justify-center h-full gap-4">
                                            <div
                                                className={`w-12 h-12 rounded-xl ${bt.status.success.bg} flex items-center justify-center`}
                                            >
                                                <FontAwesomeIcon
                                                    icon="check-circle"
                                                    className={`h-6 w-6 ${bt.status.success.icon}`}
                                                />
                                            </div>
                                            <div className="text-center space-y-1">
                                                <p
                                                    className={`text-base font-semibold ${bt.status.success.icon}`}
                                                >
                                                    {!isRemixMode
                                                        ? "Widget Installed!"
                                                        : editMode === "update"
                                                        ? "Widget Updated!"
                                                        : "Widget Remixed!"}
                                                </p>
                                                <p
                                                    className={`text-sm ${bt.muted}`}
                                                >
                                                    <span
                                                        className={`font-mono ${bt.text}`}
                                                    >
                                                        {
                                                            installStatus.widgetName
                                                        }
                                                    </span>{" "}
                                                    {installStatus.updated
                                                        ? `was updated to version ${
                                                              installStatus.version ||
                                                              "(local)"
                                                          }. Your dashboards use it now; publish a new version from the Widgets page to share it.`
                                                        : isRemixMode
                                                        ? editMode === "update"
                                                            ? "has been updated in place."
                                                            : "has been swapped into your dashboard."
                                                        : cellContext?.gridItemId
                                                        ? "is now in the widget selector."
                                                        : "now appears in your Widgets list."}
                                                </p>
                                            </div>
                                            <div className="flex gap-3">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        setIsOpen(false)
                                                    }
                                                >
                                                    Done
                                                </Button>
                                                <Button2
                                                    size="sm"
                                                    onClick={() => {
                                                        setInstallStatus(null);
                                                        setPreviewComponent(
                                                            null
                                                        );
                                                        setDetectedCode({
                                                            componentCode: null,
                                                            configCode: null,
                                                        });
                                                    }}
                                                >
                                                    Build Another
                                                </Button2>
                                            </div>
                                        </div>
                                    )}

                                    {/* Install error */}
                                    {installStatus?.error && (
                                        <div className="flex flex-col items-center justify-center h-full gap-4">
                                            <div className="text-center space-y-2">
                                                <p
                                                    className={`${bt.status.error.icon} font-medium`}
                                                >
                                                    Installation failed
                                                </p>
                                                <pre
                                                    className={`text-xs ${bt.status.error.icon} ${bt.surface} rounded p-2 max-w-md overflow-auto`}
                                                >
                                                    {installStatus.error}
                                                </pre>
                                            </div>
                                            <Button2
                                                size="sm"
                                                onClick={() =>
                                                    setInstallStatus(null)
                                                }
                                            >
                                                Try Again
                                            </Button2>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Code editor (visible when Code tab is active) */}
                            {activeTab === "code" &&
                                detectedCode.componentCode && (
                                    <div className="flex flex-1 min-h-0 overflow-hidden">
                                        {/* File explorer sidebar */}
                                        <div
                                            className={`w-52 border-r ${borderColor} shrink-0 overflow-auto p-2 flex flex-col gap-0.5`}
                                        >
                                            <h3
                                                className={`px-2 pb-1 text-xs font-medium ${bt.muted}`}
                                            >
                                                Files
                                            </h3>
                                            <ListRow
                                                icon="file-code"
                                                mono
                                                title={`${
                                                    widgetName || "Widget"
                                                }.js`}
                                                selected={
                                                    activeFile === "component"
                                                }
                                                onClick={() =>
                                                    setActiveFile("component")
                                                }
                                            />
                                            <ListRow
                                                icon="cog"
                                                mono
                                                title={`${
                                                    widgetName || "Widget"
                                                }.dash.js`}
                                                selected={
                                                    activeFile === "config"
                                                }
                                                onClick={() =>
                                                    setActiveFile("config")
                                                }
                                            />
                                        </div>
                                        {/* Editor pane with breadcrumb header */}
                                        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
                                            {/* Breadcrumb path */}
                                            <div
                                                className={`flex items-center gap-1 px-3 py-1.5 border-b ${borderColor} shrink-0 text-xs`}
                                            >
                                                <span className={`${bt.muted}`}>
                                                    @ai-built
                                                </span>
                                                <span className={`${bt.muted}`}>
                                                    /
                                                </span>
                                                <span className={`${bt.muted}`}>
                                                    {(
                                                        widgetName || "widget"
                                                    ).toLowerCase()}
                                                </span>
                                                <span className={`${bt.muted}`}>
                                                    /
                                                </span>
                                                <span className={`${bt.muted}`}>
                                                    widgets
                                                </span>
                                                <span className={`${bt.muted}`}>
                                                    /
                                                </span>
                                                <span
                                                    className={`${bt.text} font-medium`}
                                                >
                                                    {widgetName || "Widget"}
                                                    {activeFile === "config"
                                                        ? ".dash.js"
                                                        : ".js"}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-h-0 overflow-hidden relative">
                                                <div className="absolute inset-0">
                                                    <CodeEditorVS
                                                        key={`${activeFile}-${editorLayoutKey}`}
                                                        code={
                                                            editBuffer[
                                                                activeFile
                                                            ] ??
                                                            (activeFile ===
                                                            "component"
                                                                ? detectedCode.componentCode
                                                                : detectedCode.configCode ||
                                                                  "")
                                                        }
                                                        language="javascript"
                                                        onChange={
                                                            handleCodeEdit
                                                        }
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
                                                <span
                                                    className={`text-xs ${bt.muted}`}
                                                >
                                                    {hasUnsavedEdits
                                                        ? "Unsaved changes"
                                                        : ""}
                                                </span>
                                                {hasUnsavedEdits ? (
                                                    <div className="flex items-center gap-2">
                                                        <Button3
                                                            size="sm"
                                                            onClick={
                                                                handleCancelEdits
                                                            }
                                                        >
                                                            Cancel
                                                        </Button3>
                                                        <Button
                                                            size="sm"
                                                            onClick={
                                                                handleSaveEdits
                                                            }
                                                        >
                                                            Save &amp; Compile
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        className={`text-xs ${bt.muted}`}
                                                    >
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
                                        configCode={
                                            detectedCode.configCode || ""
                                        }
                                        parsedConfig={previewParsedConfig}
                                        componentName={widgetName}
                                        borderColor={borderColor}
                                        onSave={(newConfigCode, diff) => {
                                            // Apply matching code transforms
                                            // for any events/handlers added or
                                            // removed in the Configure tab —
                                            // this is what keeps the .dash.js
                                            // declaration in sync with the
                                            // widget's actual publishEvent /
                                            // listen calls. Stubs for adds,
                                            // surgical removes for deletes.
                                            let nextComponentCode =
                                                detectedCode.componentCode;
                                            if (diff && nextComponentCode) {
                                                for (const name of diff.eventsRemoved ||
                                                    []) {
                                                    nextComponentCode =
                                                        transforms.removePublishEvent(
                                                            nextComponentCode,
                                                            name
                                                        );
                                                }
                                                for (const name of diff.eventsAdded ||
                                                    []) {
                                                    nextComponentCode =
                                                        transforms.addPublishEventStub(
                                                            nextComponentCode,
                                                            name,
                                                            widgetName
                                                        );
                                                }
                                                for (const name of diff.handlersRemoved ||
                                                    []) {
                                                    nextComponentCode =
                                                        transforms.removeEventHandler(
                                                            nextComponentCode,
                                                            name
                                                        );
                                                }
                                                for (const name of diff.handlersAdded ||
                                                    []) {
                                                    nextComponentCode =
                                                        transforms.addEventHandlerStub(
                                                            nextComponentCode,
                                                            name,
                                                            widgetName
                                                        );
                                                }
                                                for (const key of diff.tasksRemoved ||
                                                    []) {
                                                    nextComponentCode =
                                                        transforms.removeScheduledTask(
                                                            nextComponentCode,
                                                            key
                                                        );
                                                }
                                                for (const key of diff.tasksAdded ||
                                                    []) {
                                                    nextComponentCode =
                                                        transforms.addScheduledTaskStub(
                                                            nextComponentCode,
                                                            key,
                                                            widgetName
                                                        );
                                                }
                                            }
                                            const updated = {
                                                ...detectedCode,
                                                componentCode:
                                                    nextComponentCode,
                                                configCode: newConfigCode,
                                            };
                                            setDetectedCode(updated);
                                            compilePreview(updated);
                                        }}
                                    />
                                )}
                            {activeTab === "console" && (
                                <WidgetConsolePane
                                    events={consoleEvents}
                                    onClear={clearConsoleEvents}
                                />
                            )}
                            {activeTab === "scorecard" &&
                                detectedCode.componentCode && (
                                    <div
                                        className="px-4 py-4 overflow-y-auto flex flex-col gap-3"
                                        data-testid="build-mode-acceptance-scorecard"
                                    >
                                        <div
                                            className={`text-sm ${bt.text} leading-relaxed`}
                                        >
                                            <div
                                                className={`font-medium ${bt.text}`}
                                            >
                                                Scoring{" "}
                                                <code
                                                    className={`px-1.5 py-0.5 rounded ${bt.surface} ${bt.accent} font-mono text-xs`}
                                                >
                                                    {widgetName ||
                                                        "current widget"}
                                                </code>
                                            </div>
                                            <div
                                                className={`text-xs ${bt.muted} mt-1`}
                                            >
                                                The scorecard runs over the
                                                widget code in the editor. Fix
                                                what fails in the{" "}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setActiveTab("code")
                                                    }
                                                    className={`underline ${bt.accent}`}
                                                >
                                                    Code
                                                </button>{" "}
                                                tab.
                                            </div>
                                        </div>
                                        <AcceptanceScorecard
                                            code={detectedCode.componentCode}
                                        />
                                    </div>
                                )}
                        </div>

                        {/* Right: Compose (1/3), for a new widget.
                        `overflow-hidden` is load-bearing: QuickStartPane's
                        grid of intent cards can exceed this panel's share
                        on narrow viewports. Hidden while editing code. */}
                        {showCompose && (
                            <div
                                className={`flex flex-col flex-1 min-w-0 overflow-hidden border-l ${borderColor}`}
                                data-testid="builder-compose-pane"
                            >
                                <ComposerPaneV2
                                    key={composerSessionKey}
                                    initialGrid={composerInitialGrid}
                                    onChange={setComposerGrid}
                                    selectedCellId={composerSelectedNodeId}
                                    onSelectedCellChange={
                                        setComposerSelectedNodeId
                                    }
                                    providers={providers}
                                    editContext={effectiveEditContext}
                                    currentDraftId={draftSessionIdRef.current}
                                    onAskDashTeam={askDashTeam}
                                    onNamePendingChange={setNamePending}
                                    onEmit={(code) => {
                                        setDetectedCode({
                                            componentCode: code.componentCode,
                                            configCode: code.configCode,
                                            files: code.files || null,
                                            emptyGrid: !!code.empty,
                                        });
                                        compilePreview(code).catch(() => {});
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
                {/* Slice 17d.2 — install-time permission gate. Renders
                via createPortal at fixed-position overlay (same
                pattern JitConsentModal uses) so it stacks above
                the widget-builder Modal without HeadlessUI Dialog
                stacking issues. Self-managing isOpen via the
                `pendingInstallContext` state so it only mounts when
                the install flow has actually paused for consent. */}
                {/* Leaving with unsaved work (Close here, or Create's
                Back / Close): keep it as a draft, drop it, or stay. */}
                <UnsavedWorkPrompt
                    open={!!leavePrompt}
                    onAnswer={answerLeave}
                />
                <WidgetCredentialPermissionModal
                    isOpen={!!pendingInstallContext}
                    packageName={pendingInstallContext?.packageName || ""}
                    calls={pendingInstallContext?.calls || []}
                    onConfirm={handlePermissionConfirm}
                    onCancel={handlePermissionCancel}
                />
            </Frame>
        </ThemeContext.Provider>
    );
};
