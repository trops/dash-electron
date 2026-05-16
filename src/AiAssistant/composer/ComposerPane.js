import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    DASH_REACT_COMPONENT_SCHEMAS,
    getSchemasByCategory,
} from "../dashReactComponentSchemas";
import {
    makeEmptyTree,
    emitWidgetCode,
    insertChild,
    removeNode,
    updateNodeProp,
    setSlotMode,
    getNodeById,
} from "./composerEmitter";
import { PropertyInspector } from "./PropertyInspector";

/**
 * ComposerPane — Compose-mode replacement for the chat panel in
 * the right side of WidgetBuilderModal. Stage 1: pick components
 * from a palette, see them in a tree, and emit a data-less widget
 * skeleton into the existing compile/preview pipeline.
 *
 * Layout (within the right-side ~1/3 column):
 *   ┌──────────────────────────────────────┐
 *   │ Widget name input                    │
 *   ├──────────────────────────────────────┤
 *   │ Composition tree (current state)     │
 *   │   - root: Panel                      │
 *   │     - Heading "Sample"   [×]         │
 *   │     - Table              [×]         │
 *   ├──────────────────────────────────────┤
 *   │ Palette (collapsible by category)    │
 *   │   layout / display / input / …       │
 *   │     [+ Heading]  [+ Table]  …        │
 *   └──────────────────────────────────────┘
 *
 * `onEmit({ componentCode, configCode, files })` is called whenever
 * the tree changes — the modal threads this into compilePreview so
 * the left-side Preview tab updates live without a manual Apply.
 * Pattern mirrors the build-mode flow where ChatCore's emit fires
 * on every assistant response.
 *
 * Stages C2+ add: per-component property inspector, nested-parent
 * inserts (currently every add lands as a direct child of root),
 * data-slot wiring to providers, and AI suggest buttons. The pane's
 * external contract (`onEmit`) does not change as those land.
 */
export function ComposerPane({ onEmit, initialTree = null }) {
    const [tree, setTree] = useState(() => initialTree || makeEmptyTree());
    const idCounter = useRef(1);
    const [collapsedCategories, setCollapsedCategories] = useState(
        () => new Set()
    );
    // C2: when a tree node is selected, the bottom pane flips from
    // palette → property inspector for that node. null = no
    // selection → palette is shown.
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const selectedNode = useMemo(
        () => getNodeById(tree, selectedNodeId),
        [tree, selectedNodeId]
    );

    const groupedSchemas = useMemo(() => getSchemasByCategory(), []);
    const categoryOrder = ["layout", "display", "input", "action", "feedback"];

    const emit = useCallback(
        (nextTree) => {
            if (typeof onEmit === "function") {
                onEmit(emitWidgetCode(nextTree));
            }
        },
        [onEmit]
    );

    const handleAdd = useCallback(
        (componentName) => {
            idCounter.current += 1;
            const next = insertChild(
                tree,
                tree.root.id,
                { type: componentName, props: {}, children: [] },
                idCounter.current
            );
            setTree(next);
            emit(next);
        },
        [tree, emit]
    );

    const handleRemove = useCallback(
        (nodeId) => {
            const next = removeNode(tree, nodeId);
            setTree(next);
            emit(next);
            // Deselect if the user nuked the node they were editing.
            if (selectedNodeId === nodeId) setSelectedNodeId(null);
        },
        [tree, emit, selectedNodeId]
    );

    const handleChangeProp = useCallback(
        (nodeId, propName, value) => {
            const next = updateNodeProp(tree, nodeId, propName, value);
            setTree(next);
            emit(next);
        },
        [tree, emit]
    );

    const handleSetSlotMode = useCallback(
        (nodeId, propName, mode) => {
            const next = setSlotMode(tree, nodeId, propName, mode);
            setTree(next);
            emit(next);
        },
        [tree, emit]
    );

    const handleRename = useCallback(
        (e) => {
            const raw = e.target.value;
            // Strip anything that isn't a valid JS identifier char.
            // The widget name flows into `export default function
            // <Name>()` and `component: "<Name>"`, both of which
            // require an identifier — silently sanitizing here is
            // friendlier than rejecting the keystroke.
            const sanitized = raw.replace(/[^A-Za-z0-9_]/g, "");
            const next = { ...tree, widgetName: sanitized || "ComposedWidget" };
            setTree(next);
            emit(next);
        },
        [tree, emit]
    );

    const toggleCategory = useCallback((cat) => {
        setCollapsedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    }, []);

    return (
        <div
            className="flex flex-col h-full min-h-0 text-gray-200"
            data-testid="composer-pane"
        >
            <div className="px-3 py-2 border-b border-white/10 shrink-0">
                <label
                    className="block text-[11px] text-gray-400 mb-1"
                    htmlFor="composer-widget-name"
                >
                    Widget name
                </label>
                <input
                    id="composer-widget-name"
                    type="text"
                    value={tree.widgetName}
                    onChange={handleRename}
                    className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                    data-testid="composer-widget-name"
                />
            </div>

            <div className="px-3 py-2 border-b border-white/10 shrink-0">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                    Composition
                </div>
                <ComposerTreeView
                    node={tree.root}
                    depth={0}
                    onRemove={handleRemove}
                    selectedNodeId={selectedNodeId}
                    onSelect={setSelectedNodeId}
                />
            </div>

            {selectedNode ? (
                <div className="flex-1 min-h-0">
                    <PropertyInspector
                        node={selectedNode}
                        onChangeProp={handleChangeProp}
                        onSetSlotMode={handleSetSlotMode}
                        onClose={() => setSelectedNodeId(null)}
                    />
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                        Palette
                    </div>
                    {categoryOrder.map((cat) => {
                        const names = groupedSchemas[cat];
                        if (!names || names.length === 0) return null;
                        const collapsed = collapsedCategories.has(cat);
                        return (
                            <div key={cat} className="mb-3">
                                <button
                                    type="button"
                                    onClick={() => toggleCategory(cat)}
                                    className="flex items-center w-full text-left text-xs text-gray-400 hover:text-gray-200 mb-1"
                                    data-testid={`composer-category-${cat}`}
                                >
                                    <span className="mr-1">
                                        {collapsed ? "▸" : "▾"}
                                    </span>
                                    <span className="capitalize">{cat}</span>
                                    <span className="ml-2 text-gray-600">
                                        ({names.length})
                                    </span>
                                </button>
                                {!collapsed && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {names.map((name) => (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => handleAdd(name)}
                                                className="px-2 py-1 text-xs bg-gray-800 hover:bg-indigo-700 border border-gray-700 hover:border-indigo-500 rounded text-gray-300 hover:text-white transition-colors"
                                                data-testid={`composer-add-${name}`}
                                                title={`Add a <${name}> to the widget`}
                                            >
                                                + {name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ComposerTreeView({ node, depth, onRemove, selectedNodeId, onSelect }) {
    if (!node) return null;
    const pad = depth * 12;
    const schema = DASH_REACT_COMPONENT_SCHEMAS[node.type];
    const childList = Array.isArray(node.children) ? node.children : [];
    const isRoot = depth === 0;
    const isSelected = selectedNodeId === node.id;

    return (
        <div>
            <div
                className={`flex items-center justify-between py-0.5 text-sm rounded cursor-pointer ${
                    isSelected
                        ? "bg-indigo-600/20 text-indigo-200"
                        : "hover:bg-gray-800"
                }`}
                style={{ paddingLeft: pad }}
                onClick={() => onSelect && onSelect(node.id)}
                data-testid={`composer-node-${node.id}`}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-gray-300">{node.type}</span>
                    {schema && schema.category && (
                        <span className="text-[10px] text-gray-500">
                            {schema.category}
                        </span>
                    )}
                </div>
                {!isRoot && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(node.id);
                        }}
                        className="text-gray-500 hover:text-red-400 px-1"
                        aria-label={`Remove ${node.type}`}
                        data-testid={`composer-remove-${node.id}`}
                    >
                        ×
                    </button>
                )}
            </div>
            {childList.map((child) => (
                <ComposerTreeView
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    onRemove={onRemove}
                    selectedNodeId={selectedNodeId}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}
