/**
 * SettingsDiffTable
 *
 * Renders a side-by-side comparison of two index settings,
 * highlighting differences with the theme's error/success status colors.
 */
import { useState, useContext } from "react";
import { Caption2, ThemeContext, useStatusTokens } from "@trops/dash-react";

export function SettingsDiffTable({
    diffs,
    extraDiffs,
    identical,
    summary,
    nameA,
    nameB,
}) {
    const [showIdentical, setShowIdentical] = useState(false);
    const [showExtra, setShowExtra] = useState(false);
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

    // Theme tokens: header row / chips sit one step above the Panel surface;
    // Index A / Index B headers use the secondary / tertiary accents.
    const surface = currentTheme?.["bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const border = currentTheme?.["border-primary-dark"] || "";
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";
    const accentA = currentTheme?.["text-secondary-medium"] || "";
    const accentB = currentTheme?.["text-tertiary-medium"] || "";
    const valueA = status.error.icon;
    const valueB = status.success.icon;

    return (
        <div className="space-y-3">
            {/* Summary */}
            <div
                className={`flex flex-wrap items-center gap-3 p-2 rounded text-xs ${surface}`}
            >
                <Caption2>{summary.totalChecked} settings checked</Caption2>
                {summary.differences > 0 ? (
                    <span className={`font-medium ${status.warning.icon}`}>
                        {summary.differences} difference
                        {summary.differences !== 1 ? "s" : ""}
                    </span>
                ) : (
                    <span className={`font-medium ${status.success.icon}`}>
                        All identical
                    </span>
                )}
                <Caption2>{summary.identicalCount} identical</Caption2>
                {summary.extraDifferences > 0 && (
                    <Caption2>+{summary.extraDifferences} other</Caption2>
                )}
            </div>

            {/* Diff Table */}
            {diffs.length > 0 && (
                <div className={`border rounded overflow-hidden ${border}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className={surface}>
                                    <th
                                        className={`px-2 py-1.5 text-left font-medium w-1/4 border-b ${border}`}
                                    >
                                        <Caption2 className="font-medium">
                                            Setting
                                        </Caption2>
                                    </th>
                                    <th
                                        className={`px-2 py-1.5 text-left font-medium border-b ${border} ${accentA}`}
                                    >
                                        {nameA}
                                    </th>
                                    <th
                                        className={`px-2 py-1.5 text-left font-medium border-b ${border} ${accentB}`}
                                    >
                                        {nameB}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {diffs.map((d) => (
                                    <tr
                                        key={d.key}
                                        className={`border-b ${border} ${rowHover}`}
                                    >
                                        <td
                                            className={`px-2 py-1.5 font-mono ${bodyText}`}
                                        >
                                            {d.key}
                                        </td>
                                        <td
                                            className={`px-2 py-1.5 font-mono break-all ${valueA}`}
                                        >
                                            {d.valueA}
                                        </td>
                                        <td
                                            className={`px-2 py-1.5 font-mono break-all ${valueB}`}
                                        >
                                            {d.valueB}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Extra Diffs (non-standard keys) */}
            {extraDiffs.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowExtra(!showExtra)}
                        className="hover:underline"
                    >
                        <Caption2>
                            {showExtra ? "Hide" : "Show"} {extraDiffs.length}{" "}
                            other difference
                            {extraDiffs.length !== 1 ? "s" : ""}
                        </Caption2>
                    </button>
                    {showExtra && (
                        <div
                            className={`border rounded overflow-hidden mt-1 ${border}`}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <tbody>
                                        {extraDiffs.map((d) => (
                                            <tr
                                                key={d.key}
                                                className={`border-b ${border}`}
                                            >
                                                <td className="px-2 py-1 w-1/4">
                                                    <Caption2 className="font-mono">
                                                        {d.key}
                                                    </Caption2>
                                                </td>
                                                <td
                                                    className={`px-2 py-1 font-mono break-all opacity-75 ${valueA}`}
                                                >
                                                    {d.valueA}
                                                </td>
                                                <td
                                                    className={`px-2 py-1 font-mono break-all opacity-75 ${valueB}`}
                                                >
                                                    {d.valueB}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Identical Settings */}
            {identical.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowIdentical(!showIdentical)}
                        className="hover:underline"
                    >
                        <Caption2>
                            {showIdentical ? "Hide" : "Show"} {identical.length}{" "}
                            identical setting
                            {identical.length !== 1 ? "s" : ""}
                        </Caption2>
                    </button>
                    {showIdentical && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {identical.map((key) => (
                                <Caption2
                                    key={key}
                                    className={`px-1.5 py-0.5 rounded font-mono ${surface}`}
                                >
                                    {key}
                                </Caption2>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
