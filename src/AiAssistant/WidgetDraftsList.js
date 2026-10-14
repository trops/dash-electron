/**
 * WidgetDraftsList — entry-view list shown inside WidgetBuilderModal
 * when the user has unfinished widgets from prior sessions.
 *
 * Each row:
 *   - Auto-derived name (from .dash.js config.name, falls back to the
 *     first user prompt or "Untitled draft")
 *   - Relative updatedAt ("2h ago")
 *   - Excerpt of the user's first message (so they remember what the
 *     draft was about)
 *   - Resume button — caller restores the modal state from this draft
 *   - Delete button — removes the row from the JSON file
 *
 * Pulls its data via window.mainApi.drafts.list / .delete. Renders
 * inside the builder modal, which provides the app theme — colours come
 * from theme tokens and dash-react status colours (no hard-coded grays).
 */
import React, { useState, useEffect, useCallback } from "react";
import {
    Button,
    Button2,
    Button3,
    EmptyState,
    FontAwesomeIcon,
} from "@trops/dash-react";
import { useBuilderTheme } from "./useBuilderTheme";

function relativeTime(ts) {
    if (!ts) return "";
    const delta = Date.now() - ts;
    const sec = Math.floor(delta / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
}

// The first thing the user typed — skipping hidden messages such as the
// builder's automatic greeting, which is sent as a hidden user message.
export function firstUserMessageExcerpt(chatHistory) {
    if (!Array.isArray(chatHistory)) return "";
    const firstUser = chatHistory.find(
        (m) => m && !m.hidden && (m.role === "user" || m.author === "user")
    );
    if (!firstUser) return "";
    const text =
        typeof firstUser.content === "string"
            ? firstUser.content
            : typeof firstUser.text === "string"
            ? firstUser.text
            : "";
    return text.length > 110 ? text.slice(0, 107) + "…" : text;
}

export const WidgetDraftsList = ({
    onResume,
    onStartNew,
    onInstalled,
    onOpenedInEditor,
}) => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [installingId, setInstallingId] = useState(null);
    const [installError, setInstallError] = useState(null);
    const [openingEditorId, setOpeningEditorId] = useState(null);
    const bt = useBuilderTheme();

    const refresh = useCallback(async () => {
        try {
            const list = (await window.mainApi?.drafts?.list?.()) || [];
            setDrafts(Array.isArray(list) ? list : []);
        } catch (err) {
            console.warn("[WidgetDraftsList] list failed:", err);
            setDrafts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleDelete = useCallback(
        async (id) => {
            try {
                await window.mainApi?.drafts?.delete?.(id);
            } catch (err) {
                console.warn("[WidgetDraftsList] delete failed:", err);
            }
            setConfirmDeleteId(null);
            refresh();
        },
        [refresh]
    );

    const handleOpenInEditor = useCallback(
        async (draft) => {
            setOpeningEditorId(draft.id);
            setInstallError(null);
            try {
                const result = await window.mainApi?.drafts?.openInEditor?.(
                    draft.id
                );
                if (result?.success) {
                    if (typeof onOpenedInEditor === "function") {
                        onOpenedInEditor(draft);
                    }
                } else {
                    setInstallError(
                        result?.error || "Couldn't open the editor"
                    );
                }
            } catch (err) {
                setInstallError(err?.message || String(err));
            } finally {
                setOpeningEditorId(null);
            }
        },
        [onOpenedInEditor]
    );

    const handleInstall = useCallback(
        async (draft) => {
            setInstallingId(draft.id);
            setInstallError(null);
            try {
                const result = await window.mainApi?.drafts?.install?.(
                    draft.id
                );
                if (result?.success) {
                    if (typeof onInstalled === "function") {
                        onInstalled(result.widgetName, draft.componentName);
                    }
                    await refresh();
                } else {
                    setInstallError(
                        result?.error || "Install failed (no error reported)"
                    );
                }
            } catch (err) {
                setInstallError(err?.message || String(err));
            } finally {
                setInstallingId(null);
            }
        },
        [refresh, onInstalled]
    );

    const noFilesYet =
        "Draft has no on-disk files yet — resume + send a message first";

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <p className={`text-sm ${bt.muted}`}>Loading drafts…</p>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col h-full ${bt.tk("bg-primary-dark")} ${
                bt.text
            }`}
        >
            <div
                className={`flex items-center justify-between gap-4 p-4 border-b ${bt.border}`}
            >
                <div className="flex flex-col gap-1 min-w-0">
                    <h2 className={`text-sm font-semibold ${bt.text}`}>
                        Drafts
                    </h2>
                    <p className={`text-xs ${bt.muted}`}>
                        Widgets you started building but haven't installed yet.
                        Resume one to keep editing.
                    </p>
                </div>
                <Button
                    title="Build new widget"
                    size="sm"
                    onClick={onStartNew}
                    testId="drafts-start-new"
                />
            </div>
            {installError && (
                <div
                    role="alert"
                    className={`px-4 py-2 border-b text-sm ${bt.status.error.bg} ${bt.status.error.border} ${bt.status.error.text}`}
                >
                    Install failed: {installError}
                </div>
            )}
            {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 p-4">
                    <EmptyState
                        icon={
                            <FontAwesomeIcon
                                icon="file-pen"
                                className="h-6 w-6"
                            />
                        }
                        title="No drafts yet"
                        description="Start a new widget — your work is saved here automatically."
                    />
                </div>
            ) : (
                <ul className="flex-1 overflow-y-auto">
                    {drafts.map((draft) => {
                        const excerpt = firstUserMessageExcerpt(
                            draft.chatHistory
                        );
                        const isConfirming = confirmDeleteId === draft.id;
                        const editorOff =
                            openingEditorId === draft.id || !draft.packageDir;
                        const installOff =
                            installingId === draft.id || !draft.packageDir;
                        return (
                            <li
                                key={draft.id}
                                className={`p-4 border-b transition-colors ${bt.border} ${bt.hoverSurface}`}
                                data-testid="drafts-row"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                                        <div className="flex items-baseline gap-3">
                                            <h3
                                                className={`text-sm font-semibold truncate ${bt.text}`}
                                            >
                                                {draft.name || "Untitled draft"}
                                            </h3>
                                            <span
                                                className={`text-xs flex-shrink-0 ${bt.muted}`}
                                            >
                                                {relativeTime(draft.updatedAt)}
                                            </span>
                                        </div>
                                        {excerpt && (
                                            <p
                                                className={`text-xs line-clamp-2 ${bt.muted}`}
                                            >
                                                {excerpt}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {!isConfirming ? (
                                            <>
                                                <Button2
                                                    title="Resume"
                                                    size="sm"
                                                    onClick={() =>
                                                        onResume?.(draft)
                                                    }
                                                    testId="drafts-resume"
                                                />
                                                <Button3
                                                    title={
                                                        openingEditorId ===
                                                        draft.id
                                                            ? "Opening…"
                                                            : "Open in editor"
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        handleOpenInEditor(
                                                            draft
                                                        )
                                                    }
                                                    disabled={editorOff}
                                                    tooltip={
                                                        !draft.packageDir
                                                            ? noFilesYet
                                                            : "Open this widget's package in your editor (VS Code if available)"
                                                    }
                                                    testId="drafts-open-editor"
                                                />
                                                <Button3
                                                    title={
                                                        installingId ===
                                                        draft.id
                                                            ? "Installing…"
                                                            : "Install"
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        handleInstall(draft)
                                                    }
                                                    disabled={installOff}
                                                    tooltip={
                                                        !draft.packageDir
                                                            ? noFilesYet
                                                            : "Install this widget"
                                                    }
                                                    testId="drafts-install"
                                                />
                                                <Button3
                                                    title="Delete"
                                                    size="sm"
                                                    onClick={() =>
                                                        setConfirmDeleteId(
                                                            draft.id
                                                        )
                                                    }
                                                    testId="drafts-delete"
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <span
                                                    className={`text-xs ${bt.status.warning.icon}`}
                                                >
                                                    Delete?
                                                </span>
                                                <Button2
                                                    title="Yes"
                                                    size="sm"
                                                    danger
                                                    onClick={() =>
                                                        handleDelete(draft.id)
                                                    }
                                                    testId="drafts-delete-confirm"
                                                />
                                                <Button3
                                                    title="Cancel"
                                                    size="sm"
                                                    onClick={() =>
                                                        setConfirmDeleteId(null)
                                                    }
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default WidgetDraftsList;
