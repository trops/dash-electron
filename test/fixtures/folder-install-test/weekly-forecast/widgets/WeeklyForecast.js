import React from "react";
import { Panel, FontAwesomeIcon } from "@trops/dash-react";

const forecast = [
    { day: "Mon", icon: "sun", high: 75, low: 58 },
    { day: "Tue", icon: "cloud-sun", high: 72, low: 56 },
    { day: "Wed", icon: "cloud", high: 68, low: 54 },
    { day: "Thu", icon: "cloud-rain", high: 63, low: 51 },
    { day: "Fri", icon: "cloud-rain", high: 61, low: 50 },
    { day: "Sat", icon: "cloud-sun", high: 70, low: 55 },
    { day: "Sun", icon: "sun", high: 76, low: 59 },
];

const WeeklyForecast = (props) => {
    const { title = "7-Day Forecast", ...rest } = props;

    return (
        <Panel {...rest}>
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                <FontAwesomeIcon
                    icon="calendar"
                    className="h-4 w-4 text-white/70"
                />
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>

            <div className="px-3 pb-3 space-y-1">
                {forecast.map((day) => (
                    <div
                        key={day.day}
                        className="flex items-center justify-between py-1 border-b border-white/5 last:border-0"
                    >
                        <span className="text-xs text-white/70 w-8">
                            {day.day}
                        </span>
                        <FontAwesomeIcon
                            icon={day.icon}
                            className="h-3 w-3 text-white/50"
                        />
                        <div className="flex gap-2 text-xs">
                            <span className="text-white/90">{day.high}°</span>
                            <span className="text-white/40">{day.low}°</span>
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
};

export default WeeklyForecast;
