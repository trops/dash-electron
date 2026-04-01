/**
 * AlgoliaBatchManagerWidget
 *
 * Upload/update records in bulk from a JSON file.
 * Splits large files into batches, then pushes each batch to Algolia.
 * Uses window.mainApi.algolia.createBatchesFromFile() + partialUpdateObjectsFromDirectory().
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";

function AlgoliaBatchManagerContent({ title, defaultBatchSize = 500 }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const [indices, setIndices] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [sourceFile, setSourceFile] = useState("");
    const [batchSize, setBatchSize] = useState(defaultBatchSize);
    const [createIfNotExists, setCreateIfNotExists] = useState(false);
    const [error, setError] = useState(null);

    // Workflow states: idle -> batching -> uploading -> complete
    const [stage, setStage] = useState("idle");
    const [batchProgress, setBatchProgress] = useState(0);
    const [uploadProgress, setUploadProgress] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const cleanupRef = useRef(null);

    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();

    // Listen for indexSelected events from IndexSelector widget
    useEffect(() => {
        if (!listeners || !listen) return;
        const hasListeners =
            typeof listeners === "object" && Object.keys(listeners).length > 0;
        if (hasListeners) {
            listen(listeners, {
                indexSelected: (data) => {
                    const payload = data.message || data;
                    if (payload.name) setSelectedIndex(payload.name);
                },
            });
        }
    }, [listeners, listen]);

    // Load index list
    useEffect(() => {
        if (!pc?.providerHash) return;
        let cancelled = false;
        setLoadingIndices(true);

        window.mainApi.algolia
            .listIndices({ ...pc, cache: true })
            .then((data) => {
                if (!cancelled) {
                    setIndices(Array.isArray(data) ? data : []);
                    setLoadingIndices(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err?.message || "Failed to load indices");
                    setLoadingIndices(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pc?.providerHash]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (cleanupRef.current) cleanupRef.current();
        };
    }, []);

    const chooseSourceFile = async () => {
        try {
            const result = await window.mainApi.dialog.showDialog(
                { allowFile: true, extensions: ["json"] },
                true,
                ["json"]
            );
            if (result && !result.canceled && result.filePaths?.[0]) {
                setSourceFile(result.filePaths[0]);
            }
        } catch (err) {
            setError(err.message || "Failed to choose file");
        }
    };

    const startBatchUpload = async () => {
        if (!sourceFile || !selectedIndex || !pc?.providerHash) return;

        setError(null);
        setStage("batching");
        setBatchProgress(0);
        setUploadProgress("");
        setUploadedFiles([]);

        // Derive batch directory from source file path
        const lastSlash = sourceFile.lastIndexOf("/");
        const dir =
            lastSlash > 0 ? sourceFile.substring(0, lastSlash) : sourceFile;
        const batchDir = `${dir}/batches_${selectedIndex}`;

        // Step 1: Create batches from file
        const handleBatchUpdate = (_event, batchNum) => {
            setBatchProgress(batchNum);
        };
        const handleBatchComplete = () => {
            // Step 2: Upload batches
            setStage("uploading");

            const handleUploadUpdate = (_event, data) => {
                setUploadProgress(
                    typeof data === "string" ? data : JSON.stringify(data)
                );
            };
            const handleUploadComplete = (_event, results) => {
                setStage("complete");
                setUploadedFiles(results || []);
            };
            const handleUploadError = (_event, err) => {
                setStage("idle");
                setError(err?.message || err?.error || "Upload failed");
            };

            window.mainApi.on(
                "algolia-partial-update-objects-update",
                handleUploadUpdate
            );
            window.mainApi.on(
                "algolia-partial-update-objects-complete",
                handleUploadComplete
            );
            window.mainApi.on(
                "algolia-partial-update-objects-error",
                handleUploadError
            );

            cleanupRef.current = () => {
                window.mainApi.removeListener(
                    "algolia-partial-update-objects-update",
                    handleUploadUpdate
                );
                window.mainApi.removeListener(
                    "algolia-partial-update-objects-complete",
                    handleUploadComplete
                );
                window.mainApi.removeListener(
                    "algolia-partial-update-objects-error",
                    handleUploadError
                );
            };

            window.mainApi.algolia.partialUpdateObjectsFromDirectory({
                ...pc,
                indexName: selectedIndex,
                dir: batchDir,
                createIfNotExists,
            });
        };
        const handleBatchError = (_event, err) => {
            setStage("idle");
            setError(err?.message || err?.error || "Batch creation failed");
        };

        window.mainApi.on("algolia-create-batch-update", handleBatchUpdate);
        window.mainApi.on("algolia-create-batch-complete", handleBatchComplete);
        window.mainApi.on("algolia-create-batch-error", handleBatchError);

        // Store cleanup for batch listeners
        const prevCleanup = cleanupRef.current;
        cleanupRef.current = () => {
            if (prevCleanup) prevCleanup();
            window.mainApi.removeListener(
                "algolia-create-batch-update",
                handleBatchUpdate
            );
            window.mainApi.removeListener(
                "algolia-create-batch-complete",
                handleBatchComplete
            );
            window.mainApi.removeListener(
                "algolia-create-batch-error",
                handleBatchError
            );
        };

        window.mainApi.algolia.createBatchesFromFile(
            sourceFile,
            batchDir,
            batchSize
        );
    };

    const reset = () => {
        setStage("idle");
        setBatchProgress(0);
        setUploadProgress("");
        setUploadedFiles([]);
        setError(null);
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }
    };

    const isWorking = stage === "batching" || stage === "uploading";

    if (!hasCredentials) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs">
                    Algolia credential provider not configured. Add an Algolia
                    provider with your App ID and API Key.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {/* Index Selector */}
            <div className="space-y-1">
                <SubHeading3 title="Target Index" padding={false} />
                <select
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(e.target.value)}
                    disabled={
                        loadingIndices || indices.length === 0 || isWorking
                    }
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-rose-500 disabled:opacity-50"
                >
                    <option value="">
                        {loadingIndices
                            ? "Loading indices..."
                            : indices.length === 0
                            ? "No indices available"
                            : "Select target index"}
                    </option>
                    {indices.map((idx, i) => (
                        <option key={idx.name + i} value={idx.name}>
                            {idx.name} ({(idx.entries || 0).toLocaleString()})
                        </option>
                    ))}
                </select>
            </div>

            {/* Source File */}
            <div className="space-y-1">
                <SubHeading3 title="Source JSON File" padding={false} />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={sourceFile}
                        readOnly
                        placeholder="No file selected"
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500"
                    />
                    <button
                        onClick={chooseSourceFile}
                        disabled={isWorking}
                        className="px-3 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white"
                    >
                        Browse
                    </button>
                </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <SubHeading3 title="Batch Size" padding={false} />
                    <input
                        type="number"
                        value={batchSize}
                        onChange={(e) =>
                            setBatchSize(
                                Math.max(1, parseInt(e.target.value) || 500)
                            )
                        }
                        disabled={isWorking}
                        className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-rose-500 disabled:opacity-50"
                    />
                </div>
                <div className="space-y-1">
                    <SubHeading3 title="Create if Missing" padding={false} />
                    <label className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={createIfNotExists}
                            onChange={(e) =>
                                setCreateIfNotExists(e.target.checked)
                            }
                            disabled={isWorking}
                            className="rounded"
                        />
                        <span className="text-xs text-gray-300">
                            Create new records
                        </span>
                    </label>
                </div>
            </div>

            {/* Start Button */}
            {stage === "idle" && (
                <button
                    onClick={startBatchUpload}
                    disabled={!selectedIndex || !sourceFile || isWorking}
                    className="w-full px-3 py-2 text-xs rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium"
                >
                    Start Batch Upload
                </button>
            )}

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Progress: Batching */}
            {stage === "batching" && (
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-xs text-gray-300">
                            Creating batches... (batch #{batchProgress})
                        </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div
                            className="bg-rose-500 h-1.5 rounded-full transition-all animate-pulse"
                            style={{ width: "50%" }}
                        />
                    </div>
                </div>
            )}

            {/* Progress: Uploading */}
            {stage === "uploading" && (
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-xs text-gray-300">
                            Uploading batches to Algolia...
                        </span>
                    </div>
                    {uploadProgress && (
                        <div className="text-[10px] text-gray-500 font-mono truncate">
                            {uploadProgress}
                        </div>
                    )}
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div
                            className="bg-orange-500 h-1.5 rounded-full transition-all animate-pulse"
                            style={{ width: "75%" }}
                        />
                    </div>
                </div>
            )}

            {/* Complete */}
            {stage === "complete" && (
                <div className="space-y-2">
                    <div className="p-2 bg-green-900/30 border border-green-700 rounded text-green-300 text-xs">
                        Upload complete! {uploadedFiles.length} batch
                        {uploadedFiles.length !== 1 ? "es" : ""} processed.
                    </div>
                    {uploadedFiles.length > 0 && (
                        <div className="text-[10px] text-gray-500 max-h-20 overflow-y-auto">
                            {uploadedFiles.map((f, i) => (
                                <div key={i}>{f.file || JSON.stringify(f)}</div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={reset}
                        className="px-3 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 text-white"
                    >
                        Reset
                    </button>
                </div>
            )}
        </div>
    );
}

export const AlgoliaBatchManagerWidget = ({
    title = "Algolia Batch Manager",
    defaultBatchSize = 500,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaBatchManagerContent
                    title={title}
                    defaultBatchSize={defaultBatchSize}
                />
            </Panel>
        </Widget>
    );
};
