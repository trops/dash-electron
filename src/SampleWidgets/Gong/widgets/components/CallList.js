import { useContext } from "react";
import { Caption2, ThemeContext } from "@trops/dash-react";

export function CallList({ calls, onSelectCall, selectedId = null }) {
    const { currentTheme } = useContext(ThemeContext);

    if (calls.length === 0) {
        return (
            <Caption2 block className="italic">
                No calls found
            </Caption2>
        );
    }

    const rowSurface = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    }`;
    const selectedSurface = `border ${
        currentTheme?.["bg-secondary-dark"] || ""
    } ${currentTheme?.["text-secondary-light"] || ""} ${
        currentTheme?.["border-secondary-medium"] || ""
    }`;
    const bodyText = currentTheme?.["text-primary-medium"] || "";

    return (
        <div className="max-h-96 overflow-y-auto space-y-1">
            {calls.map((call, i) => (
                <button
                    key={call.id || call.metaData?.id || call.callId || i}
                    onClick={() => onSelectCall(call)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                        selectedId &&
                        selectedId ===
                            (call.id || call.metaData?.id || call.callId)
                            ? selectedSurface
                            : `${rowSurface} ${bodyText}`
                    }`}
                >
                    <div className="truncate">
                        {call.title ||
                            call.metaData?.title ||
                            call.subject ||
                            call.name ||
                            "Untitled"}
                    </div>
                    <Caption2 block className="flex items-center gap-2 mt-0.5">
                        {(call.started ||
                            call.date ||
                            call.metaData?.started) && (
                            <span>
                                {formatDate(
                                    call.started ||
                                        call.date ||
                                        call.metaData?.started
                                )}
                            </span>
                        )}
                        {(call.duration ?? call.metaData?.duration) != null && (
                            <span>
                                {Math.round(
                                    (call.duration ?? call.metaData?.duration) /
                                        60
                                )}
                                m
                            </span>
                        )}
                        {call.scope && (
                            <span className="opacity-70">{call.scope}</span>
                        )}
                        {call.parties?.length > 0 && (
                            <span>
                                {call.parties.length} participant
                                {call.parties.length !== 1 ? "s" : ""}
                            </span>
                        )}
                    </Caption2>
                </button>
            ))}
        </div>
    );
}

/** Display a date string — handles ISO dates and short formats like "3/24/2026". */
function formatDate(value) {
    if (!value) return "";
    // If it's already a short human-readable string, use as-is
    if (typeof value === "string" && !value.includes("T")) return value;
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return String(value);
    }
}
