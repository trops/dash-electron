/**
 * GongTrackers
 *
 * View Gong keyword tracker definitions and tracked phrases.
 *
 * @package Gong
 */
import { useState, useCallback, useContext } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    Panel,
    SubHeading2,
    SubHeading3,
    Tag3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongTrackersContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const surface = currentTheme?.["bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";

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
                            ? statusTokens.success.solidBg
                            : isConnecting
                            ? `${statusTokens.warning.solidBg} animate-pulse`
                            : error
                            ? statusTokens.error.solidBg
                            : currentTheme?.["bg-primary-medium"] || ""
                    }`}
                />
                <Caption2 className="font-mono">{status}</Caption2>
                <Caption2 className="opacity-70">
                    ({tools.length} tools)
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            <Button
                size="sm"
                onClick={handleLoadTrackers}
                disabled={!isConnected || loading}
                className="self-start"
            >
                {loading ? "Loading..." : "Load Trackers"}
            </Button>

            {trackers.length > 0 && (
                <div className="space-y-2">
                    <SubHeading3 title={`Trackers (${trackers.length})`} />
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {trackers.map((tracker, i) => (
                            <div
                                key={tracker.id || tracker.trackerId || i}
                                className={`px-3 py-2 rounded space-y-1 ${surface}`}
                            >
                                <div
                                    className={`font-medium text-xs ${bodyText}`}
                                >
                                    {tracker.name ||
                                        tracker.displayName ||
                                        "Tracker"}
                                </div>
                                {tracker.affiliation && (
                                    <div className={`text-xs ${accentText}`}>
                                        {tracker.affiliation}
                                    </div>
                                )}
                                {tracker.phrases?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {tracker.phrases
                                            .slice(0, 20)
                                            .map((phrase, j) => (
                                                <Tag3 key={j} border={false}>
                                                    {typeof phrase === "string"
                                                        ? phrase
                                                        : phrase.text ||
                                                          phrase.phrase ||
                                                          ""}
                                                </Tag3>
                                            ))}
                                        {tracker.phrases.length > 20 && (
                                            <Caption2 className="opacity-70">
                                                +{tracker.phrases.length - 20}{" "}
                                                more
                                            </Caption2>
                                        )}
                                    </div>
                                )}
                                {tracker.filterQuery && (
                                    <Caption2 block className="mt-1">
                                        Filter: {tracker.filterQuery}
                                    </Caption2>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {trackers.length === 0 && !loading && (
                <Caption2 block className="italic">
                    Click Load Trackers to view keyword tracker definitions.
                </Caption2>
            )}

            {errorMsg && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={errorMsg}
                />
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
