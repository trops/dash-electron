/**
 * GongTrackers
 *
 * View Gong keyword tracker definitions and tracked phrases.
 *
 * @package Gong
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongTrackersContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");

    const [trackers, setTrackers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const handleLoadTrackers = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await callTool("get_trackers", {});
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["trackers"],
            });
            if (mcpError) {
                setErrorMsg(mcpError);
                return;
            }
            setTrackers(Array.isArray(data) ? data : []);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    }, [callTool]);

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        isConnected
                            ? "bg-green-500"
                            : isConnecting
                            ? "bg-yellow-500 animate-pulse"
                            : error
                            ? "bg-red-500"
                            : "bg-gray-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">{status}</span>
                <span className="text-gray-600">({tools.length} tools)</span>
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            <button
                onClick={handleLoadTrackers}
                disabled={!isConnected || loading}
                className="self-start px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
                {loading ? "Loading..." : "Load Trackers"}
            </button>

            {trackers.length > 0 && (
                <div className="space-y-2">
                    <SubHeading3 title={`Trackers (${trackers.length})`} />
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {trackers.map((tracker, i) => (
                            <div
                                key={tracker.id || tracker.trackerId || i}
                                className="px-3 py-2 bg-white/5 rounded space-y-1"
                            >
                                <div className="text-gray-300 font-medium text-xs">
                                    {tracker.name ||
                                        tracker.displayName ||
                                        "Tracker"}
                                </div>
                                {tracker.affiliation && (
                                    <div className="text-[10px] text-emerald-400">
                                        {tracker.affiliation}
                                    </div>
                                )}
                                {tracker.phrases?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {tracker.phrases
                                            .slice(0, 20)
                                            .map((phrase, j) => (
                                                <span
                                                    key={j}
                                                    className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400"
                                                >
                                                    {typeof phrase === "string"
                                                        ? phrase
                                                        : phrase.text ||
                                                          phrase.phrase ||
                                                          ""}
                                                </span>
                                            ))}
                                        {tracker.phrases.length > 20 && (
                                            <span className="text-[10px] text-gray-600">
                                                +{tracker.phrases.length - 20}{" "}
                                                more
                                            </span>
                                        )}
                                    </div>
                                )}
                                {tracker.filterQuery && (
                                    <div className="text-[10px] text-gray-600 mt-1">
                                        Filter: {tracker.filterQuery}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {trackers.length === 0 && !loading && (
                <div className="text-xs text-gray-600 italic">
                    Click Load Trackers to view keyword tracker definitions.
                </div>
            )}

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}
        </div>
    );
}

export const GongTrackers = ({ title = "Keyword Trackers", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GongTrackersContent title={title} />
            </Panel>
        </Widget>
    );
};
