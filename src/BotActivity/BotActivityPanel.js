import React, { useContext, useEffect } from "react";
import { FontAwesomeIcon, ThemeContext } from "@trops/dash-react";
import { WorkspaceContext, BotMonitor, useBotMonitor } from "@trops/dash-core";

/**
 * BotActivityPanel — the right slide-over for watching bots across every
 * dashboard (bot-teams TEAM-011 B3). A frame around dash-core's BotMonitor:
 * Needs you (approvals), Running now, Recent — each with a way into the
 * dashboard's Bots view (in place, or as a popout for another dashboard).
 * Starting bots, talking to them and the team lead live in the Bots view.
 *
 * Stays mounted while collapsed (rendering nothing) so the approvals badge
 * on the dock rail stays live.
 */
export const BotActivityPanel = ({
    collapsed = true,
    onCollapsedChange,
    onApprovalsCount,
} = {}) => {
    const { currentTheme = {} } = useContext(ThemeContext) || {};
    const border = currentTheme["border-neutral-dark"] || "border-gray-700";
    const muted = currentTheme["text-neutral-medium"] || "text-gray-400";

    const monitor = useBotMonitor();
    const {
        workspaces = [],
        openBotsView = null,
        openBotSettings = null,
    } = useContext(WorkspaceContext) || {};

    const approvalsCount = monitor.approvals.length;
    useEffect(() => {
        if (onApprovalsCount) onApprovalsCount(approvalsCount);
    }, [approvalsCount, onApprovalsCount]);

    const setCollapsed = (next) => {
        if (onCollapsedChange) onCollapsedChange(next);
    };

    // AssistantDock (the only host) renders the rail + toggle button.
    if (collapsed) return null;

    return (
        <div className="flex flex-row shrink-0 h-screen" style={{ width: 384 }}>
            <div
                className={`flex flex-col flex-1 min-w-0 chrome-glass overflow-hidden border-l ${border}`}
            >
                <div
                    className={`flex items-center justify-between px-3 py-1.5 border-b ${border} shrink-0`}
                >
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon
                            icon="robot"
                            className={`h-3.5 w-3.5 ${muted}`}
                        />
                        <span
                            className={`text-xs font-medium tracking-wide ${muted}`}
                        >
                            BOTS
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setCollapsed(true)}
                        className={`p-1 rounded ${muted}`}
                        title="Collapse"
                        aria-label="Collapse"
                    >
                        <FontAwesomeIcon
                            icon="chevron-right"
                            className="h-3 w-3"
                        />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <BotMonitor
                        monitor={monitor}
                        workspaces={workspaces}
                        onOpenBotsView={openBotsView}
                        onOpenSettings={openBotSettings}
                    />
                </div>
            </div>
        </div>
    );
};
