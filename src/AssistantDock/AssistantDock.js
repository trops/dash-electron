import React, { useState, useContext, useEffect } from "react";
import { ThemeContext, ButtonIcon2 } from "@trops/dash-react";
import { CreateDockPanel } from "@trops/dash-core";
import { BotActivityPanel } from "../BotActivity/BotActivityPanel";

/**
 * AssistantDock — one right-hand rail hosting the slide-over panels: Create
 * (plus) on top and Bots (robot, your bots as a contacts list — bot-teams
 * TEAM-015) beneath it.
 *
 * The dock owns a single rail and controls each panel's collapsed state, so
 * only one panel is expanded at a time. Both panels stay mounted while
 * collapsed so their subscriptions — and the approvals badge — stay live.
 *
 * The AI Assistant panel (wand) was retired in create-entry 5e-2c: asking and
 * making things both happen in Create.
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

    const [open, setOpen] = useState(null); // null | "create" | "bots"
    const [approvals, setApprovals] = useState(0);

    const toggle = (which) => setOpen((cur) => (cur === which ? null : which));

    // A clicked bot notification opens that bot (US-018 AC5). A window that
    // was reopened for the click takes the request once mounted; an open one
    // is told.
    const [openRequest, setOpenRequest] = useState(null);
    useEffect(() => {
        const b = window.mainApi && window.mainApi.bots;
        if (!b || typeof b.takeOpenRequest !== "function") return undefined;
        const take = async () => {
            try {
                const req = await b.takeOpenRequest();
                if (req && req.botId) {
                    setOpen("bots");
                    setOpenRequest({ botId: req.botId });
                }
            } catch (_e) {
                // Nothing to open.
            }
        };
        take();
        const id = b.onOpenRequest ? b.onOpenRequest(take) : null;
        return () => {
            if (id != null && b.removeListener) b.removeListener(id);
        };
    }, []);

    // Folding a plan out of the Create modal opens the Create panel.
    useEffect(() => {
        const onFold = () => setOpen("create");
        window.addEventListener("dash:create-fold", onFold);
        return () => window.removeEventListener("dash:create-fold", onFold);
    }, []);

    // A rail toggle: the open panel's button is filled in both modes (design
    // guide rule 13) and reports its state to screen readers.
    const railButton = (which, icon, label, extra = null) => (
        <span className="relative" title={label}>
            <ButtonIcon2
                icon={icon}
                ariaLabel={label}
                ariaPressed={open === which}
                selected={open === which}
                onClick={() => toggle(which)}
            />
            {extra}
        </span>
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
                openRequest={openRequest}
            />
            <div
                className={`chrome-rail flex flex-col items-center w-12 border-l ${borderColor} ${bgDark} shrink-0 h-screen gap-2 pt-3`}
            >
                {railButton("create", "plus", "Create")}
                {railButton(
                    "bots",
                    "robot",
                    "Bots",
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
