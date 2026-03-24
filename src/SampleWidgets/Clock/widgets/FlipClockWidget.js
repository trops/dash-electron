/**
 * FlipClockWidget
 *
 * Retro split-flap style where each digit pair appears as a card split
 * horizontally — dark top half, slightly lighter bottom half, thin divider
 * line. Airport departure board aesthetic.
 *
 * @package Clock
 */
import { useState, useEffect } from "react";
import { Panel } from "@trops/dash-react";
import { Widget } from "@trops/dash-core";

function getTimeInZone(timezone) {
    const now = new Date();
    if (!timezone) return now;
    try {
        const str = now.toLocaleString("en-US", { timeZone: timezone });
        return new Date(str);
    } catch {
        return now;
    }
}

function FlipCard({ value }) {
    const display = String(value).padStart(2, "0");

    return (
        <div
            className="relative flex flex-col rounded-md overflow-hidden"
            style={{
                width: "56px",
                height: "72px",
                boxShadow:
                    "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
        >
            {/* Top half */}
            <div
                className="flex items-end justify-center flex-1"
                style={{ backgroundColor: "#1a1a1a" }}
            >
                <span
                    className="text-3xl font-bold text-gray-100 font-mono leading-none"
                    style={{
                        fontVariantNumeric: "tabular-nums",
                        transform: "translateY(50%)",
                    }}
                >
                    {display}
                </span>
            </div>

            {/* Bottom half */}
            <div
                className="flex items-start justify-center flex-1"
                style={{ backgroundColor: "#222222" }}
            >
                <span
                    className="text-3xl font-bold text-gray-200 font-mono leading-none"
                    style={{
                        fontVariantNumeric: "tabular-nums",
                        transform: "translateY(-50%)",
                    }}
                >
                    {display}
                </span>
            </div>

            {/* Divider line */}
            <div
                className="absolute left-0 right-0"
                style={{
                    top: "50%",
                    height: "1px",
                    backgroundColor: "rgba(0,0,0,0.6)",
                }}
            />
        </div>
    );
}

function ColonSeparator() {
    return (
        <div className="flex flex-col items-center justify-center gap-2 mx-1">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <div className="w-2 h-2 rounded-full bg-gray-500" />
        </div>
    );
}

function FlipClockContent({
    title,
    showSeconds,
    hourFormat,
    showDate,
    timezone,
}) {
    const [time, setTime] = useState(() => getTimeInZone(timezone));

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(getTimeInZone(timezone));
        }, 1000);
        return () => clearInterval(timer);
    }, [timezone]);

    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();

    const is24 = hourFormat === "24";
    const displaySeconds = showSeconds === "true";
    const displayDate = showDate === "true";

    let displayHour = hours;
    let period = "";
    if (!is24) {
        period = hours >= 12 ? "PM" : "AM";
        displayHour = hours % 12 || 12;
    }

    const dateStr = time.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });

    return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
            {title && (
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    {title}
                </div>
            )}

            <div className="flex items-center">
                <FlipCard value={displayHour} />
                <ColonSeparator />
                <FlipCard value={minutes} />
                {displaySeconds && (
                    <>
                        <ColonSeparator />
                        <FlipCard value={seconds} />
                    </>
                )}
                {!is24 && (
                    <div className="ml-2 text-sm font-semibold text-gray-400 self-end mb-1">
                        {period}
                    </div>
                )}
            </div>

            {displayDate && (
                <div className="text-xs text-gray-500 font-mono tracking-wide">
                    {dateStr}
                </div>
            )}

            {timezone && (
                <div className="text-[10px] text-gray-600 font-mono">
                    {timezone}
                </div>
            )}
        </div>
    );
}

export const FlipClockWidget = ({
    title = "",
    showSeconds = "true",
    hourFormat = "12",
    showDate = "true",
    timezone = "",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <FlipClockContent
                    title={title}
                    showSeconds={showSeconds}
                    hourFormat={hourFormat}
                    showDate={showDate}
                    timezone={timezone}
                />
            </Panel>
        </Widget>
    );
};
