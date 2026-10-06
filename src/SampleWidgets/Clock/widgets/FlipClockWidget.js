/**
 * FlipClockWidget
 *
 * Retro split-flap style where each digit pair appears as a card split
 * horizontally — dark top half, slightly lighter bottom half, thin divider
 * line. Airport departure board aesthetic.
 *
 * @package Clock
 */
import { useState, useEffect, useContext } from "react";
import { Panel, Caption2, ThemeContext } from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
    const display = String(value).padStart(2, "0");
    const digitText = currentTheme?.["text-primary-medium"] || "";

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
                className={`flex items-end justify-center flex-1 ${
                    currentTheme?.["bg-primary-very-dark"] || ""
                }`}
            >
                <span
                    className={`text-3xl font-bold font-mono leading-none ${digitText}`}
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
                className={`flex items-start justify-center flex-1 ${
                    currentTheme?.["bg-primary-dark"] || ""
                }`}
            >
                <span
                    className={`text-3xl font-bold font-mono leading-none ${digitText}`}
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
                className={`absolute left-0 right-0 border-t ${
                    currentTheme?.["border-primary-dark"] || ""
                }`}
                style={{ top: "50%" }}
            />
        </div>
    );
}

function ColonSeparator() {
    const { currentTheme } = useContext(ThemeContext);
    return (
        <div
            className={`flex flex-col items-center justify-center gap-2 mx-1 ${
                currentTheme?.["text-primary-medium"] || ""
            }`}
        >
            <div className="w-2 h-2 rounded-full bg-current opacity-50" />
            <div className="w-2 h-2 rounded-full bg-current opacity-50" />
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
                <Caption2
                    block
                    className="font-medium uppercase tracking-wider"
                >
                    {title}
                </Caption2>
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
                    <Caption2
                        block
                        className="ml-2 text-sm font-semibold self-end mb-1"
                    >
                        {period}
                    </Caption2>
                )}
            </div>

            {displayDate && (
                <Caption2 block className="font-mono tracking-wide">
                    {dateStr}
                </Caption2>
            )}

            {timezone && (
                <Caption2 block className="font-mono opacity-70">
                    {timezone}
                </Caption2>
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
