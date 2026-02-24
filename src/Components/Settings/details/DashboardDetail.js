import React, { useContext } from "react";
import {
    Button,
    ButtonIcon,
    InputText,
    SelectInput,
    ThemeContext,
    deepCopy,
    FontAwesomeIcon,
    SubHeading,
} from "@trops/dash-react";

/**
 * LayoutPreview — renders a mini CSS grid thumbnail from a workspace's
 * LayoutGridContainer, using the same skeleton pattern as TemplateCard.
 */
const LayoutPreview = ({ layout }) => {
    const gridRoot = (layout || []).find(
        (item) => item.component === "LayoutGridContainer"
    );
    const grid = gridRoot?.grid || null;

    if (!grid || !grid.rows || !grid.cols) return null;

    // Build preview cells from grid keys (e.g. "1.1", "2.3")
    const previewCells = [];
    for (let r = 1; r <= grid.rows; r++) {
        for (let c = 1; c <= grid.cols; c++) {
            const key = `${r}.${c}`;
            const cell = grid[key];
            if (!cell || cell.hide) continue;
            const colSpan = cell.span?.col || undefined;
            const rowSpan = cell.span?.row || undefined;
            previewCells.push({ row: r, col: c, colSpan, rowSpan });
        }
    }

    if (previewCells.length === 0) return null;

    return (
        <div
            className="flex-1 min-h-0 w-full rounded bg-white/5 border border-white/10 p-2 overflow-hidden"
            style={{
                display: "grid",
                gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
                gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                gap: "4px",
            }}
        >
            {previewCells.map((cell, i) => (
                <div
                    key={i}
                    className="rounded-sm overflow-hidden border border-white/10 bg-white/5"
                    style={{
                        gridColumn: cell.colSpan
                            ? `span ${cell.colSpan}`
                            : undefined,
                        gridRow: cell.rowSpan
                            ? `span ${cell.rowSpan}`
                            : undefined,
                    }}
                >
                    {/* Mini panel header bar */}
                    <div className="h-1.5 bg-white/10" />
                    {/* Mini content placeholder lines */}
                    <div className="p-1 space-y-0.5">
                        <div className="h-0.5 w-3/4 rounded-full bg-white/5" />
                        <div className="h-0.5 w-1/2 rounded-full bg-white/5" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export const DashboardDetail = ({
    workspace,
    menuItems = [],
    editingId,
    editName,
    setEditName,
    onStartRename,
    onSaveRename,
    onCancelRename,
    onDuplicate,
    onDelete,
    dashApi = null,
    credentials = null,
    onReloadWorkspaces = null,
}) => {
    const ws = workspace;
    const isEditing = editingId === ws.id;
    const widgetCount = (ws.layout || []).length;
    const appId = credentials?.appId;
    const { themes } = useContext(ThemeContext);

    const folderOptions = menuItems.map((m) => ({
        label: m.name,
        value: String(m.id),
    }));

    const themeOptions = [
        { label: "App Default", value: "" },
        ...Object.entries(themes || {}).map(([key, t]) => ({
            label: t.name || key,
            value: key,
        })),
    ];

    function handleChangeFolder(val) {
        if (!dashApi || !appId) return;
        const updated = deepCopy(ws);
        updated.menuId = val ? Number(val) : null;
        // Strip widgetConfig from layout before saving
        updated.layout = (updated.layout || []).map((layoutItem) => {
            const cleaned = { ...layoutItem };
            delete cleaned.widgetConfig;
            return cleaned;
        });
        dashApi.saveWorkspace(
            appId,
            updated,
            () => {
                onReloadWorkspaces && onReloadWorkspaces();
            },
            (e, err) => console.error("Change folder error:", err)
        );
    }

    function handleChangeTheme(val) {
        if (!dashApi || !appId) return;
        const updated = deepCopy(ws);
        updated.themeKey = val || null;
        updated.layout = (updated.layout || []).map((layoutItem) => {
            const cleaned = { ...layoutItem };
            delete cleaned.widgetConfig;
            return cleaned;
        });
        dashApi.saveWorkspace(
            appId,
            updated,
            () => {
                onReloadWorkspaces && onReloadWorkspaces();
            },
            (e, err) => console.error("Change theme error:", err)
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Body */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-6 gap-6">
                {/* Name */}
                <div className="flex-shrink-0 flex flex-row items-center justify-between">
                    {isEditing ? (
                        <div className="flex flex-row items-center gap-2 flex-1">
                            <InputText
                                value={editName}
                                onChange={(value) => setEditName(value)}
                                placeholder="Dashboard name"
                                className="flex-1"
                            />
                            <ButtonIcon
                                icon="check"
                                onClick={() => onSaveRename(ws)}
                                size="sm"
                            />
                            <ButtonIcon
                                icon="xmark"
                                onClick={onCancelRename}
                                size="sm"
                            />
                        </div>
                    ) : (
                        <SubHeading
                            title={ws.name || "Untitled"}
                            padding={false}
                        />
                    )}
                </div>

                {/* Info */}
                <div className="flex-shrink-0 flex flex-col space-y-3">
                    <SelectInput
                        label="Folder"
                        value={String(ws.menuId || "")}
                        onChange={(val) => handleChangeFolder(val)}
                        options={folderOptions}
                        placeholder="No folder"
                    />
                    <SelectInput
                        label="Theme"
                        value={ws.themeKey || ""}
                        onChange={(val) => handleChangeTheme(val)}
                        options={themeOptions}
                        placeholder="App Default"
                    />
                    <div className="flex flex-row items-center gap-2">
                        <FontAwesomeIcon
                            icon="th-large"
                            className="h-3 w-3 opacity-50"
                        />
                        <span className="text-sm opacity-70">
                            {widgetCount} widget{widgetCount !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>

                {/* Layout Preview */}
                <LayoutPreview layout={ws.layout} />
            </div>

            {/* Footer */}
            {!isEditing && (
                <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-6 py-4 border-t border-white/10">
                    <Button
                        title="Rename"
                        onClick={() => onStartRename(ws)}
                        size="sm"
                    />
                    <Button
                        title="Duplicate"
                        onClick={() => onDuplicate(ws)}
                        size="sm"
                    />
                    <Button
                        title="Delete"
                        onClick={() => onDelete(ws)}
                        size="sm"
                    />
                </div>
            )}
        </div>
    );
};
