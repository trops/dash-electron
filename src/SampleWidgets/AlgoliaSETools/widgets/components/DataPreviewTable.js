/**
 * DataPreviewTable
 *
 * Renders a scrollable table preview of parsed data with column headers.
 * Supports column type selection and column rename.
 */
import { useState, useContext } from "react";
import {
    Caption2,
    InputText,
    SelectInput,
    ThemeContext,
} from "@trops/dash-react";

const TYPE_OPTIONS = ["string", "number", "boolean", "auto"].map((t) => ({
    value: t,
    label: t,
}));
const MAX_PREVIEW_ROWS = 100;

export function DataPreviewTable({
    columns,
    rows,
    typeMap = {},
    onTypeChange,
    columnNames = {},
    onColumnRename,
}) {
    const { currentTheme } = useContext(ThemeContext);
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

    // Theme tokens: header/footer sit one step above the Panel surface.
    const surface = currentTheme?.["bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const border = currentTheme?.["border-primary-dark"] || "";
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";

    return (
        <div className={`border rounded overflow-hidden ${border}`}>
            <div className="overflow-x-auto overflow-y-auto max-h-80">
                <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className={surface}>
                            {columns.map((col) => (
                                <th
                                    key={col}
                                    className={`px-2 py-1.5 text-left border-b font-medium ${border} ${bodyText}`}
                                >
                                    <div className="flex flex-col gap-1">
                                        {editingCol === col ? (
                                            <InputText
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
                                                height="h-7"
                                                padding="px-1 py-0.5"
                                                inputClassName="text-xs"
                                                className="w-28"
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                className="cursor-pointer hover:underline"
                                                onClick={() => startRename(col)}
                                                title="Click to rename"
                                            >
                                                {columnNames[col] || col}
                                            </span>
                                        )}
                                        {onTypeChange && (
                                            <SelectInput
                                                value={typeMap[col] || "string"}
                                                onChange={(value) =>
                                                    onTypeChange(col, value)
                                                }
                                                options={TYPE_OPTIONS}
                                                placeholder="Type"
                                                className="w-28"
                                                inputClassName="text-xs cursor-pointer"
                                            />
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
                                className={`border-b ${border} ${rowHover}`}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col}
                                        className={`px-2 py-1 truncate max-w-xs ${bodyText}`}
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
                <Caption2 block className={`px-2 py-1 text-center ${surface}`}>
                    Showing {MAX_PREVIEW_ROWS} of {rows.length} rows
                </Caption2>
            )}
        </div>
    );
}
