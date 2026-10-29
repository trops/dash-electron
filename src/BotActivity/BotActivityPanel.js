import React, { useContext } from "react";
import { ThemeContext } from "@trops/dash-react";
import { BotNotificationsPanel } from "@trops/dash-core";

/**
 * BotActivityPanel — the dock's bot notifications (lead-workspace release
 * 4, frames 22 and 27–29): the shown dashboard's lead, Needs you from every
 * dashboard (answered here), and Activity. A frame around dash-core's
 * BotNotificationsPanel; bot management is on the Bots page.
 *
 * Stays mounted while collapsed (rendering nothing) so the rail's dot — and
 * the panel opening by itself — stay live.
 */
export const BotActivityPanel = ({
    collapsed = true,
    onCollapsedChange,
    // ({ count, newestAt }) — what needs the user, for the rail.
    onNeedsChange,
    // { botId } from a clicked notification — opens that bot's conversation.
    openRequest = null,
} = {}) => {
    const { currentTheme = {} } = useContext(ThemeContext) || {};
    const border = currentTheme["border-neutral-dark"] || "border-gray-700";

    // The panel itself stays mounted collapsed: it reports what needs the
    // user either way.
    return (
        <div
            className={collapsed ? "" : "flex flex-row shrink-0 h-screen"}
            style={collapsed ? undefined : { width: 384 }}
        >
            <div
                className={
                    collapsed
                        ? ""
                        : `flex flex-col flex-1 min-w-0 chrome-glass overflow-hidden border-l ${border}`
                }
            >
                <BotNotificationsPanel
                    collapsed={collapsed}
                    onClose={() => onCollapsedChange && onCollapsedChange(true)}
                    onNeedsChange={onNeedsChange}
                    openRequest={openRequest}
                />
            </div>
        </div>
    );
};
