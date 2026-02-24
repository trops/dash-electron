import React from "react";
import { Panel, FontAwesomeIcon } from "@trops/dash-react";

const alerts = [
    {
        id: 1,
        severity: "Warning",
        title: "Heat Advisory",
        description:
            "Temperatures expected to reach 105°F. Drink plenty of water and limit outdoor activity.",
        start: "Today 12:00 PM",
        end: "Tomorrow 8:00 PM",
        color: "text-red-400",
    },
    {
        id: 2,
        severity: "Watch",
        title: "Wind Advisory",
        description:
            "Sustained winds of 25-35 mph with gusts up to 55 mph expected.",
        start: "Tomorrow 6:00 AM",
        end: "Tomorrow 6:00 PM",
        color: "text-yellow-400",
    },
];

const WeatherAlerts = (props) => {
    const { title = "Weather Alerts", ...rest } = props;

    return (
        <Panel {...rest}>
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                <FontAwesomeIcon
                    icon="triangle-exclamation"
                    className="h-4 w-4 text-amber-400"
                />
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <span className="ml-auto text-xs text-white/40">
                    {alerts.length} active
                </span>
            </div>

            <div className="px-3 pb-3 space-y-2">
                {alerts.map((alert) => (
                    <div key={alert.id} className="bg-white/5 rounded p-2">
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className={`text-xs font-semibold ${alert.color}`}
                            >
                                {alert.severity}
                            </span>
                            <span className="text-xs font-medium text-white">
                                {alert.title}
                            </span>
                        </div>
                        <p className="text-xs text-white/60 mb-1">
                            {alert.description}
                        </p>
                        <p className="text-xs text-white/30">
                            {alert.start} — {alert.end}
                        </p>
                    </div>
                ))}
            </div>
        </Panel>
    );
};

export default WeatherAlerts;
