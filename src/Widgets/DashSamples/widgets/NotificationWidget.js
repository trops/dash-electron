/**
 * NotificationWidget
 *
 * Demonstrates the notification API via useNotifications().
 * Provides buttons to trigger each notification type and displays
 * the result of each notify() call.
 *
 * @package DashSamples
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2, Button } from "@trops/dash-react";
import { Widget, useNotifications } from "@trops/dash-core";

function NotificationContent({ title }) {
    const { notify, notificationTypes } = useNotifications();
    const [resultLog, setResultLog] = useState([]);

    const addToLog = useCallback((type, result) => {
        setResultLog((prev) => [
            {
                type,
                result,
                timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 49),
        ]);
    }, []);

    const handleNotify = useCallback(
        async (type) => {
            const result = await notify({
                type,
                title: `${
                    type.charAt(0).toUpperCase() + type.slice(1)
                } Notification`,
                body: `This is a sample ${type} notification from SampleNotificationWidget.`,
            });
            addToLog(type, result);
        },
        [notify, addToLog]
    );

    return (
        <div className="flex flex-col gap-4 h-full">
            <SubHeading2 title={title} />

            {/* Notification Buttons */}
            <div className="flex flex-wrap gap-2">
                <Button title="Info" onClick={() => handleNotify("info")} />
                <Button
                    title="Success"
                    onClick={() => handleNotify("success")}
                />
                <Button
                    title="Warning"
                    onClick={() => handleNotify("warning")}
                />
                <Button
                    title="Critical"
                    onClick={() => handleNotify("critical")}
                />
            </div>

            {/* Declared Notification Types */}
            <div>
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Declared Types
                </div>
                <div className="flex flex-wrap gap-1">
                    {notificationTypes.map((n) => (
                        <span
                            key={n.key}
                            className="text-xs font-mono bg-gray-800/50 rounded px-2 py-1 text-rose-400"
                        >
                            {n.key}
                        </span>
                    ))}
                </div>
            </div>

            {/* Result Log */}
            <div className="flex-1 min-h-0">
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Results
                </div>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {resultLog.length === 0 ? (
                        <div className="text-xs text-gray-600 italic">
                            No notifications sent yet. Click a button above.
                        </div>
                    ) : (
                        resultLog.map((entry, i) => (
                            <div
                                key={i}
                                className="text-xs font-mono bg-gray-800/50 rounded px-2 py-1"
                            >
                                <span className="text-gray-500">
                                    {entry.timestamp}
                                </span>{" "}
                                <span className="text-rose-400">
                                    {entry.type}
                                </span>{" "}
                                <span
                                    className={
                                        entry.result?.success
                                            ? "text-green-400"
                                            : "text-red-400"
                                    }
                                >
                                    {JSON.stringify(entry.result)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export const NotificationWidget = ({ title = "Notifications", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <NotificationContent title={title} />
            </Panel>
        </Widget>
    );
};
