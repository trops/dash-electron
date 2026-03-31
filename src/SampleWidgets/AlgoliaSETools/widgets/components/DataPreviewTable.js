/**
 * DataPreviewTable
 *
 * Renders a scrollable table preview of parsed data with column headers.
 * Supports column type selection and column rename.
 */
import { useState } from "react";

const TYPE_OPTIONS = ["string", "number", "boolean", "auto"];
const MAX_PREVIEW_ROWS = 100;

export function DataPreviewTable({
    columns,
    rows,
    typeMap = {},
    onTypeChange,
    columnNames = {},
    onColumnRename,
}) {
    const [editingCol, setEditingCol] = useState(null);
    const [editValue, setEditValue] = useState("");
    const previewRows = rows.slice(0, MAX_PREVIEW_ROWS);

    const startRename = (col) => {
        setEditingCol(col);
        setEditValue(columnNames[col] || col);
    };

    const commitRename = (col) => {
        if (onColumnRename && editValue.trim()) {
            onColumnRename(col, editValue.trim());
        }
        setEditingCol(null);
    };

    if (columns.length === 0) return null;

    return (
        <div className="border border-gray-700 rounded overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-80">
                <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-800">
                            {columns.map((col) => (
                                <th
                                    key={col}
                                    className="px-2 py-1.5 text-left border-b border-gray-700 font-medium text-gray-300 min-w-[120px]"
                                >
                                    <div className="flex flex-col gap-1">
                                        {editingCol === col ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) =>
                                                    setEditValue(e.target.value)
                                                }
                                                onBlur={() => commitRename(col)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                        commitRename(col);
                                                    if (e.key === "Escape")
                                                        setEditingCol(null);
                                                }}
                                                className="px-1 py-0.5 bg-gray-900 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500 w-full"
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                className="cursor-pointer hover:text-blue-400"
                                                onClick={() => startRename(col)}
                                                title="Click to rename"
                                            >
                                                {columnNames[col] || col}
                                            </span>
                                        )}
                                        {onTypeChange && (
                                            <select
                                                value={typeMap[col] || "string"}
                                                onChange={(e) =>
                                                    onTypeChange(
                                                        col,
                                                        e.target.value
                                                    )
                                                }
                                                className="px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-[10px] text-gray-400 focus:outline-none cursor-pointer"
                                            >
                                                {TYPE_OPTIONS.map((t) => (
                                                    <option key={t} value={t}>
                                                        {t}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {previewRows.map((row, i) => (
                            <tr
                                key={i}
                                className="border-b border-gray-800 hover:bg-white/5"
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col}
                                        className="px-2 py-1 text-gray-400 truncate max-w-[200px]"
                                        title={String(row[col] ?? "")}
                                    >
                                        {String(row[col] ?? "")}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.length > MAX_PREVIEW_ROWS && (
                <div className="px-2 py-1 bg-gray-800/50 text-[10px] text-gray-500 text-center">
                    Showing {MAX_PREVIEW_ROWS} of {rows.length} rows
                </div>
            )}
        </div>
    );
}
