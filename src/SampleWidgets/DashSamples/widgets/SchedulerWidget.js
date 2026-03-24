/**
 * SchedulerWidget
 *
 * Demonstrates the scheduler API via useScheduler().
 * Displays task states, fire counts, and a live event log
 * of scheduled task executions.
 *
 * @package DashSamples
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2, FontAwesomeIcon } from "@trops/dash-react";
import { Widget, useScheduler } from "@trops/dash-core";

function SchedulerContent({ title }) {
    const [refreshCount, setRefreshCount] = useState(0);
    const [reportCount, setReportCount] = useState(0);
    const [eventLog, setEventLog] = useState([]);

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
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Task States
                </div>
                <div className="space-y-1">
                    {tasks.length === 0 ? (
                        <div className="text-xs text-gray-600 italic">
                            No tasks configured. Open Settings &gt; Schedule to
                            add one.
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <div
                                key={task.taskKey}
                                className="text-xs font-mono bg-gray-800/50 rounded px-2 py-1 flex items-center gap-2"
                            >
                                <FontAwesomeIcon
                                    icon={
                                        task.enabled
                                            ? "circle-check"
                                            : "circle-xmark"
                                    }
                                    className={
                                        task.enabled
                                            ? "text-green-400"
                                            : "text-gray-600"
                                    }
                                />
                                <span className="text-indigo-400">
                                    {task.taskKey}
                                </span>
                                <span className="text-gray-500">
                                    fires: {task.fireCount || 0}
                                </span>
                                {task.lastFiredAt && (
                                    <span className="text-gray-500">
                                        last:{" "}
                                        {new Date(
                                            task.lastFiredAt
                                        ).toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Declared Scheduled Tasks */}
            <div>
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Declared Tasks
                </div>
                <div className="flex flex-wrap gap-1">
                    <span className="text-xs font-mono bg-gray-800/50 rounded px-2 py-1 text-indigo-400">
                        refreshData (fired: {refreshCount})
                    </span>
                    <span className="text-xs font-mono bg-gray-800/50 rounded px-2 py-1 text-indigo-400">
                        generateReport (fired: {reportCount})
                    </span>
                </div>
            </div>

            {/* Event Log */}
            <div className="flex-1 min-h-0">
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Event Log
                </div>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {eventLog.length === 0 ? (
                        <div className="text-xs text-gray-600 italic">
                            No fires yet. Configure a schedule in Settings &gt;
                            Schedule.
                        </div>
                    ) : (
                        eventLog.map((entry, i) => (
                            <div
                                key={i}
                                className="text-xs font-mono bg-gray-800/50 rounded px-2 py-1"
                            >
                                <span className="text-gray-500">
                                    {entry.timestamp}
                                </span>{" "}
                                <span className="text-indigo-400">
                                    {entry.taskKey}
                                </span>{" "}
                                <span className="text-green-400">fired</span>
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
