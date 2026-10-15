import React, { useContext, useEffect } from "react";
import { ThemeContext } from "@trops/dash-react";
import {
    WorkspaceContext,
    BotContacts,
    useBotContacts,
} from "@trops/dash-core";

/**
 * BotActivityPanel — the dock's Bots panel (bot-teams TEAM-015): your bots as
 * a contacts list. Pick one to chat with it or see its activity; Needs you
 * (approvals across every dashboard) stays at the top. A frame around
 * dash-core's BotContacts, with the dock's hand-offs into a dashboard's Bots
 * view (in place, or as a popout) and Settings for bots on no dashboard.
 *
 * Stays mounted while collapsed (rendering nothing) so the approvals badge
 * on the dock rail stays live.
 */
export const BotActivityPanel = ({
    collapsed = true,
    onCollapsedChange,
    onApprovalsCount,
    // { botId } from a clicked notification — opens that bot.
    openRequest = null,
} = {}) => {
    const { currentTheme = {} } = useContext(ThemeContext) || {};
    const border = currentTheme["border-neutral-dark"] || "border-gray-700";

    const contacts = useBotContacts();
    const {
        workspaces = [],
        openBotsView = null,
        openBotSettings = null,
    } = useContext(WorkspaceContext) || {};

    const approvalsCount = contacts.approvals.length;
    useEffect(() => {
        if (onApprovalsCount) onApprovalsCount(approvalsCount);
    }, [approvalsCount, onApprovalsCount]);

    // AssistantDock (the only host) renders the rail + toggle button.
    if (collapsed) return null;

    return (
        <div className="flex flex-row shrink-0 h-screen" style={{ width: 384 }}>
            <div
                className={`flex flex-col flex-1 min-w-0 chrome-glass overflow-hidden border-l ${border}`}
            >
                <BotContacts
                    contacts={contacts}
                    workspaces={workspaces}
                    onOpenBotsView={openBotsView}
                    onOpenSettings={openBotSettings}
                    openRequest={openRequest}
                    onCollapse={() =>
                        onCollapsedChange && onCollapsedChange(true)
                    }
                />
            </div>
        </div>
    );
};
