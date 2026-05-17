/**
 * ComposerPaneV2 — grid-based replacement for ComposerPane.
 *
 * Right-pane composition surface that flips the model from
 * tree-of-children to recursive grid-of-cells (gridLayout.js).
 * Layout-first: the user lays out rows/columns, then drops a
 * component into each cell, then wires it via the existing
 * PropertyInspector.
 *
 * External contract mirrors ComposerPane so the modal can swap
 * between them behind a feature flag:
 *   - onEmit({componentCode, configCode, files}) — fires on every
 *     grid mutation (via gridEmitter).
 *   - onChange(grid) — host persists the grid in the draft.
 *   - initialGrid — host supplies the saved grid on resume.
 *   - selectedCellId + onSelectedCellChange — controlled selection
 *     so the preview iframe's click-to-pick can drive the inspector.
 */

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    makeEmptyGrid,
    addRow,
    removeRow,
    splitCell,
    removeCell,
    setCellComponent,
    setCellType,
    clearCellComponent,
    moveCellWithinGrid,
    isGridEmpty,
} from "./gridLayout";
import { QuickStartPane } from "./QuickStartPane";
import { emitGridWidgetCode } from "./gridEmitter";
import {
    updateNodeProp,
    setSlotMode,
    setSlotWire,
    setSlotPipe,
    clearSlotWire,
    setSlotArg,
    setSlotFieldMap,
} from "./composerEmitter";
import { GridEditor } from "./GridEditor";
import { PaletteView } from "./PaletteView";
import { PropertyInspector } from "./PropertyInspector";
import { getComponentSchema } from "../dashReactComponentSchemas";

/**
 * True when the component's schema exposes nothing the inspector
 * can meaningfully edit — `children` is the only prop, no data slots,
 * no auto-state. Used to skip auto-selection after add so containers
 * like Panel/Card/Container don't pop the inspector for no reason.
 */
function hasEditableProps(componentName) {
    const schema = getComponentSchema(componentName);
    if (!schema) return false;
    const propKeys = Object.keys(schema.props || {}).filter(
        (k) => k !== "children"
    );
    if (propKeys.length > 0) return true;
    if (Array.isArray(schema.dataSlots) && schema.dataSlots.length > 0) {
        return true;
    }
    return false;
}

export function ComposerPaneV2({
    onEmit,
    onChange,
    providers = {},
    initialGrid = null,
    selectedCellId: controlledSelectedCellId = null,
    onSelectedCellChange,
    // LLM context for the empty-state quick-start pane. Same shape
    // the modal already threads into SuggestLayoutButton in V1.
    apiKey = null,
    model = null,
    backend = "claude-code",
}) {
    const [grid, setGridRaw] = useState(() => initialGrid || makeEmptyGrid());
    const [internalSelectedCellId, setInternalSelectedCellId] = useState(null);
    // True once the user has typed in the widget-name input. Gates
    // the on-mount collision-avoidance effect so it doesn't fight a
    // manually-chosen name. V1 ComposerPane had the same gate; V2
    // lost it when it forked, which let "ComposedWidget" collide
    // with an existing @ai-built/composedwidget on install and
    // silently overwrite that widget's code.
    const userRenamedRef = useRef(false);
    // When set, the pane swaps to the full-pane PaletteView, and
    // picking a component fills this cell. Separate from selection
    // so the inspector state stays untouched while the user picks.
    const [paletteTargetCellId, setPaletteTargetCellId] = useState(null);
    const isControlled = typeof onSelectedCellChange === "function";
    const selectedCellId = isControlled
        ? controlledSelectedCellId
        : internalSelectedCellId;
    const setSelectedCellId = useCallback(
        (id) => {
            if (isControlled) onSelectedCellChange(id);
            else setInternalSelectedCellId(id);
        },
        [isControlled, onSelectedCellChange]
    );

    // Pure state updater — onChange + onEmit fire from a useEffect
    // below so they run AFTER React commits. Calling parent setState
    // from inside the state updater would trip React's "setState
    // during render" warning (WidgetBuilderModal updates its draft
    // state when onChange fires, which React detects as a cross-
    // component update during ComposerPaneV2's render phase).
    const setGrid = useCallback((next) => {
        setGridRaw(next);
    }, []);

    // Keep callbacks in refs so the sync effect only re-runs when
    // `grid` actually changes — without this, every parent re-render
    // creates new onChange/onEmit identities and re-triggers the
    // effect, doubling work and (worse) re-emitting the same grid
    // to the parent, which can cascade into setState loops.
    const onChangeRef = useRef(onChange);
    const onEmitRef = useRef(onEmit);
    useEffect(() => {
        onChangeRef.current = onChange;
        onEmitRef.current = onEmit;
    });

    // Sync grid changes out to the host. Fires on every grid change
    // including the initial mount, so this single effect replaces
    // both the per-mutation onChange/onEmit calls AND the dedicated
    // "initial emit" effect.
    useEffect(() => {
        if (typeof onChangeRef.current === "function") {
            onChangeRef.current(grid);
        }
        if (typeof onEmitRef.current === "function") {
            onEmitRef.current(emitGridWidgetCode(grid));
        }
    }, [grid]);

    // On first mount (no draft resume): ask the main process for
    // already-installed @ai-built/ widgets and bump the default
    // "ComposedWidget" to "ComposedWidget2", "...3", etc. until
    // the name is unique. Without this, installing a fresh widget
    // overwrites the previously-installed ComposedWidget — the
    // install pipeline keys on componentName, so a name collision
    // silently rewrites the existing widget's code. Ported from V1
    // ComposerPane after a V2 regression let the default name
    // through unchanged.
    useEffect(() => {
        if (initialGrid) return; // resuming a draft — keep its name
        if (userRenamedRef.current) return; // user typed something
        const getConfigs = window.mainApi?.widgets?.getComponentConfigs;
        if (typeof getConfigs !== "function") return; // jsdom / tests
        let cancelled = false;
        (async () => {
            try {
                const configs = (await getConfigs()) || [];
                if (cancelled) return;
                // Re-check after the await — the user may have typed
                // a name while we waited for the IPC to come back.
                if (userRenamedRef.current) return;
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
                const nextName = `${base}${n}`;
                setGridRaw((prev) =>
                    prev.widgetName === nextName
                        ? prev
                        : { ...prev, widgetName: nextName }
                );
            } catch {
                // Lookup failed — leave the default name. The install
                // pipeline still errors visibly on a real collision,
                // so this is a UX nicety, not a safety net.
            }
        })();
        return () => {
            cancelled = true;
        };
        // One-shot at mount only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Grid editor handlers ────────────────────────────────────
    const handleAddRow = useCallback(
        (gridId) => setGrid((g) => addRow(g, gridId)),
        [setGrid]
    );
    const handleRemoveRow = useCallback(
        (gridId, rowIdx) => setGrid((g) => removeRow(g, gridId, rowIdx)),
        [setGrid]
    );
    const handleSplitCell = useCallback(
        (cellId) => setGrid((g) => splitCell(g, cellId)),
        [setGrid]
    );
    const handleRemoveCell = useCallback(
        (cellId) => {
            setGrid((g) => removeCell(g, cellId));
            if (selectedCellId === cellId) setSelectedCellId(null);
        },
        [setGrid, selectedCellId, setSelectedCellId]
    );
    const handleSetCellComponent = useCallback(
        (cellId, componentName, props) => {
            setGrid((g) => setCellComponent(g, cellId, componentName, props));
            // Auto-open the inspector ONLY for components that have
            // something worth editing. Pure containers (Panel, Card,
            // Container — children-only schemas) have no props or
            // wires to surface, so popping the inspector is wasted
            // navigation. The user can still click the cell later
            // to inspect — this just skips the auto-jump.
            if (hasEditableProps(componentName)) {
                setSelectedCellId(cellId);
            } else {
                setSelectedCellId(null);
            }
        },
        [setGrid, setSelectedCellId]
    );
    const handleMoveCell = useCallback(
        (cellId, target) => {
            setGrid((g) => moveCellWithinGrid(g, cellId, target));
        },
        [setGrid]
    );
    const handleChangeType = useCallback(
        (cellId, newType) => {
            setGrid((g) => setCellType(g, cellId, newType));
        },
        [setGrid]
    );

    // Fired by the GridEditor's empty-cell "+ Add" button. We swap
    // the pane to the PaletteView; picking a component there fills
    // this cell and returns to the composition view.
    const handleRequestPalette = useCallback(
        (cellId) => setPaletteTargetCellId(cellId),
        []
    );
    const handlePalettePick = useCallback(
        (componentName) => {
            if (!paletteTargetCellId) return;
            const targetCellId = paletteTargetCellId;
            setPaletteTargetCellId(null);
            handleSetCellComponent(targetCellId, componentName);
        },
        [paletteTargetCellId, handleSetCellComponent]
    );
    const handlePaletteCancel = useCallback(
        () => setPaletteTargetCellId(null),
        []
    );

    // ── Inspector handlers (translate cell-id-based ops to the
    // existing tree-shaped mutators by shimming cell.component as
    // a node).
    //
    // The existing per-prop / per-wire mutators (updateNodeProp,
    // setSlotMode, setSlotWire, …) expect a tree-shaped input. We
    // adapt by carving out the cell's component-shaped node,
    // running the mutator, then folding the result back into the
    // grid's cells map. This keeps the inspector code path
    // unchanged through G2 — G3 may refactor those mutators to
    // operate on flat cells directly.
    const applyCellMutator = useCallback(
        (cellId, mutator) => {
            setGrid((g) => {
                const cell = g.cells[cellId];
                if (!cell || cell.kind === "empty") return g;
                const treeShim = {
                    root: {
                        id: cellId,
                        type: cell.type,
                        props: cell.props || {},
                        wires: cell.wires || {},
                        children: [],
                    },
                };
                const next = mutator(treeShim);
                const nextNode = next.root;
                return {
                    ...g,
                    cells: {
                        ...g.cells,
                        [cellId]: {
                            ...cell,
                            props: nextNode.props || {},
                            wires: nextNode.wires || cell.wires || {},
                        },
                    },
                };
            });
        },
        [setGrid]
    );

    const handleChangeProp = useCallback(
        (cellId, propName, value) =>
            applyCellMutator(cellId, (t) =>
                updateNodeProp(t, cellId, propName, value)
            ),
        [applyCellMutator]
    );
    const handleSetSlotMode = useCallback(
        (cellId, propName, mode) =>
            applyCellMutator(cellId, (t) =>
                setSlotMode(t, cellId, propName, mode)
            ),
        [applyCellMutator]
    );
    const handleSetSlotWire = useCallback(
        (cellId, propName, wire) =>
            applyCellMutator(cellId, (t) =>
                setSlotWire(t, cellId, propName, wire)
            ),
        [applyCellMutator]
    );
    const handleClearSlotWire = useCallback(
        (cellId, propName) =>
            applyCellMutator(cellId, (t) => clearSlotWire(t, cellId, propName)),
        [applyCellMutator]
    );
    const handleSetSlotPipe = useCallback(
        (cellId, propName, sourceNodeId, sourcePropName) =>
            applyCellMutator(cellId, (t) =>
                setSlotPipe(t, cellId, propName, sourceNodeId, sourcePropName)
            ),
        [applyCellMutator]
    );
    const handleSetSlotArg = useCallback(
        (cellId, propName, argName, binding) =>
            applyCellMutator(cellId, (t) =>
                setSlotArg(t, cellId, propName, argName, binding)
            ),
        [applyCellMutator]
    );
    const handleSetSlotFieldMap = useCallback(
        (cellId, propName, fieldMap) =>
            applyCellMutator(cellId, (t) =>
                setSlotFieldMap(t, cellId, propName, fieldMap)
            ),
        [applyCellMutator]
    );

    // Selected cell → synthesize a node-shape for the inspector.
    // Empty cells deselect (inspector hides). Layouts / containers
    // with no editable props (Panel/Card/Container/etc.) also hide
    // the inspector — clicking them still shows selection feedback
    // in the editor, but popping a "nothing to edit here" inspector
    // would just be visual noise.
    const selectedNode = useMemo(() => {
        if (!selectedCellId) return null;
        const cell = grid.cells[selectedCellId];
        if (!cell || cell.kind === "empty") return null;
        if (!hasEditableProps(cell.type)) return null;
        return {
            id: selectedCellId,
            type: cell.type,
            props: cell.props || {},
            wires: cell.wires || {},
            children: [],
        };
    }, [grid, selectedCellId]);

    // Build a tree-shim of all leaf cells so the WirePicker's
    // "pipe from existing wire" enumeration finds wireable
    // siblings across the grid.
    const treeShimForPipes = useMemo(() => {
        const children = [];
        for (const cell of Object.values(grid.cells)) {
            if (cell.kind === "leaf") {
                children.push({
                    id: cell.id,
                    type: cell.type,
                    props: cell.props || {},
                    wires: cell.wires || {},
                    children: [],
                });
            }
        }
        return {
            root: { id: "grid-root", type: "Panel", props: {}, children },
        };
    }, [grid]);

    return (
        <div
            className="flex flex-col h-full min-h-0 text-gray-200"
            data-testid="composer-pane-v2"
        >
            <div className="px-3 py-2 border-b border-white/10 shrink-0">
                <label
                    className="block text-xs text-gray-400 mb-1"
                    htmlFor="composer-widget-name-v2"
                >
                    Widget name
                </label>
                <input
                    id="composer-widget-name-v2"
                    type="text"
                    value={grid.widgetName}
                    onChange={(e) => {
                        // Mark before sanitize/setGrid so the on-mount
                        // collision-bump effect (which is async) won't
                        // overwrite the user's typed name if it lands
                        // between this keystroke and the next render.
                        userRenamedRef.current = true;
                        const sanitized = e.target.value.replace(
                            /[^A-Za-z0-9_]/g,
                            ""
                        );
                        setGrid((g) => ({
                            ...g,
                            widgetName: sanitized || "ComposedWidget",
                        }));
                    }}
                    className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                    data-testid="composer-widget-name"
                />
            </div>
            {/* Four view modes share the pane below the name input:
                  - palette     (user clicked + Add on an empty cell)
                  - inspector   (user clicked a filled cell to edit it)
                  - quick-start (grid is empty — onboarding pane)
                  - composition (default — the grid editor)
                Each takes the full pane height so the user isn't
                fighting cramped sections. The quick-start branch
                naturally hides as soon as the grid is no longer
                empty, so a sample-apply / AI-pick / drop transitions
                straight into the composition view. */}
            {paletteTargetCellId ? (
                <PaletteView
                    onPick={handlePalettePick}
                    onCancel={handlePaletteCancel}
                />
            ) : selectedNode ? (
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        <PropertyInspector
                            node={selectedNode}
                            tree={treeShimForPipes}
                            providers={providers}
                            onChangeProp={handleChangeProp}
                            onChangeType={handleChangeType}
                            onSetSlotMode={handleSetSlotMode}
                            onSetSlotWire={handleSetSlotWire}
                            onClearSlotWire={handleClearSlotWire}
                            onSetSlotPipe={handleSetSlotPipe}
                            onSetSlotArg={handleSetSlotArg}
                            onSetSlotFieldMap={handleSetSlotFieldMap}
                            onClose={() => setSelectedCellId(null)}
                        />
                    </div>
                    <div className="shrink-0 border-t border-white/10 px-3 py-3 bg-gray-900">
                        <button
                            type="button"
                            onClick={() => setSelectedCellId(null)}
                            className="w-full px-3 py-3 text-sm font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                            data-testid="composer-inspector-done"
                        >
                            Done editing
                        </button>
                    </div>
                </div>
            ) : isGridEmpty(grid) ? (
                <QuickStartPane
                    onApplyGrid={(next) => setGrid(next)}
                    onRequestPalette={handleRequestPalette}
                    seedCellId={grid.grids[grid.rootGridId].rows[0].cells[0]}
                    apiKey={apiKey}
                    model={model}
                    backend={backend}
                    providers={providers}
                />
            ) : (
                <div className="flex-1 min-h-0 flex flex-col px-3 py-2 gap-1">
                    <div className="text-xs uppercase tracking-wide text-gray-500 shrink-0">
                        Composition
                    </div>
                    {/* Editor flexes to fill the remaining height so
                        the runtime-mirrored sizing rules inside it
                        (containers fill, primitives sit at content
                        height) have an actual height to resolve
                        against. min-h-0 lets nested grids shrink
                        below their content's intrinsic size. */}
                    <div
                        className="flex-1 min-h-0 overflow-y-auto"
                        data-testid="composer-grid-editor-host"
                    >
                        <GridEditor
                            grid={grid}
                            selectedCellId={selectedCellId}
                            onSelectCell={setSelectedCellId}
                            onAddRow={handleAddRow}
                            onRemoveRow={handleRemoveRow}
                            onSplitCell={handleSplitCell}
                            onRemoveCell={handleRemoveCell}
                            onRequestPalette={handleRequestPalette}
                            onMoveCell={handleMoveCell}
                        />
                    </div>
                </div>
            )}
            {/* clearCellComponent isn't surfaced as a button yet — it
                lives on the gridLayout API for future "reset cell"
                affordances. Referenced here so the linter sees it
                as intentionally imported. */}
            {false && clearCellComponent}
        </div>
    );
}
