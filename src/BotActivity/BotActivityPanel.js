import React, { useContext, useEffect } from "react";
import { ThemeContext } from "@trops/dash-react";
import {
    WorkspaceContext,
    BotContacts,
    useBotContacts,
} from "@trops/dash-core";

/**
 * BotActivityPanel — the dock's Bots panel (bot-teams TEAM-015): your bots as
 * a contacts list. Pick one to open its bot page in a large modal (dash-core
 * NAV-016 AC5); Needs you (approvals across every dashboard) stays at the
 * top. A frame around dash-core's BotContacts.
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
    const { workspaces = [] } = useContext(WorkspaceContext) || {};

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
                    openRequest={openRequest}
                    onCollapse={() =>
                        onCollapsedChange && onCollapsedChange(true)
                    }
                />
            </div>
        </div>
    );
};
