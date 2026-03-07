/**
 * AlgoliaSearchTemplateEditor
 *
 * Monaco-powered Mustache template editor with an attribute sidebar populated
 * from live Algolia hit data.  Communicates with AlgoliaSearchPage via the
 * Dash event system so template changes appear in real time.
 *
 * @package Algolia Search
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Panel, SubHeading2, CodeEditorVS } from "@trops/dash-react";
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
    if (!previewResult) return null;

    const { status, output, error } = previewResult;

    return (
        <div className="border border-gray-700 rounded mt-2 overflow-hidden">
            <button
                onClick={onToggle}
                className="flex items-center justify-between w-full px-3 py-1.5 bg-white/5 hover:bg-white/10 transition-colors text-xs text-gray-400"
            >
                <span className="font-medium">Transform Preview</span>
                <span className="text-gray-500">
                    {collapsed ? "+" : "\u2013"}
                </span>
            </button>
            {!collapsed && (
                <div className="px-3 py-2 max-h-48 overflow-y-auto">
                    {status === "empty" && (
                        <div className="text-xs text-gray-500 italic">
                            Waiting for search results&hellip;
                        </div>
                    )}
                    {status === "passthrough" && (
                        <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(output, null, 2)}
                        </pre>
                    )}
                    {status === "success" && (
                        <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(output, null, 2)}
                        </pre>
                    )}
                    {status === "error" && (
                        <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1.5 font-mono">
                            {error}
                        </div>
                    )}
                    {status === "warning" && (
                        <div className="text-xs text-amber-400">{error}</div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── Attribute sidebar ──────────────────────────────────────────── */

function AttributeChip({ name, onClick }) {
    return (
        <button
            onClick={() => onClick(name)}
            className="text-left text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-gray-100 transition-colors truncate font-mono"
        >
            {name}
        </button>
    );
}

function AttributePanel({ attributes, onAttributeClick }) {
    return (
        <div className="w-48 flex-shrink-0 flex flex-col gap-1 pl-3 border-l border-gray-700 overflow-y-auto">
            <SubHeading2 title="Attributes" padding={false} />
            <div className="text-[10px] text-gray-500 pb-1">
                Click to insert at cursor
            </div>
            {attributes.length === 0 ? (
                <div className="text-xs text-gray-500 italic pt-2">
                    Waiting for hits data&hellip;
                    <div className="pt-1 text-[10px] text-gray-600">
                        Wire{" "}
                        <span className="font-mono">attributesAvailable</span>{" "}
                        from AlgoliaSearchPage.
                    </div>
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

    const tabBase =
        "px-3 py-1 text-xs font-medium rounded-full transition-colors";
    const activeStyle = `${tabBase} bg-blue-600 text-white`;
    const inactiveStyle = `${tabBase} bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10`;

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Tab bar */}
            <div className="flex items-center gap-1 pb-2">
                <button
                    className={
                        activeTab === "template" ? activeStyle : inactiveStyle
                    }
                    onClick={() => setActiveTab("template")}
                >
                    Template
                </button>
                <button
                    className={
                        activeTab === "transform" ? activeStyle : inactiveStyle
                    }
                    onClick={() => setActiveTab("transform")}
                >
                    Transform
                </button>
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
                <button
                    onClick={handleApply}
                    className="px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                    Apply Template
                </button>
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
