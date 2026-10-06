/**
 * IndexSelector
 *
 * Shared dropdown for selecting an Algolia index.
 * Accepts a provider client ref (pc) from useProviderClient —
 * credentials are resolved on the main process side.
 */
import { useState, useEffect } from "react";
import { Caption2, SelectInput } from "@trops/dash-react";

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
            <Caption2 block className="italic">
                Loading indices...
            </Caption2>
        );
    }

    return (
        <SelectInput
            value={selectedIndex}
            onChange={(value) => onSelect(value)}
            placeholder="Select an index..."
            options={indices.map((idx) => ({
                value: idx.name,
                label: `${idx.name} (${(
                    idx.entries || 0
                ).toLocaleString()} records)`,
            }))}
            inputClassName="text-xs"
        />
    );
}
