import React, { useEffect, useRef, useState } from "react";
import { WidgetBuilderModal } from "./WidgetBuilderModal";
import {
    finalizeWidgetBuilderSession,
    markWidgetBuilderActive,
    primeWidgetBuilderChat,
    suppressStageRemount,
} from "./finalizeWidgetBuilderSession";

/**
 * The Widget Builder as the Create screen shows it (create-entry PRD CRE-005
 * AC1), registered with dash-core's setWidgetBuilderRenderer. Create passes
 * { initialPrompt, resumeDraftId, onClose }.
 *
 * It does what Dash.js does around the builder's own window: clears the last
 * chat before the builder mounts (unless a draft is resumed), holds off
 * dashboard remounts while open, and finishes an install — register, refresh
 * the widget lists — when the session ends. A session ends on Done/close
 * inside the builder, on Create's ← Back, or on Create closing; finishing on
 * unmount means none of those loses an install. There's no grid cell here,
 * so nothing is placed on a dashboard.
 *
 * @param {Function} registerBundle  Dash.js registerBundleConfigs
 */
export function makeEmbeddedWidgetBuilder(registerBundle) {
    function EmbeddedWidgetBuilder({
        initialPrompt = null,
        resumeDraftId = null,
        onClose = null,
    }) {
        const installedRef = useRef(null);
        const finishedRef = useRef(false);

        // Before the builder (and its ChatCore) first renders.
        useState(() => {
            primeWidgetBuilderChat({ resuming: !!resumeDraftId });
            return true;
        });

        const finish = () => {
            if (finishedRef.current) return;
            finishedRef.current = true;
            suppressStageRemount();
            const installed = installedRef.current;
            installedRef.current = null;
            if (installed) {
                finalizeWidgetBuilderSession({
                    installed,
                    cellContext: null,
                    editContext: null,
                    registerBundle,
                });
            }
        };
        const finishRef = useRef(finish);
        finishRef.current = finish;

        useEffect(() => {
            // A remount (React StrictMode, Fast Refresh) is a live session
            // again — an earlier cleanup must not leave it marked finished.
            finishedRef.current = false;
            markWidgetBuilderActive(true);
            return () => {
                markWidgetBuilderActive(false);
                finishRef.current();
            };
        }, []);

        // "Create new provider" opens Settings › Providers; like the builder's
        // own window, Create closes first so Settings isn't stacked on it.
        const onCloseRef = useRef(onClose);
        onCloseRef.current = onClose;
        useEffect(() => {
            const handler = () => {
                finishRef.current();
                if (typeof onCloseRef.current === "function") {
                    onCloseRef.current();
                }
            };
            window.addEventListener(
                "dash:open-settings-create-provider",
                handler
            );
            return () =>
                window.removeEventListener(
                    "dash:open-settings-create-provider",
                    handler
                );
        }, []);

        return (
            <WidgetBuilderModal
                embedded
                isOpen
                setIsOpen={(open) => {
                    if (open) return;
                    finish();
                    if (typeof onClose === "function") onClose();
                }}
                onInstalled={(componentName, scopedName) => {
                    installedRef.current = { componentName, scopedName };
                }}
                cellContext={null}
                editContext={null}
                resumeDraftId={resumeDraftId}
                initialPrompt={initialPrompt}
            />
        );
    }
    return EmbeddedWidgetBuilder;
}
