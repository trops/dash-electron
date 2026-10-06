/**
 * SchedulerWidget
 *
 * Demonstrates the scheduler API via useScheduler().
 * Displays task states, fire counts, and a live event log
 * of scheduled task executions.
 *
 * @package DashSamples
 */
import { useState, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    FontAwesomeIcon,
    SectionLabel,
    Caption2,
    Tag3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useScheduler } from "@trops/dash-core";

function SchedulerContent({ title }) {
    const [refreshCount, setRefreshCount] = useState(0);
    const [reportCount, setReportCount] = useState(0);
    const [eventLog, setEventLog] = useState([]);
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const rowClass = `text-xs font-mono ${
        currentTheme?.["bg-primary-dark"] || ""
    } ${currentTheme?.["text-primary-medium"] || ""} rounded px-2 py-1`;
    const accentClass = currentTheme?.["text-secondary-medium"] || "";

    const addToLog = useCallback((taskKey) => {
        setEventLog((prev) => [
            {
                taskKey,
                timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 49),
        ]);
    }, []);

    const { tasks } = useScheduler({
        refreshData: () => {
            setRefreshCount((c) => c + 1);
            addToLog("refreshData");
        },
        generateReport: () => {
            setReportCount((c) => c + 1);
            addToLog("generateReport");
        },
    });

    return (
        <div className="flex flex-col gap-4 h-full">
            <SubHeading2 title={title} />

            {/* Task States */}
            <div>
                <SectionLabel className="mb-1">Task States</SectionLabel>
                <div className="space-y-1">
                    {tasks.length === 0 ? (
                        <Caption2 block className="italic">
                            No tasks configured. Open Settings &gt; Schedule to
                            add one.
                        </Caption2>
                    ) : (
                        tasks.map((task) => (
                            <div
                                key={task.taskKey}
                                className={`${rowClass} flex items-center gap-2`}
                            >
                                <FontAwesomeIcon
                                    icon={
                                        task.enabled
                                            ? "circle-check"
                                            : "circle-xmark"
                                    }
                                    className={
                                        task.enabled
                                            ? statusTokens.success.icon
                                            : "opacity-50"
                                    }
                                />
                                <span className={accentClass}>
                                    {task.taskKey}
                                </span>
                                <Caption2 className="font-mono">
                                    fires: {task.fireCount || 0}
                                </Caption2>
                                {task.lastFiredAt && (
                                    <Caption2 className="font-mono">
                                        last:{" "}
                                        {new Date(
                                            task.lastFiredAt
                                        ).toLocaleTimeString()}
                                    </Caption2>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Declared Scheduled Tasks */}
            <div>
                <SectionLabel className="mb-1">Declared Tasks</SectionLabel>
                <div className="flex flex-wrap gap-1">
                    <Tag3 className="font-mono" padding="px-2 py-1">
                        refreshData (fired: {refreshCount})
                    </Tag3>
                    <Tag3 className="font-mono" padding="px-2 py-1">
                        generateReport (fired: {reportCount})
                    </Tag3>
                </div>
            </div>

            {/* Event Log */}
            <div className="flex-1 min-h-0">
                <SectionLabel className="mb-1">Event Log</SectionLabel>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {eventLog.length === 0 ? (
                        <Caption2 block className="italic">
                            No fires yet. Configure a schedule in Settings &gt;
                            Schedule.
                        </Caption2>
                    ) : (
                        eventLog.map((entry, i) => (
                            <div key={i} className={rowClass}>
                                <Caption2 className="font-mono">
                                    {entry.timestamp}
                                </Caption2>{" "}
                                <span className={accentClass}>
                                    {entry.taskKey}
                                </span>{" "}
                                <span className={statusTokens.success.icon}>
                                    fired
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export const SchedulerWidget = ({ title = "Scheduler", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SchedulerContent title={title} />
            </Panel>
        </Widget>
    );
};
