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
    clearCellComponent,
} from "./gridLayout";
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

export function ComposerPaneV2({
    onEmit,
    onChange,
    providers = {},
    initialGrid = null,
    selectedCellId: controlledSelectedCellId = null,
    onSelectedCellChange,
}) {
    const [grid, setGridRaw] = useState(() => initialGrid || makeEmptyGrid());
    const [internalSelectedCellId, setInternalSelectedCellId] = useState(null);
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
            setSelectedCellId(cellId);
        },
        [setGrid, setSelectedCellId]
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
    // Empty cells deselect (inspector hides).
    const selectedNode = useMemo(() => {
        if (!selectedCellId) return null;
        const cell = grid.cells[selectedCellId];
        if (!cell || cell.kind === "empty") return null;
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
            {/* Three view modes share the pane below the name input:
                  - palette    (user clicked + Add on an empty cell)
                  - inspector  (user clicked a filled cell to edit it)
                  - composition (default)
                Each takes the full pane height so the user isn't
                fighting cramped sections. */}
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
                            onSetSlotMode={handleSetSlotMode}
                            onSetSlotWire={handleSetSlotWire}
                            onClearSlotWire={handleClearSlotWire}
                            onSetSlotPipe={handleSetSlotPipe}
                            onSetSlotArg={handleSetSlotArg}
                            onSetSlotFieldMap={handleSetSlotFieldMap}
                            onClose={() => setSelectedCellId(null)}
                        />
                    </div>
                    <div className="shrink-0 border-t border-white/10 px-3 py-2 bg-gray-900">
                        <button
                            type="button"
                            onClick={() => setSelectedCellId(null)}
                            className="w-full px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                            data-testid="composer-inspector-done"
                        >
                            Done editing
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Composition
                    </div>
                    <GridEditor
                        grid={grid}
                        selectedCellId={selectedCellId}
                        onSelectCell={setSelectedCellId}
                        onAddRow={handleAddRow}
                        onRemoveRow={handleRemoveRow}
                        onSplitCell={handleSplitCell}
                        onRemoveCell={handleRemoveCell}
                        onRequestPalette={handleRequestPalette}
                    />
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
