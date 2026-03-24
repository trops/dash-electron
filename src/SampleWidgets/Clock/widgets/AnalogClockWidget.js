/**
 * AnalogClockWidget
 *
 * Classic circular clock face rendered in SVG with hour/minute/second hands,
 * tick marks, and a center dot. Optional digital time readout beneath.
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

function AnalogClockContent({
    title,
    showSeconds,
    showDigital,
    hourFormat,
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

    const hourAngle = (hours % 12) * 30 + minutes * 0.5;
    const minuteAngle = minutes * 6 + seconds * 0.1;
    const secondAngle = seconds * 6;

    const displaySeconds = showSeconds === "true";
    const displayDigital = showDigital === "true";
    const is24 = hourFormat === "24";

    const digitalTime = (() => {
        let h = hours;
        let suffix = "";
        if (!is24) {
            suffix = h >= 12 ? " PM" : " AM";
            h = h % 12 || 12;
        }
        const hStr = is24 ? String(h).padStart(2, "0") : String(h);
        const mStr = String(minutes).padStart(2, "0");
        const sStr = String(seconds).padStart(2, "0");
        return `${hStr}:${mStr}${displaySeconds ? ":" + sStr : ""}${suffix}`;
    })();

    const cx = 100;
    const cy = 100;
    const radius = 90;

    const hourTicks = [];
    for (let i = 0; i < 12; i++) {
        const angle = (i * 30 * Math.PI) / 180;
        const x1 = cx + (radius - 12) * Math.sin(angle);
        const y1 = cy - (radius - 12) * Math.cos(angle);
        const x2 = cx + radius * Math.sin(angle);
        const y2 = cy - radius * Math.cos(angle);
        hourTicks.push(
            <line
                key={`h-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#94a3b8"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        );
    }

    const minuteTicks = [];
    for (let i = 0; i < 60; i++) {
        if (i % 5 === 0) continue;
        const angle = (i * 6 * Math.PI) / 180;
        const x1 = cx + (radius - 5) * Math.sin(angle);
        const y1 = cy - (radius - 5) * Math.cos(angle);
        const x2 = cx + radius * Math.sin(angle);
        const y2 = cy - radius * Math.cos(angle);
        minuteTicks.push(
            <line
                key={`m-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#475569"
                strokeWidth="1"
                strokeLinecap="round"
            />
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
            {title && (
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {title}
                </div>
            )}
            <svg
                viewBox="0 0 200 200"
                className="w-full max-w-[180px] aspect-square"
            >
                {/* Clock face */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke="#334155"
                    strokeWidth="2"
                />

                {/* Tick marks */}
                {minuteTicks}
                {hourTicks}

                {/* Hour hand */}
                <line
                    x1={cx}
                    y1={cy}
                    x2={cx + 50 * Math.sin((hourAngle * Math.PI) / 180)}
                    y2={cy - 50 * Math.cos((hourAngle * Math.PI) / 180)}
                    stroke="#e2e8f0"
                    strokeWidth="4"
                    strokeLinecap="round"
                />

                {/* Minute hand */}
                <line
                    x1={cx}
                    y1={cy}
                    x2={cx + 70 * Math.sin((minuteAngle * Math.PI) / 180)}
                    y2={cy - 70 * Math.cos((minuteAngle * Math.PI) / 180)}
                    stroke="#cbd5e1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                {/* Second hand */}
                {displaySeconds && (
                    <line
                        x1={cx}
                        y1={cy + 15}
                        x2={cx + 75 * Math.sin((secondAngle * Math.PI) / 180)}
                        y2={cy - 75 * Math.cos((secondAngle * Math.PI) / 180)}
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                )}

                {/* Center dot */}
                <circle cx={cx} cy={cy} r="4" fill="#e2e8f0" />
                {displaySeconds && (
                    <circle cx={cx} cy={cy} r="2.5" fill="#ef4444" />
                )}
            </svg>

            {displayDigital && (
                <div
                    className="text-sm text-gray-300 font-mono tracking-wider"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {digitalTime}
                </div>
            )}

            {timezone && (
                <div className="text-[10px] text-gray-500 font-mono">
                    {timezone}
                </div>
            )}
        </div>
    );
}

export const AnalogClockWidget = ({
    title = "Analog Clock",
    showSeconds = "true",
    showDigital = "false",
    hourFormat = "12",
    timezone = "",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AnalogClockContent
                    title={title}
                    showSeconds={showSeconds}
                    showDigital={showDigital}
                    hourFormat={hourFormat}
                    timezone={timezone}
                />
            </Panel>
        </Widget>
    );
};
