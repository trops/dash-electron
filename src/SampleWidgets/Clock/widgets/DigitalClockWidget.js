/**
 * DigitalClockWidget
 *
 * Bold digital display with large monospace digits, optional blinking colon,
 * AM/PM badge, date line, and timezone label. Alarm-clock aesthetic.
 *
 * @package Clock
 */
import { useState, useEffect, useRef, useContext } from "react";
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

function DigitalClockContent({
    title,
    showSeconds,
    hourFormat,
    showDate,
    blinkColon,
    timezone,
}) {
    const { currentTheme } = useContext(ThemeContext);
    const [time, setTime] = useState(() => getTimeInZone(timezone));
    const [colonVisible, setColonVisible] = useState(true);
    const blinkRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(getTimeInZone(timezone));
        }, 1000);
        return () => clearInterval(timer);
    }, [timezone]);

    useEffect(() => {
        if (blinkColon === "true") {
            blinkRef.current = setInterval(() => {
                setColonVisible((v) => !v);
            }, 500);
            return () => clearInterval(blinkRef.current);
        } else {
            setColonVisible(true);
        }
    }, [blinkColon]);

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

    const hStr = is24
        ? String(displayHour).padStart(2, "0")
        : String(displayHour);
    const mStr = String(minutes).padStart(2, "0");
    const sStr = String(seconds).padStart(2, "0");

    const colonChar = colonVisible ? ":" : " ";

    const dateStr = time.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
            {title && (
                <Caption2
                    block
                    className="font-medium uppercase tracking-wider"
                >
                    {title}
                </Caption2>
            )}

            <div className="flex items-baseline gap-0">
                <span
                    className={`text-5xl font-bold font-mono tracking-tight ${
                        currentTheme?.["text-primary-medium"] || ""
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {hStr}
                    <span
                        style={{
                            opacity: colonVisible ? 1 : 0,
                            transition: "opacity 0.1s",
                        }}
                    >
                        {colonChar}
                    </span>
                    {mStr}
                    {displaySeconds && (
                        <>
                            <span
                                style={{
                                    opacity: colonVisible ? 1 : 0,
                                    transition: "opacity 0.1s",
                                }}
                            >
                                {colonChar}
                            </span>
                            {sStr}
                        </>
                    )}
                </span>
                {!is24 && (
                    <span
                        className={`text-sm font-semibold ml-2 uppercase ${
                            currentTheme?.["text-secondary-medium"] || ""
                        }`}
                    >
                        {period}
                    </span>
                )}
            </div>

            {displayDate && (
                <Caption2
                    block
                    className="font-mono tracking-wide"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
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

export const DigitalClockWidget = ({
    title = "",
    showSeconds = "true",
    hourFormat = "12",
    showDate = "true",
    blinkColon = "true",
    timezone = "",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <DigitalClockContent
                    title={title}
                    showSeconds={showSeconds}
                    hourFormat={hourFormat}
                    showDate={showDate}
                    blinkColon={blinkColon}
                    timezone={timezone}
                />
            </Panel>
        </Widget>
    );
};
