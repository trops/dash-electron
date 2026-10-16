/**
 * UnsavedWorkPrompt — leaving the Widget Builder with changes that aren't
 * installed or saved: Save as draft, Discard, or Keep editing (Widget
 * Builder edit fixes). Rendered via createPortal to a fixed overlay on the
 * page body, like WidgetCredentialPermissionModal, so the builder's window
 * and its code editor can't stack over it. Escape keeps editing.
 *
 * @param {boolean} open
 * @param {(answer: "save" | "discard" | "keep") => void} onAnswer
 */
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button, Button2, Button3 } from "@trops/dash-react";
import { useBuilderTheme } from "./useBuilderTheme";

export function UnsavedWorkPrompt({ open, onAnswer }) {
    const bt = useBuilderTheme();
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") onAnswer("keep");
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onAnswer]);
    if (!open) return null;
    const overlay = (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            // A dim in both modes; inline so no palette class is needed.
            style={{ background: "rgba(0, 0, 0, 0.6)" }}
            data-testid="builder-unsaved-prompt"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="builder-unsaved-title"
                className={`dr-modal-surface w-full max-w-md mx-4 rounded-lg border shadow-2xl flex flex-col ${bt.tk(
                    "bg-primary-dark"
                )} ${bt.border} ${bt.text}`}
            >
                <div className="flex flex-col gap-2 p-4">
                    <h2
                        id="builder-unsaved-title"
                        className={`text-sm font-semibold ${bt.text}`}
                        style={{ margin: 0 }}
                    >
                        Unsaved changes
                    </h2>
                    <p className={`text-sm ${bt.muted}`} style={{ margin: 0 }}>
                        This widget has changes that aren't installed or saved.
                        Keep them as a draft to come back to, or discard them.
                    </p>
                </div>
                <div
                    className={`flex items-center justify-between gap-3 p-4 border-t ${bt.border}`}
                >
                    <Button3
                        title="Discard"
                        size="sm"
                        onClick={() => onAnswer("discard")}
                    />
                    <div className="flex items-center gap-2">
                        <Button2
                            title="Keep editing"
                            size="sm"
                            onClick={() => onAnswer("keep")}
                        />
                        <Button
                            title="Save as draft"
                            size="sm"
                            onClick={() => onAnswer("save")}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
    return createPortal(overlay, document.body);
}
