/**
 * MinimalTextClockWidget
 *
 * Spells out the time in natural English ("quarter past three"). Optional
 * greeting based on time of day and small numeric reference. Typographic
 * editorial style.
 *
 * @package Clock
 */
import { useState, useEffect, useRef } from "react";
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

const ONES = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty"];

function numberToWords(n) {
    if (n === 0) return "twelve";
    if (n < 20) return ONES[n];
    const ten = Math.floor(n / 10);
    const one = n % 10;
    return TENS[ten] + (one ? "-" + ONES[one] : "");
}

function timeToWords(hours, minutes) {
    const h12 = hours % 12 || 12;
    const nextH = (h12 % 12) + 1;

    if (minutes === 0) {
        return `${numberToWords(h12)} o'clock`;
    }
    if (minutes === 15) {
        return `quarter past ${numberToWords(h12)}`;
    }
    if (minutes === 30) {
        return `half past ${numberToWords(h12)}`;
    }
    if (minutes === 45) {
        return `quarter to ${numberToWords(nextH)}`;
    }
    if (minutes < 30) {
        return `${numberToWords(minutes)} past ${numberToWords(h12)}`;
    }
    return `${numberToWords(60 - minutes)} to ${numberToWords(nextH)}`;
}

function getGreeting(hours) {
    if (hours < 5) return "Good night";
    if (hours < 12) return "Good morning";
    if (hours < 17) return "Good afternoon";
    if (hours < 21) return "Good evening";
    return "Good night";
}

function MinimalTextClockContent({
    title,
    showGreeting,
    showNumeric,
    hourFormat,
    timezone,
}) {
    const [time, setTime] = useState(() => getTimeInZone(timezone));
    const prevMinuteRef = useRef(null);
    const [displayText, setDisplayText] = useState("");

    useEffect(() => {
        const update = () => {
            const now = getTimeInZone(timezone);
            setTime(now);
            const currentMinute = now.getHours() * 60 + now.getMinutes();
            if (currentMinute !== prevMinuteRef.current) {
                prevMinuteRef.current = currentMinute;
                setDisplayText(timeToWords(now.getHours(), now.getMinutes()));
            }
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [timezone]);

    const hours = time.getHours();
    const minutes = time.getMinutes();
    const displayGreeting = showGreeting === "true";
    const displayNumeric = showNumeric === "true";
    const is24 = hourFormat === "24";

    const numericTime = (() => {
        let h = hours;
        let suffix = "";
        if (!is24) {
            suffix = h >= 12 ? " pm" : " am";
            h = h % 12 || 12;
        }
        const hStr = is24 ? String(h).padStart(2, "0") : String(h);
        const mStr = String(minutes).padStart(2, "0");
        return `${hStr}:${mStr}${suffix}`;
    })();

    return (
        <div className="flex flex-col justify-center h-full gap-3 px-1">
            {title && (
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    {title}
                </div>
            )}

            {displayGreeting && (
                <div className="text-sm text-gray-400 italic">
                    {getGreeting(hours)}
                </div>
            )}

            <div className="text-2xl font-light text-gray-100 leading-snug capitalize">
                {displayText}
            </div>

            {displayNumeric && (
                <div
                    className="text-xs text-gray-500 font-mono"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {numericTime}
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

export const MinimalTextClockWidget = ({
    title = "",
    showGreeting = "true",
    showNumeric = "true",
    hourFormat = "12",
    timezone = "",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <MinimalTextClockContent
                    title={title}
                    showGreeting={showGreeting}
                    showNumeric={showNumeric}
                    hourFormat={hourFormat}
                    timezone={timezone}
                />
            </Panel>
        </Widget>
    );
};
