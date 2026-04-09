/**
 * DashboardApiTesterWidget
 *
 * Test widget that exercises every method on DashboardActionsApi.
 * Drop this widget onto any dashboard to verify:
 *  - goBack, switchPage, switchPageByName
 *  - openSidebar, closeSidebar, toggleSidebar
 *  - openDashboardByName, closeDashboard
 *  - notify (success / error / info / warning)
 *  - Read methods: getCurrentPageName, listPages, etc.
 *
 * @package DashSamples
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, DashboardActionsApi } from "@trops/dash-core";

function Section({ title, children }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {title}
            </div>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
}

function Btn({ onClick, children, color = "indigo" }) {
    const colors = {
        indigo: "bg-indigo-600 hover:bg-indigo-500",
        emerald: "bg-emerald-600 hover:bg-emerald-500",
        rose: "bg-rose-600 hover:bg-rose-500",
        amber: "bg-amber-600 hover:bg-amber-500",
        slate: "bg-slate-600 hover:bg-slate-500",
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 text-white rounded-md text-xs font-medium transition-colors ${colors[color]}`}
        >
            {children}
        </button>
    );
}

function DashboardApiTesterContent({ title }) {
    const [pageInput, setPageInput] = useState("");
    const [dashInput, setDashInput] = useState("");
    const [readState, setReadState] = useState({});

    // Poll read methods so the panel reflects current state
    useEffect(() => {
        function refresh() {
            setReadState({
                currentPageId: DashboardActionsApi.getCurrentPageId(),
                currentPageName: DashboardActionsApi.getCurrentPageName(),
                currentDashboardId: DashboardActionsApi.getCurrentDashboardId(),
                currentDashboardName:
                    DashboardActionsApi.getCurrentDashboardName(),
                pages: DashboardActionsApi.listPages(),
            });
        }
        refresh();
        const interval = setInterval(refresh, 500);
        return () => clearInterval(interval);
    }, []);

    const notify = useCallback((type) => {
        DashboardActionsApi.notify(`This is a ${type} toast`, {
            type,
            title: type.charAt(0).toUpperCase() + type.slice(1),
            duration: 4000,
        });
    }, []);

    return (
        <div className="flex flex-col gap-4 h-full overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Page Navigation */}
            <Section title="Page Navigation">
                <Btn onClick={() => DashboardActionsApi.goBack()} color="slate">
                    goBack()
                </Btn>
                <input
                    type="text"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    placeholder="Page name"
                    className="px-2 py-1 bg-gray-800 border border-gray-600 rounded-md text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-32"
                />
                <Btn
                    onClick={() =>
                        pageInput &&
                        DashboardActionsApi.switchPageByName(pageInput)
                    }
                >
                    switchPageByName
                </Btn>
            </Section>

            {/* Sidebar Control */}
            <Section title="Workspace Nav Sidebar">
                <Btn
                    onClick={() => DashboardActionsApi.openSidebar()}
                    color="emerald"
                >
                    openSidebar
                </Btn>
                <Btn
                    onClick={() => DashboardActionsApi.closeSidebar()}
                    color="rose"
                >
                    closeSidebar
                </Btn>
                <Btn
                    onClick={() => DashboardActionsApi.toggleSidebar()}
                    color="slate"
                >
                    toggleSidebar
                </Btn>
            </Section>

            {/* Notifications */}
            <Section title="Notifications (in-app toasts)">
                <Btn onClick={() => notify("success")} color="emerald">
                    notify success
                </Btn>
                <Btn onClick={() => notify("error")} color="rose">
                    notify error
                </Btn>
                <Btn onClick={() => notify("info")} color="indigo">
                    notify info
                </Btn>
                <Btn onClick={() => notify("warning")} color="amber">
                    notify warning
                </Btn>
            </Section>

            {/* Workspace Navigation */}
            <Section title="Dashboard Navigation">
                <input
                    type="text"
                    value={dashInput}
                    onChange={(e) => setDashInput(e.target.value)}
                    placeholder="Dashboard name"
                    className="px-2 py-1 bg-gray-800 border border-gray-600 rounded-md text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-40"
                />
                <Btn
                    onClick={() =>
                        dashInput &&
                        DashboardActionsApi.openDashboardByName(dashInput)
                    }
                >
                    openDashboardByName
                </Btn>
                <Btn
                    onClick={() => DashboardActionsApi.closeDashboard()}
                    color="rose"
                >
                    closeDashboard (current)
                </Btn>
            </Section>

            {/* Read Methods Panel */}
            <div className="flex flex-col gap-1 mt-2">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    Read Methods (window.__dashState)
                </div>
                <div className="bg-gray-800/50 rounded p-2 text-xs font-mono text-gray-300 space-y-1">
                    <div>
                        <span className="text-gray-500">currentPageName:</span>{" "}
                        <span className="text-emerald-400">
                            {readState.currentPageName || "null"}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">currentPageId:</span>{" "}
                        <span className="text-emerald-400">
                            {readState.currentPageId || "null"}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">
                            currentDashboardName:
                        </span>{" "}
                        <span className="text-emerald-400">
                            {readState.currentDashboardName || "null"}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">
                            currentDashboardId:
                        </span>{" "}
                        <span className="text-emerald-400">
                            {readState.currentDashboardId || "null"}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">listPages():</span>
                        {(readState.pages || []).length === 0 ? (
                            <span className="text-gray-600 italic"> []</span>
                        ) : (
                            <ul className="ml-4 mt-1 space-y-0.5">
                                {(readState.pages || []).map((p) => (
                                    <li key={p.id} className="text-amber-400">
                                        [{p.order}] {p.name}{" "}
                                        <span className="text-gray-600">
                                            ({p.id})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export const DashboardApiTesterWidget = ({
    title = "Dashboard API Tester",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <DashboardApiTesterContent title={title} />
            </Panel>
        </Widget>
    );
};
