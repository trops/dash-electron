import React, {
    useState,
    useContext,
    useEffect,
    useRef,
    useCallback,
} from "react";
import { ThemeContext, ButtonIcon2, useStatusTokens } from "@trops/dash-react";
import { BotActivityPanel } from "../BotActivity/BotActivityPanel";

/**
 * AssistantDock — one right-hand rail hosting the slide-over panels: bot
 * notifications (robot — lead-workspace release 4: Needs you from every
 * dashboard, and Activity).
 *
 * The dock owns a single rail and controls each panel's collapsed state, so
 * only one panel is expanded at a time. Both panels stay mounted while
 * collapsed so their subscriptions — and the approvals badge — stay live.
 *
 * The AI Assistant panel (wand) was retired in create-entry 5e-2c, and the
 * Create panel in lead-workspace release 6c: asking and making things both
 * happen in the lead workspace's conversations.
 */
export const AssistantDock = () => {
    const { currentTheme } = useContext(ThemeContext) || {};
    const bgDark = currentTheme?.["bg-primary-dark"] || "bg-gray-900";
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700";

    const [open, setOpen] = useState(null); // null | "bots"
    const statusTokens = useStatusTokens();
    // What needs the user: the rail's dot, and the panel opening by itself
    // for something new (frame 27) — not for what was already there when
    // Dash started, and never closing by itself.
    const [needs, setNeeds] = useState(0);
    // Only what arrives after the dock is mounted is new: everything the
    // panel reports while its lists load (and after leaving Edit, which
    // remounts the dock) was already there.
    const newestSeen = useRef(Date.now());
    const onNeedsChange = useCallback(({ count = 0, newestAt = 0 } = {}) => {
        setNeeds(count);
        if (newestAt > newestSeen.current) {
            newestSeen.current = newestAt;
            setOpen("bots");
        }
    }, []);

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
                // No bot (the tray's Open Bots panel) opens the list.
                if (req) {
                    setOpen("bots");
                    setOpenRequest({ botId: req.botId || null });
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
            <BotActivityPanel
                collapsed={open !== "bots"}
                onCollapsedChange={(c) => setOpen(c ? null : "bots")}
                onNeedsChange={onNeedsChange}
                openRequest={openRequest}
            />
            <div
                className={`chrome-rail flex flex-col items-center w-12 border-l ${borderColor} ${bgDark} shrink-0 h-screen gap-2 pt-3`}
            >
                {railButton(
                    "bots",
                    "robot",
                    needs > 0
                        ? `Bot notifications — ${needs} ${
                              needs === 1 ? "needs" : "need"
                          } you`
                        : "Bot notifications",
                    needs > 0 ? (
                        <span
                            aria-hidden="true"
                            data-testid="bot-notifications-dot"
                            className={`absolute top-0 right-0 h-2.5 w-2.5 rounded-full ${statusTokens.warning.solidBg}`}
                        />
                    ) : null
                )}
            </div>
        </div>
    );
};
