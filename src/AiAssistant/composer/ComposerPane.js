import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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
    setSlotWire,
    setSlotPipe,
    clearSlotWire,
    setSlotArg,
    setSlotFieldMap,
    getNodeById,
} from "./composerEmitter";
import { PropertyInspector } from "./PropertyInspector";
import { SuggestLayoutButton } from "./SuggestLayoutButton";

/**
 * Walk a tree and return the largest N from any `node-N` id seen.
 * Returns 0 for a tree with no numbered ids. Used to seed the id
 * counter when starting from an existing composition (draft resume,
 * suggested layout) so future inserts don't collide with existing
 * ids.
 */
function maxNodeId(root) {
    let max = 0;
    const visit = (n) => {
        if (!n) return;
        const m = (n.id || "").match(/^node-(\d+)$/);
        if (m) {
            const v = parseInt(m[1], 10);
            if (v > max) max = v;
        }
        if (Array.isArray(n.children)) n.children.forEach(visit);
    };
    visit(root);
    return max;
}

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
export function ComposerPane({
    onEmit,
    onTreeChange,
    providers = {},
    initialTree = null,
    apiKey = null,
    model = "claude-sonnet-4-20250514",
    backend = "claude-code",
}) {
    const [tree, setTreeRaw] = useState(() => initialTree || makeEmptyTree());
    // Monotonic id source for new nodes. Seeded from the initial
    // tree's highest node-N id (draft resume) and kept in sync via
    // the effect below — so any path that mutates the tree (palette
    // insert, suggested layout, future external setters) stays
    // collision-free without having to remember to update the ref
    // manually. The ref persists across renders so rapid successive
    // adds within the same event loop also stay unique (functional
    // setTree wouldn't help here because emit() needs the resolved
    // tree synchronously after each insert).
    const idCounter = useRef(initialTree ? maxNodeId(initialTree.root) : 0);
    // Mirror every internal tree mutation out to the host so it can
    // persist the composition with the rest of the draft. Wrapping
    // setTree (rather than firing in every handler) means all in-pane
    // edits — palette inserts, prop changes, wires, pipes, suggested
    // layouts — get observed without each handler needing to remember.
    const setTree = useCallback(
        (next) => {
            setTreeRaw((prev) => {
                const resolved = typeof next === "function" ? next(prev) : next;
                if (typeof onTreeChange === "function" && resolved !== prev) {
                    onTreeChange(resolved);
                }
                return resolved;
            });
        },
        [onTreeChange]
    );
    // Keep idCounter ≥ the tree's actual max node-N id. Runs after
    // every tree mutation so handleApplySuggestedTree / draft
    // resume / any future external setter doesn't need to remember
    // to bump the ref. Without this, applying a suggested layout
    // with node-7 then clicking Add would have given the new node
    // an id colliding with one of the suggestion's nodes.
    useEffect(() => {
        const m = maxNodeId(tree.root);
        if (m > idCounter.current) idCounter.current = m;
    }, [tree]);
    const [collapsedCategories, setCollapsedCategories] = useState(
        () => new Set()
    );
    // Tracks whether the user has manually renamed. We only auto-rename
    // to avoid collisions while the name is still the default (or
    // already a default-with-numeric-suffix we ourselves picked).
    const userRenamedRef = useRef(false);

    // On first mount (when starting from the default tree) ask the main
    // process for the currently installed @ai-built/ packages and bump
    // the default "ComposedWidget" to "ComposedWidget2", "...3", etc.
    // until it doesn't collide. Without this each install silently
    // overwrites the previous ComposedWidget.
    useEffect(() => {
        if (initialTree) return; // user/host supplied a name
        if (userRenamedRef.current) return;
        const getConfigs = window.mainApi?.widgets?.getComponentConfigs;
        if (typeof getConfigs !== "function") return; // jsdom / tests
        let cancelled = false;
        (async () => {
            try {
                const configs = (await getConfigs()) || [];
                if (cancelled) return;
                const taken = new Set();
                for (const c of configs) {
                    if (c?.componentName)
                        taken.add(String(c.componentName).toLowerCase());
                    if (c?.widgetPackage) {
                        const pkg = String(c.widgetPackage).toLowerCase();
                        const slug = pkg.startsWith("@ai-built/")
                            ? pkg.slice("@ai-built/".length)
                            : pkg;
                        taken.add(slug);
                    }
                }
                const base = "ComposedWidget";
                if (!taken.has(base.toLowerCase())) return; // default is fine
                let n = 2;
                while (taken.has(`${base}${n}`.toLowerCase())) n += 1;
                setTree((prev) => ({ ...prev, widgetName: `${base}${n}` }));
                emit({ ...tree, widgetName: `${base}${n}` });
            } catch {
                // Lookup failed (e.g. fresh install with no
                // ComponentManager yet) — leave the default name; the
                // install pipeline can still error visibly if there's a
                // real collision.
            }
        })();
        return () => {
            cancelled = true;
        };
        // Intentionally one-shot at mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
        [tree, emit, setTree]
    );

    const handleRemove = useCallback(
        (nodeId) => {
            const next = removeNode(tree, nodeId);
            setTree(next);
            emit(next);
            // Deselect if the user nuked the node they were editing.
            if (selectedNodeId === nodeId) setSelectedNodeId(null);
        },
        [tree, emit, selectedNodeId, setTree]
    );

    const handleChangeProp = useCallback(
        (nodeId, propName, value) => {
            const next = updateNodeProp(tree, nodeId, propName, value);
            setTree(next);
            emit(next);
        },
        [tree, emit, setTree]
    );

    const handleSetSlotMode = useCallback(
        (nodeId, propName, mode) => {
            const next = setSlotMode(tree, nodeId, propName, mode);
            setTree(next);
            emit(next);
        },
        [tree, emit, setTree]
    );

    const handleSetSlotWire = useCallback(
        (nodeId, propName, wire) => {
            const next = setSlotWire(tree, nodeId, propName, wire);
            setTree(next);
            emit(next);
        },
        [tree, emit, setTree]
    );

    const handleClearSlotWire = useCallback(
        (nodeId, propName) => {
            const next = clearSlotWire(tree, nodeId, propName);
            setTree(next);
            emit(next);
        },
        [tree, emit, setTree]
    );

    const handleSetSlotPipe = useCallback(
        (nodeId, propName, sourceNodeId, sourcePropName) => {
            const next = setSlotPipe(
                tree,
                nodeId,
                propName,
                sourceNodeId,
                sourcePropName
            );
            setTree(next);
            emit(next);
        },
        [tree, emit, setTree]
    );

    const handleSetSlotArg = useCallback(
        (nodeId, propName, argName, binding) => {
            const next = setSlotArg(tree, nodeId, propName, argName, binding);
            setTree(next);
            emit(next);
        },
        [tree, emit, setTree]
    );

    const handleSetSlotFieldMap = useCallback(
        (nodeId, propName, fieldMap) => {
            const next = setSlotFieldMap(tree, nodeId, propName, fieldMap);
            setTree(next);
            emit(next);
        },
        [tree, emit, setTree]
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
            userRenamedRef.current = true;
            const next = { ...tree, widgetName: sanitized || "ComposedWidget" };
            setTree(next);
            emit(next);
        },
        [tree, emit, setTree]
    );

    const handleApplySuggestedTree = useCallback(
        (suggestion) => {
            // No manual idCounter bump needed — the useEffect above
            // syncs it from the new tree on commit.
            const nextTree = {
                widgetName: suggestion.widgetName || tree.widgetName,
                root: suggestion.root,
            };
            setTree(nextTree);
            setSelectedNodeId(null);
            emit(nextTree);
        },
        [tree.widgetName, emit, setTree]
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
                        tree={tree}
                        providers={providers}
                        onChangeProp={handleChangeProp}
                        onSetSlotMode={handleSetSlotMode}
                        onSetSlotWire={handleSetSlotWire}
                        onClearSlotWire={handleClearSlotWire}
                        onSetSlotPipe={handleSetSlotPipe}
                        onSetSlotArg={handleSetSlotArg}
                        onSetSlotFieldMap={handleSetSlotFieldMap}
                        onClose={() => setSelectedNodeId(null)}
                    />
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                    <SuggestLayoutButton
                        apiKey={apiKey}
                        model={model}
                        backend={backend}
                        onApplyTree={handleApplySuggestedTree}
                    />
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
