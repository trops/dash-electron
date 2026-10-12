import React, { useState, useContext, useEffect } from "react";
import { ThemeContext, FontAwesomeIcon } from "@trops/dash-react";
import { CreateDockPanel } from "@trops/dash-core";
import { AiAssistantPanel } from "../AiAssistant/AiAssistantPanel";
import { BotActivityPanel } from "../BotActivity/BotActivityPanel";

/**
 * AssistantDock — one right-hand rail hosting BOTH slide-over panels: the AI
 * Assistant (wand) on top and Bot Activity (robot) stacked beneath it.
 *
 * Previously each panel rendered its own full-height rail, so mounted as
 * siblings their toggles sat side by side. This dock owns a single rail and
 * controls each panel's collapsed state, so only one panel is expanded at a
 * time and the two toggles stack vertically. Both panels stay mounted while
 * collapsed (returning null) so their subscriptions — and the approvals badge —
 * stay live.
 *
 * Create (plus, create-entry CRE-007 AC1, phase 4e-2): a plan conversation
 * folded out of the Create modal carries on here; with nothing folded the
 * panel shows Recent. A fold (`dash:create-fold`) opens it.
 */
export const AssistantDock = () => {
    const { currentTheme } = useContext(ThemeContext) || {};
    const bgDark = currentTheme?.["bg-primary-dark"] || "bg-gray-900";
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700";

    const [open, setOpen] = useState(null); // null | "create" | "ai" | "bots"
    const [approvals, setApprovals] = useState(0);

    const toggle = (which) => setOpen((cur) => (cur === which ? null : which));

    // Folding a plan out of the Create modal opens the Create panel.
    useEffect(() => {
        const onFold = () => setOpen("create");
        window.addEventListener("dash:create-fold", onFold);
        return () => window.removeEventListener("dash:create-fold", onFold);
    }, []);

    const railButton = (which, icon, label, extra = null) => (
        <button
            onClick={() => toggle(which)}
            className={`p-2 rounded-lg hover:bg-white/10 transition-colors hover:text-gray-200 relative ${
                open === which ? "text-gray-200" : "text-gray-400"
            }`}
            title={label}
            aria-label={label}
            aria-pressed={open === which}
        >
            <FontAwesomeIcon icon={icon} className="h-4 w-4" />
            {extra}
        </button>
    );

    return (
        <div className="flex flex-row shrink-0 h-screen">
            {/* One instance, always mounted: a fold is never missed and the
                folded conversation survives closing the panel. */}
            <div className={open === "create" ? `h-screen ${bgDark}` : ""}>
                <CreateDockPanel
                    collapsed={open !== "create"}
                    onCollapse={() => setOpen(null)}
                />
            </div>
            <BotActivityPanel
                collapsed={open !== "bots"}
                onCollapsedChange={(c) => setOpen(c ? null : "bots")}
                onApprovalsCount={setApprovals}
            />
            <AiAssistantPanel
                docked
                collapsed={open !== "ai"}
                onCollapsedChange={(c) => setOpen(c ? null : "ai")}
            />
            <div
                className={`chrome-rail flex flex-col items-center w-10 border-l ${borderColor} ${bgDark} shrink-0 h-screen gap-1 pt-3`}
            >
                {railButton("create", "plus", "Create")}
                {railButton("ai", "wand-magic-sparkles", "AI Assistant")}
                {railButton(
                    "bots",
                    "robot",
                    "Bot Activity",
                    approvals > 0 ? (
                        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                            {approvals}
                        </span>
                    ) : null
                )}
            </div>
        </div>
    );
};
