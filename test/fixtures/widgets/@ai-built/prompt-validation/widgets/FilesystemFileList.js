import React, { useState, useEffect } from "react";
import {
    Panel,
    SubHeading2,
    Caption,
    Menu,
    MenuItem,
    Alert2,
    EmptyState,
    Skeleton,
    Button2,
} from "@trops/dash-react";
import { useMcpProvider, useWidgetEvents } from "@trops/dash-core";

export default function FilesystemFileList({
    title = "Files",
    directoryPath = "",
}) {
    const {
        callTool,
        tools,
        isConnected,
        error: mcpError,
    } = useMcpProvider("filesystem");
    const { publishEvent } = useWidgetEvents();

    const [files, setFiles] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!isConnected || tools.length === 0) return;
        if (!directoryPath) return;

        let cancelled = false;
        setFiles(null);
        setLoadError(null);

        callTool("list_directory", { path: directoryPath })
            .then((result) => {
                if (cancelled) return;
                // Filesystem MCP returns content[] with text lines like
                // "[FILE] name.txt" or "[DIR] subdir". Parse defensively.
                const text = Array.isArray(result?.content)
                    ? result.content
                          .filter(
                              (c) =>
                                  c &&
                                  c.type === "text" &&
                                  typeof c.text === "string"
                          )
                          .map((c) => c.text)
                          .join("\n")
                    : "";
                const parsed = text
                    .split("\n")
                    .map((line) =>
                        typeof line === "string" ? line.trim() : ""
                    )
                    .filter(Boolean)
                    .map((line) => {
                        const fileMatch = line.match(/^\[FILE\]\s+(.+)$/);
                        if (fileMatch) {
                            return { name: fileMatch[1], isDir: false };
                        }
                        const dirMatch = line.match(/^\[DIR\]\s+(.+)$/);
                        if (dirMatch) {
                            return { name: dirMatch[1], isDir: true };
                        }
                        return null;
                    })
                    .filter(Boolean);
                setFiles(parsed.filter((entry) => !entry.isDir));
            })
            .catch((err) => {
                if (!cancelled) setLoadError(err);
            });

        return () => {
            cancelled = true;
        };
    }, [isConnected, tools, directoryPath, reloadKey, callTool]);

    const handleFileClick = (entry) => {
        const trimmed = typeof directoryPath === "string" ? directoryPath : "";
        const sep = trimmed.endsWith("/") || trimmed.endsWith("\\") ? "" : "/";
        const fullPath = `${trimmed}${sep}${entry.name}`;
        publishEvent("fileSelected", {
            name: entry.name,
            path: fullPath,
            directory: trimmed,
        });
    };

    return (
        <Panel>
            <SubHeading2 title={title} />
            {directoryPath ? <Caption text={directoryPath} /> : null}

            {!directoryPath && (
                <EmptyState
                    title="No directory configured"
                    description="Open Settings → Configure and set a directory path within your filesystem provider's allowed roots."
                />
            )}

            {directoryPath && mcpError && (
                <Alert2
                    title="Filesystem provider error"
                    message={mcpError.message || String(mcpError)}
                />
            )}

            {directoryPath && !mcpError && loadError && (
                <Alert2
                    title="Failed to list directory"
                    message={loadError.message || String(loadError)}
                />
            )}

            {directoryPath && !mcpError && !loadError && files === null && (
                <Skeleton.Text lines={5} />
            )}

            {directoryPath &&
                !mcpError &&
                !loadError &&
                files &&
                files.length === 0 && (
                    <EmptyState
                        title="No files"
                        description={`No files found in ${directoryPath}.`}
                    />
                )}

            {directoryPath &&
                !mcpError &&
                !loadError &&
                files &&
                files.length > 0 && (
                    <Menu>
                        {files.map((entry) => (
                            <MenuItem
                                key={entry.name}
                                onClick={() => handleFileClick(entry)}
                            >
                                {entry.name}
                            </MenuItem>
                        ))}
                    </Menu>
                )}

            {directoryPath && (
                <div className="mt-2">
                    <Button2
                        title="Refresh"
                        size="sm"
                        onClick={() => setReloadKey((k) => k + 1)}
                    />
                </div>
            )}
        </Panel>
    );
}
