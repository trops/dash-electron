/**
 * SettingsDiffTable
 *
 * Renders a side-by-side comparison of two index settings,
 * highlighting differences in red/green.
 */
import { useState } from "react";

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

    return (
        <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-3 p-2 bg-gray-800/50 rounded text-xs">
                <span className="text-gray-400">
                    {summary.totalChecked} settings checked
                </span>
                {summary.differences > 0 ? (
                    <span className="text-yellow-400 font-medium">
                        {summary.differences} difference
                        {summary.differences !== 1 ? "s" : ""}
                    </span>
                ) : (
                    <span className="text-green-400 font-medium">
                        All identical
                    </span>
                )}
                <span className="text-gray-500">
                    {summary.identicalCount} identical
                </span>
                {summary.extraDifferences > 0 && (
                    <span className="text-gray-500">
                        +{summary.extraDifferences} other
                    </span>
                )}
            </div>

            {/* Diff Table */}
            {diffs.length > 0 && (
                <div className="border border-gray-700 rounded overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-800">
                                    <th className="px-2 py-1.5 text-left text-gray-400 font-medium w-1/4 border-b border-gray-700">
                                        Setting
                                    </th>
                                    <th className="px-2 py-1.5 text-left text-blue-400 font-medium w-[37.5%] border-b border-gray-700">
                                        {nameA}
                                    </th>
                                    <th className="px-2 py-1.5 text-left text-emerald-400 font-medium w-[37.5%] border-b border-gray-700">
                                        {nameB}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {diffs.map((d) => (
                                    <tr
                                        key={d.key}
                                        className="border-b border-gray-800 hover:bg-white/5"
                                    >
                                        <td className="px-2 py-1.5 text-gray-300 font-mono">
                                            {d.key}
                                        </td>
                                        <td className="px-2 py-1.5 text-red-300/80 font-mono break-all">
                                            {d.valueA}
                                        </td>
                                        <td className="px-2 py-1.5 text-green-300/80 font-mono break-all">
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
                        className="text-[10px] text-gray-500 hover:text-gray-300"
                    >
                        {showExtra ? "Hide" : "Show"} {extraDiffs.length} other
                        difference
                        {extraDiffs.length !== 1 ? "s" : ""}
                    </button>
                    {showExtra && (
                        <div className="border border-gray-700 rounded overflow-hidden mt-1">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <tbody>
                                        {extraDiffs.map((d) => (
                                            <tr
                                                key={d.key}
                                                className="border-b border-gray-800"
                                            >
                                                <td className="px-2 py-1 text-gray-400 font-mono w-1/4">
                                                    {d.key}
                                                </td>
                                                <td className="px-2 py-1 text-red-300/60 font-mono break-all w-[37.5%]">
                                                    {d.valueA}
                                                </td>
                                                <td className="px-2 py-1 text-green-300/60 font-mono break-all w-[37.5%]">
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
                        className="text-[10px] text-gray-500 hover:text-gray-300"
                    >
                        {showIdentical ? "Hide" : "Show"} {identical.length}{" "}
                        identical setting
                        {identical.length !== 1 ? "s" : ""}
                    </button>
                    {showIdentical && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {identical.map((key) => (
                                <span
                                    key={key}
                                    className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-500 font-mono"
                                >
                                    {key}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
