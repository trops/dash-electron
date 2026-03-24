/**
 * IndexSelector
 *
 * Shared dropdown for selecting an Algolia index.
 * Accepts a provider client ref (pc) from useProviderClient —
 * credentials are resolved on the main process side.
 */
import { useState, useEffect } from "react";

export function IndexSelector({ pc, selectedIndex, onSelect }) {
    const [indices, setIndices] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!pc?.providerHash) return;
        setLoading(true);

        const handleComplete = (_event, data) => {
            setIndices(data || []);
            setLoading(false);
            if (data?.length > 0 && !selectedIndex) {
                onSelect(data[0].name);
            }
        };
        const handleError = () => {
            setLoading(false);
        };

        window.mainApi.on("algolia-list-indices-complete", handleComplete);
        window.mainApi.on("algolia-list-indices-error", handleError);
        window.mainApi.algolia.listIndices({ ...pc, cache: true });

        return () => {
            window.mainApi.removeListener(
                "algolia-list-indices-complete",
                handleComplete
            );
            window.mainApi.removeListener(
                "algolia-list-indices-error",
                handleError
            );
        };
    }, [pc?.providerHash]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return (
            <div className="text-xs text-gray-400 italic">
                Loading indices...
            </div>
        );
    }

    return (
        <select
            value={selectedIndex}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
        >
            <option value="">Select an index...</option>
            {indices.map((idx) => (
                <option key={idx.name} value={idx.name}>
                    {idx.name} ({(idx.entries || 0).toLocaleString()} records)
                </option>
            ))}
        </select>
    );
}
