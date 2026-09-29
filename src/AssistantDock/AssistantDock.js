import React, { useState, useContext } from "react";
import { ThemeContext, FontAwesomeIcon } from "@trops/dash-react";
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
 */
export const AssistantDock = () => {
    const { currentTheme } = useContext(ThemeContext) || {};
    const bgDark = currentTheme?.["bg-primary-dark"] || "bg-gray-900";
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700";

    const [open, setOpen] = useState(null); // null | "ai" | "bots"
    const [approvals, setApprovals] = useState(0);

    const toggle = (which) => setOpen((cur) => (cur === which ? null : which));

    return (
        <div className="flex flex-row shrink-0 h-screen">
            <BotActivityPanel
                docked
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
                className={`flex flex-col items-center w-10 border-l ${borderColor} ${bgDark} shrink-0 h-screen gap-1 pt-3`}
            >
                <button
                    onClick={() => toggle("ai")}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200"
                    title="AI Assistant"
                >
                    <FontAwesomeIcon
                        icon="wand-magic-sparkles"
                        className="h-4 w-4"
                    />
                </button>
                <button
                    onClick={() => toggle("bots")}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200 relative"
                    title="Bot Activity"
                >
                    <FontAwesomeIcon icon="robot" className="h-4 w-4" />
                    {approvals > 0 ? (
                        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                            {approvals}
                        </span>
                    ) : null}
                </button>
            </div>
        </div>
    );
};
