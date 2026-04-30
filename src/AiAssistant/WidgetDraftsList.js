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
 * inside the modal's existing dark chrome — uses Tailwind classes
 * known to be safelist-compatible (no opacity modifiers / arbitrary
 * values).
 */
import React, { useState, useEffect, useCallback } from "react";

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

function firstUserMessageExcerpt(chatHistory) {
    if (!Array.isArray(chatHistory)) return "";
    const firstUser = chatHistory.find(
        (m) => m && (m.role === "user" || m.author === "user")
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

export const WidgetDraftsList = ({ onResume, onStartNew }) => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-gray-300">
                <div className="text-sm">Loading drafts…</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <div>
                    <h2 className="text-lg font-semibold text-gray-100">
                        Drafts
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        Widgets you started building but haven't installed yet.
                        Resume one to keep editing.
                    </p>
                </div>
                <button
                    onClick={onStartNew}
                    className="px-3 py-2 text-sm font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    data-testid="drafts-start-new"
                >
                    Build new widget
                </button>
            </div>
            {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 p-8 text-gray-400">
                    <div className="text-sm">No drafts yet.</div>
                    <div className="text-xs mt-2">
                        Start a new widget — your work will be saved here
                        automatically.
                    </div>
                </div>
            ) : (
                <ul className="flex-1 overflow-y-auto divide-y divide-gray-700">
                    {drafts.map((draft) => {
                        const excerpt = firstUserMessageExcerpt(
                            draft.chatHistory
                        );
                        const isConfirming = confirmDeleteId === draft.id;
                        return (
                            <li
                                key={draft.id}
                                className="px-6 py-4 hover:bg-gray-800 transition-colors"
                                data-testid="drafts-row"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-3">
                                            <h3 className="text-sm font-semibold text-gray-100 truncate">
                                                {draft.name || "Untitled draft"}
                                            </h3>
                                            <span className="text-xs text-gray-400 flex-shrink-0">
                                                {relativeTime(draft.updatedAt)}
                                            </span>
                                        </div>
                                        {excerpt && (
                                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                                {excerpt}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {!isConfirming ? (
                                            <>
                                                <button
                                                    onClick={() =>
                                                        onResume?.(draft)
                                                    }
                                                    className="px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                                                    data-testid="drafts-resume"
                                                >
                                                    Resume
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setConfirmDeleteId(
                                                            draft.id
                                                        )
                                                    }
                                                    className="px-3 py-1 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                                                    data-testid="drafts-delete"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xs text-amber-300">
                                                    Delete?
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        handleDelete(draft.id)
                                                    }
                                                    className="px-3 py-1 text-xs font-medium rounded bg-red-700 hover:bg-red-600 text-white transition-colors"
                                                    data-testid="drafts-delete-confirm"
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setConfirmDeleteId(null)
                                                    }
                                                    className="px-3 py-1 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                                                >
                                                    Cancel
                                                </button>
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
