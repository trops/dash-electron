/**
 * AlgoliaSearchTemplateEditor
 *
 * Monaco-powered Mustache template editor with an attribute sidebar populated
 * from live Algolia hit data.  Communicates with AlgoliaSearchPage via the
 * Dash event system so template changes appear in real time.
 *
 * @package Algolia Search
 */
import { useState, useRef, useCallback, useEffect, useContext } from "react";
import {
    Panel,
    SubHeading2,
    CodeEditorVS,
    Button,
    Caption2,
    Tabs,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";

/* ─── Transform preview runner ──────────────────────────────────── */

function runTransformPreview(sampleHit, transformCode) {
    if (!sampleHit) {
        return { status: "empty" };
    }
    if (!transformCode || !transformCode.trim()) {
        return { status: "passthrough", output: sampleHit };
    }
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(
            "hit",
            `"use strict";\n${transformCode}\nif (typeof transform === "function") return transform(hit);\nreturn hit;`
        );
        const result = fn({ ...sampleHit });
        if (result === undefined || result === null) {
            return {
                status: "warning",
                error:
                    "Transform returned " +
                    String(result) +
                    ". It must return an object. " +
                    "If using a function, make sure it has a return statement.",
            };
        }
        if (typeof result !== "object" || Array.isArray(result)) {
            return {
                status: "warning",
                error:
                    "Transform returned " +
                    (Array.isArray(result) ? "an array" : typeof result) +
                    " instead of an object. The result will be ignored.",
            };
        }
        return { status: "success", output: result };
    } catch (err) {
        return { status: "error", error: err.message };
    }
}

/* ─── Transform preview display ─────────────────────────────────── */

function TransformPreview({ previewResult, collapsed, onToggle }) {
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

    if (!previewResult) return null;

    const { status: previewStatus, output, error } = previewResult;
    const borderColor = currentTheme?.["border-primary-dark"] || "";
    const headerClass = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    }`;
    const preClass = `text-xs font-mono whitespace-pre-wrap break-all ${
        currentTheme?.["text-primary-medium"] || ""
    }`;

    return (
        <div className={`border rounded mt-2 overflow-hidden ${borderColor}`}>
            <button
                onClick={onToggle}
                className={`flex items-center justify-between w-full px-3 py-1.5 transition-colors text-xs ${headerClass}`}
            >
                <Caption2 className="font-medium">Transform Preview</Caption2>
                <Caption2>{collapsed ? "+" : "\u2013"}</Caption2>
            </button>
            {!collapsed && (
                <div className="px-3 py-2 max-h-48 overflow-y-auto">
                    {previewStatus === "empty" && (
                        <Caption2 block className="italic">
                            Waiting for search results&hellip;
                        </Caption2>
                    )}
                    {previewStatus === "passthrough" && (
                        <pre className={preClass}>
                            {JSON.stringify(output, null, 2)}
                        </pre>
                    )}
                    {previewStatus === "success" && (
                        <pre className={preClass}>
                            {JSON.stringify(output, null, 2)}
                        </pre>
                    )}
                    {previewStatus === "error" && (
                        <div
                            className={`text-xs rounded px-2 py-1.5 font-mono ${status.error.bg} ${status.error.text}`}
                        >
                            {error}
                        </div>
                    )}
                    {previewStatus === "warning" && (
                        <div className={`text-xs ${status.warning.icon}`}>
                            {error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── Attribute sidebar ──────────────────────────────────────────── */

function AttributeChip({ name, onClick }) {
    const { currentTheme } = useContext(ThemeContext);
    return (
        <button
            onClick={() => onClick(name)}
            className={`text-left text-xs px-2 py-1 rounded transition-colors truncate font-mono ${
                currentTheme?.["bg-primary-dark"] || ""
            } ${currentTheme?.["hover-bg-primary-dark"] || ""} ${
                currentTheme?.["text-primary-medium"] || ""
            }`}
        >
            {name}
        </button>
    );
}

function AttributePanel({ attributes, onAttributeClick }) {
    const { currentTheme } = useContext(ThemeContext);
    return (
        <div
            className={`w-48 flex-shrink-0 flex flex-col gap-1 pl-3 border-l overflow-y-auto ${
                currentTheme?.["border-primary-dark"] || ""
            }`}
        >
            <SubHeading2 title="Attributes" padding={false} />
            <Caption2 block className="pb-1">
                Click to insert at cursor
            </Caption2>
            {attributes.length === 0 ? (
                <div className="pt-2">
                    <Caption2 block className="italic">
                        Waiting for hits data&hellip;
                    </Caption2>
                    <Caption2 block className="pt-1 opacity-70">
                        Wire{" "}
                        <span className="font-mono">attributesAvailable</span>{" "}
                        from AlgoliaSearchPage.
                    </Caption2>
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    {attributes.map((attr) => (
                        <AttributeChip
                            key={attr}
                            name={attr}
                            onClick={onAttributeClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Editor content ─────────────────────────────────────────────── */

function TemplateEditorContent({ defaultTemplate, api, uuid }) {
    const { publishEvent, listen, listeners } = useWidgetEvents();

    const [template, setTemplate] = useState(defaultTemplate || "");
    const [transformCode, setTransformCode] = useState("");
    const [activeTab, setActiveTab] = useState("template");
    const [attributes, setAttributes] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [sampleHit, setSampleHit] = useState(null);
    const [previewResult, setPreviewResult] = useState(null);
    const [previewCollapsed, setPreviewCollapsed] = useState(false);

    const templateEditorRef = useRef(null);
    const templateMonacoRef = useRef(null);
    const transformEditorRef = useRef(null);
    const transformMonacoRef = useRef(null);

    /* ── Load saved template + transform on mount ── */
    useEffect(() => {
        if (!api || !uuid) {
            setLoaded(true);
            return;
        }
        api.readData({
            uuid,
            callbackComplete: (data) => {
                if (data?.template !== undefined) setTemplate(data.template);
                if (data?.transform !== undefined)
                    setTransformCode(data.transform);
                setLoaded(true);
            },
            callbackError: () => {
                setLoaded(true);
            },
        });
    }, [api, uuid]);

    /* ── Once loaded, publish so AlgoliaSearchPage picks up saved values ── */
    useEffect(() => {
        if (!loaded) return;
        if (template || transformCode) {
            publishEvent("templateChanged", {
                template,
                transform: transformCode,
            });
        }
    }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Listen for attribute data from AlgoliaSearchPage ── */
    listen(listeners, {
        onAttributesAvailable: (data) => {
            const attrs = data?.message?.attributes;
            if (Array.isArray(attrs)) setAttributes(attrs);
            const hit = data?.message?.sampleHit;
            if (hit && typeof hit === "object") setSampleHit(hit);
        },
    });

    /* ── Debounced transform preview ── */
    useEffect(() => {
        if (activeTab !== "transform") return;
        const timer = setTimeout(() => {
            setPreviewResult(runTransformPreview(sampleHit, transformCode));
        }, 300);
        return () => clearTimeout(timer);
    }, [transformCode, sampleHit, activeTab]);

    /* ── Editor change handlers (local state only — publish via Apply) ── */
    const handleTemplateChange = useCallback((value) => {
        setTemplate(value ?? "");
    }, []);

    const handleTransformChange = useCallback((value) => {
        setTransformCode(value ?? "");
    }, []);

    /* ── Explicit publish + persist ── */
    const handleApply = useCallback(() => {
        publishEvent("templateChanged", { template, transform: transformCode });
        if (api && uuid) {
            api.storeData({
                data: { template, transform: transformCode },
                uuid,
                append: false,
                callbackComplete: () => {},
                callbackError: (err) =>
                    console.warn("[TemplateEditor] Failed to save:", err),
            });
        }
    }, [publishEvent, template, transformCode, api, uuid]);

    /* ── Capture Monaco refs on mount (per-tab) ── */
    const handleTemplateEditorMount = useCallback((editor, monaco) => {
        templateEditorRef.current = editor;
        templateMonacoRef.current = monaco;
    }, []);

    const handleTransformEditorMount = useCallback((editor, monaco) => {
        transformEditorRef.current = editor;
        transformMonacoRef.current = monaco;
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
        });
    }, []);

    /* ── Click-to-insert attribute at cursor ── */
    const handleAttributeClick = useCallback(
        (attrName) => {
            const isTemplate = activeTab === "template";
            const editor = isTemplate
                ? templateEditorRef.current
                : transformEditorRef.current;
            const monaco = isTemplate
                ? templateMonacoRef.current
                : transformMonacoRef.current;
            if (!editor || !monaco) return;

            const position = editor.getPosition();
            const insertText = isTemplate
                ? `{{${attrName}}}`
                : `hit.${attrName}`;
            const range = new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
            );

            editor.executeEdits("insert-attribute", [
                { range, text: insertText, forceMoveMarkers: true },
            ]);

            const newCol = position.column + insertText.length;
            editor.setPosition({
                lineNumber: position.lineNumber,
                column: newCol,
            });

            const updatedValue = editor.getValue();
            if (isTemplate) {
                setTemplate(updatedValue);
            } else {
                setTransformCode(updatedValue);
            }
            editor.focus();
        },
        [activeTab]
    );

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Tab bar */}
            <div className="pb-2">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <Tabs.List className="flex flex-wrap">
                        <Tabs.Trigger value="template" className="text-xs">
                            Template
                        </Tabs.Trigger>
                        <Tabs.Trigger value="transform" className="text-xs">
                            Transform
                        </Tabs.Trigger>
                    </Tabs.List>
                </Tabs>
            </div>

            <div className="flex flex-1 min-h-0 gap-0">
                <div className="flex-1 min-w-0">
                    {activeTab === "template" ? (
                        <CodeEditorVS
                            code={template}
                            onChange={handleTemplateChange}
                            onMount={handleTemplateEditorMount}
                            language="html"
                            minimapEnabled={false}
                            wordWrap="on"
                        />
                    ) : (
                        <CodeEditorVS
                            code={transformCode}
                            onChange={handleTransformChange}
                            onMount={handleTransformEditorMount}
                            language="javascript"
                            minimapEnabled={false}
                            wordWrap="on"
                        />
                    )}
                </div>
                <AttributePanel
                    attributes={attributes}
                    onAttributeClick={handleAttributeClick}
                />
            </div>
            {activeTab === "transform" && (
                <TransformPreview
                    previewResult={previewResult}
                    collapsed={previewCollapsed}
                    onToggle={() => setPreviewCollapsed((c) => !c)}
                />
            )}
            <div className="flex items-center justify-end pt-2">
                <Button size="sm" onClick={handleApply}>
                    Apply Template
                </Button>
            </div>
        </div>
    );
}

/* ─── Widget wrapper ─────────────────────────────────────────────── */

export const AlgoliaSearchTemplateEditor = ({
    title = "Template Editor",
    defaultTemplate = "",
    api,
    uuid,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel title={title}>
                <TemplateEditorContent
                    defaultTemplate={defaultTemplate}
                    api={api}
                    uuid={uuid}
                />
            </Panel>
        </Widget>
    );
};
