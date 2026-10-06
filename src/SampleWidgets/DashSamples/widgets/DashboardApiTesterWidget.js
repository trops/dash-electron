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
import { useState, useEffect, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button2,
    SectionLabel,
    Caption2,
    InputText,
    ThemeContext,
} from "@trops/dash-react";
import { Widget, DashboardActionsApi } from "@trops/dash-core";

function Section({ title, children }) {
    return (
        <div className="flex flex-col gap-2">
            <SectionLabel>{title}</SectionLabel>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
}

// `color` is accepted for call-site compatibility but ignored — tiers are
// chosen by intent, not color, so every tester action is a secondary button.
function Btn({ onClick, children }) {
    return (
        <Button2 type="button" onClick={onClick} size="sm">
            {children}
        </Button2>
    );
}

function DashboardApiTesterContent({ title }) {
    const [pageInput, setPageInput] = useState("");
    const [dashInput, setDashInput] = useState("");
    const [readState, setReadState] = useState({});
    const { currentTheme } = useContext(ThemeContext);
    const valueClass = currentTheme?.["text-secondary-medium"] || "";

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
                <InputText
                    type="text"
                    value={pageInput}
                    onChange={(value) => setPageInput(value)}
                    placeholder="Page name"
                    className="w-32"
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
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
                <InputText
                    type="text"
                    value={dashInput}
                    onChange={(value) => setDashInput(value)}
                    placeholder="Dashboard name"
                    className="w-40"
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
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
                <SectionLabel>Read Methods (window.__dashState)</SectionLabel>
                <div
                    className={`${currentTheme?.["bg-primary-dark"] || ""} ${
                        currentTheme?.["text-primary-medium"] || ""
                    } rounded p-2 text-xs font-mono space-y-1`}
                >
                    <div>
                        <Caption2 className="font-mono">
                            currentPageName:
                        </Caption2>{" "}
                        <span className={valueClass}>
                            {readState.currentPageName || "null"}
                        </span>
                    </div>
                    <div>
                        <Caption2 className="font-mono">
                            currentPageId:
                        </Caption2>{" "}
                        <span className={valueClass}>
                            {readState.currentPageId || "null"}
                        </span>
                    </div>
                    <div>
                        <Caption2 className="font-mono">
                            currentDashboardName:
                        </Caption2>{" "}
                        <span className={valueClass}>
                            {readState.currentDashboardName || "null"}
                        </span>
                    </div>
                    <div>
                        <Caption2 className="font-mono">
                            currentDashboardId:
                        </Caption2>{" "}
                        <span className={valueClass}>
                            {readState.currentDashboardId || "null"}
                        </span>
                    </div>
                    <div>
                        <Caption2 className="font-mono">listPages():</Caption2>
                        {(readState.pages || []).length === 0 ? (
                            <Caption2 className="font-mono italic">
                                {" "}
                                []
                            </Caption2>
                        ) : (
                            <ul className="ml-4 mt-1 space-y-0.5">
                                {(readState.pages || []).map((p) => (
                                    <li
                                        key={p.id}
                                        className={
                                            currentTheme?.[
                                                "text-tertiary-medium"
                                            ] || ""
                                        }
                                    >
                                        [{p.order}] {p.name}{" "}
                                        <Caption2 className="font-mono">
                                            ({p.id})
                                        </Caption2>
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
