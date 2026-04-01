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
        let cancelled = false;
        setLoading(true);

        window.mainApi.algolia
            .listIndices({ ...pc, cache: true })
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : [];
                setIndices(list);
                setLoading(false);
                if (list.length > 0 && !selectedIndex) {
                    onSelect(list[0].name);
                }
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
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
