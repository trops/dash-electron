/**
 * DataTransformer
 *
 * Convert between CSV, JSON, TSV, and NDJSON formats.
 * Paste or upload data, preview as a table, rename columns,
 * set field types, and export to the target format.
 *
 * @package AlgoliaSETools
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useWidgetEvents } from "@trops/dash-core";
import { parseAny, detectFormat } from "../utils/dataParser";
import { exportToFormat } from "../utils/dataExporter";
import { DataPreviewTable } from "./components/DataPreviewTable";

const FORMAT_LABELS = {
    csv: "CSV",
    tsv: "TSV",
    json: "JSON",
    ndjson: "NDJSON",
    unknown: "Unknown",
};

const EXPORT_FORMATS = ["json", "csv", "tsv", "ndjson"];

function DataTransformerContent({ title }) {
    const { publishEvent } = useWidgetEvents();

    // Input state
    const [inputText, setInputText] = useState("");
    const [detectedFormat, setDetectedFormat] = useState("unknown");

    // Parsed data
    const [columns, setColumns] = useState([]);
    const [rows, setRows] = useState([]);
    const [parseError, setParseError] = useState(null);

    // Column config
    const [typeMap, setTypeMap] = useState({});
    const [columnNames, setColumnNames] = useState({});

    // Export state
    const [exportFormat, setExportFormat] = useState("json");
    const [exportOutput, setExportOutput] = useState("");
    const [copied, setCopied] = useState(false);

    const handleParse = useCallback(() => {
        setParseError(null);
        setExportOutput("");
        setCopied(false);
        try {
            const result = parseAny(inputText);
            setDetectedFormat(result.format);
            setColumns(result.columns);
            setRows(result.rows);
            // Reset column config
            setTypeMap({});
            setColumnNames({});
            if (result.columns.length === 0 && inputText.trim()) {
                setParseError(
                    "Could not detect format. Supported: CSV, TSV, JSON, NDJSON."
                );
            }
        } catch (err) {
            setParseError(err.message);
            setColumns([]);
            setRows([]);
        }
    }, [inputText]);

    const handleFileUpload = useCallback(async () => {
        try {
            const result = await window.mainApi.dialog.showDialog({
                allowFile: true,
                extensions: ["csv", "tsv", "json", "jsonl", "ndjson", "txt"],
            });
            if (result?.path) {
                const text = await window.mainApi.file.read(result.path);
                if (text) {
                    setInputText(text);
                    // Auto-parse after loading
                    setParseError(null);
                    setExportOutput("");
                    const parsed = parseAny(text);
                    setDetectedFormat(parsed.format);
                    setColumns(parsed.columns);
                    setRows(parsed.rows);
                    setTypeMap({});
                    setColumnNames({});
                    if (parsed.columns.length === 0 && text.trim()) {
                        setParseError(
                            "Could not detect format. Supported: CSV, TSV, JSON, NDJSON."
                        );
                    }
                }
            }
        } catch (err) {
            setParseError("File read error: " + err.message);
        }
    }, []);

    const handleTypeChange = useCallback((col, type) => {
        setTypeMap((prev) => ({ ...prev, [col]: type }));
    }, []);

    const handleColumnRename = useCallback((originalCol, newName) => {
        setColumnNames((prev) => ({ ...prev, [originalCol]: newName }));
    }, []);

    const handleExport = useCallback(() => {
        // Apply column renames
        const renamedCols = columns.map((c) => columnNames[c] || c);
        const renamedRows = rows.map((row) => {
            const newRow = {};
            columns.forEach((col) => {
                const newName = columnNames[col] || col;
                newRow[newName] = row[col];
            });
            return newRow;
        });
        // Build type map with renamed keys
        const renamedTypeMap = {};
        columns.forEach((col) => {
            const newName = columnNames[col] || col;
            if (typeMap[col]) renamedTypeMap[newName] = typeMap[col];
        });

        const output = exportToFormat(
            renamedCols,
            renamedRows,
            exportFormat,
            renamedTypeMap
        );
        setExportOutput(output);
        setCopied(false);

        // Publish event for other widgets to consume
        try {
            publishEvent("dataTransformed", {
                format: exportFormat,
                columns: renamedCols,
                rowCount: renamedRows.length,
            });
        } catch {
            // Event publishing is optional
        }
    }, [columns, rows, columnNames, typeMap, exportFormat, publishEvent]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(exportOutput).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [exportOutput]);

    const handleClear = useCallback(() => {
        setInputText("");
        setDetectedFormat("unknown");
        setColumns([]);
        setRows([]);
        setParseError(null);
        setTypeMap({});
        setColumnNames({});
        setExportOutput("");
        setCopied(false);
    }, []);

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Input Section */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                        Input Data
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleFileUpload}
                            className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                        >
                            Upload File
                        </button>
                        {inputText && (
                            <button
                                onClick={handleClear}
                                className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-400"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste CSV, TSV, JSON, or NDJSON data here..."
                    className="w-full h-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y"
                />
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleParse}
                        disabled={!inputText.trim()}
                        className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        Parse
                    </button>
                    {detectedFormat !== "unknown" && (
                        <span className="text-xs text-gray-500">
                            Detected:{" "}
                            <span className="text-blue-400 font-medium">
                                {FORMAT_LABELS[detectedFormat]}
                            </span>
                        </span>
                    )}
                    {inputText.trim() && detectedFormat === "unknown" && (
                        <span className="text-xs text-gray-500">
                            Format:{" "}
                            <span className="text-yellow-500">
                                auto-detect on parse
                            </span>
                        </span>
                    )}
                </div>
            </div>

            {/* Parse Error */}
            {parseError && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {parseError}
                </div>
            )}

            {/* Data Preview */}
            {columns.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                            Preview ({rows.length} rows, {columns.length}{" "}
                            columns)
                        </span>
                        <span className="text-[10px] text-gray-600">
                            Click column name to rename. Set type per column.
                        </span>
                    </div>
                    <DataPreviewTable
                        columns={columns}
                        rows={rows}
                        typeMap={typeMap}
                        onTypeChange={handleTypeChange}
                        columnNames={columnNames}
                        onColumnRename={handleColumnRename}
                    />
                </div>
            )}

            {/* Export Section */}
            {columns.length > 0 && (
                <div className="space-y-2">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                        Export
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            {EXPORT_FORMATS.map((fmt) => (
                                <button
                                    key={fmt}
                                    onClick={() => setExportFormat(fmt)}
                                    className={`px-2 py-0.5 text-xs rounded border ${
                                        exportFormat === fmt
                                            ? "bg-blue-700 border-blue-600 text-white"
                                            : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
                                    }`}
                                >
                                    {FORMAT_LABELS[fmt]}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleExport}
                            className="px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 text-white"
                        >
                            Convert
                        </button>
                    </div>
                </div>
            )}

            {/* Export Output */}
            {exportOutput && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                            Output ({FORMAT_LABELS[exportFormat]})
                        </span>
                        <button
                            onClick={handleCopy}
                            className={`px-2 py-0.5 text-xs rounded ${
                                copied
                                    ? "bg-emerald-700 text-white"
                                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                            }`}
                        >
                            {copied ? "Copied!" : "Copy to Clipboard"}
                        </button>
                    </div>
                    <pre className="w-full max-h-48 overflow-auto px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 font-mono whitespace-pre-wrap">
                        {exportOutput}
                    </pre>
                </div>
            )}
        </div>
    );
}

export const DataTransformer = ({ title = "Data Transformer", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <DataTransformerContent title={title} />
            </Panel>
        </Widget>
    );
};
