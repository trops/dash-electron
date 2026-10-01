/**
 * DataTransformer
 *
 * Convert between CSV, JSON, TSV, and NDJSON formats.
 * Paste or upload data, preview as a table, rename columns,
 * set field types, and export to the target format.
 *
 * @package AlgoliaSETools
 */
import { useState, useCallback, useRef } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    Button2,
    Button3,
    SectionLabel,
    SegmentedControl,
} from "@trops/dash-react";
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

    const fileInputRef = useRef(null);

    const handleFileUpload = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelected = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            if (!text) return;

            setInputText(text);
            setParseError(null);
            setExportOutput("");
            setCopied(false);
            try {
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
            } catch (err) {
                setParseError(err.message);
                setColumns([]);
                setRows([]);
            }
        };
        reader.onerror = () => {
            setParseError("Failed to read file.");
        };
        reader.readAsText(file);

        // Reset input so the same file can be re-selected
        e.target.value = "";
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

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.json,.jsonl,.ndjson,.txt"
                onChange={handleFileSelected}
                className="hidden"
            />

            {/* Input Section */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <SectionLabel as="span">Input Data</SectionLabel>
                    <div className="flex gap-2">
                        <Button2 size="sm" onClick={handleFileUpload}>
                            Upload File
                        </Button2>
                        {inputText && (
                            <Button3 size="sm" onClick={handleClear}>
                                Clear
                            </Button3>
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
                    <Button
                        size="sm"
                        onClick={handleParse}
                        disabled={!inputText.trim()}
                    >
                        Parse
                    </Button>
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
                        <SectionLabel as="span">
                            Preview ({rows.length} rows, {columns.length}{" "}
                            columns)
                        </SectionLabel>
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
                    <SectionLabel as="span">Export</SectionLabel>
                    <div className="flex items-center gap-2">
                        <SegmentedControl
                            ariaLabel="Export format"
                            options={EXPORT_FORMATS.map((fmt) => ({
                                value: fmt,
                                label: FORMAT_LABELS[fmt],
                            }))}
                            value={exportFormat}
                            onChange={setExportFormat}
                        />
                        <Button size="sm" onClick={handleExport}>
                            Convert
                        </Button>
                    </div>
                </div>
            )}

            {/* Export Output */}
            {exportOutput && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SectionLabel as="span">
                            Output ({FORMAT_LABELS[exportFormat]})
                        </SectionLabel>
                        <Button2 size="sm" onClick={handleCopy}>
                            {copied ? "Copied!" : "Copy to Clipboard"}
                        </Button2>
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
