/**
 * useAlgoliaSettings
 *
 * Custom hook for reading and writing Algolia index settings via IPC.
 * Accepts a provider client ref (pc) from useProviderClient instead of
 * raw credentials — credentials are resolved on the main process side.
 */
import { useState, useEffect, useCallback } from "react";

export function useAlgoliaSettings(pc, indexName) {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        if (!pc?.providerHash || !indexName) return;
        setLoading(true);
        setError(null);
        try {
            const result = await window.mainApi.algolia.getSettings({
                ...pc,
                indexName,
                cache: true,
            });
            if (result?.error) {
                setError(result.message || "Failed to load settings");
            } else {
                setSettings(result);
            }
        } catch (err) {
            setError(err.message || "Failed to load settings");
        } finally {
            setLoading(false);
        }
    }, [pc?.providerHash, pc?.providerName, pc?.dashboardAppId, indexName]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateSettings = useCallback(
        async (partialSettings) => {
            if (!pc?.providerHash || !indexName) return;
            setSaving(true);
            setError(null);
            try {
                const result = await window.mainApi.algolia.setSettings({
                    ...pc,
                    indexName,
                    settings: partialSettings,
                });
                if (result?.error) {
                    setError(result.message || "Failed to save settings");
                    return false;
                }
                await refresh();
                return true;
            } catch (err) {
                setError(err.message || "Failed to save settings");
                return false;
            } finally {
                setSaving(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            pc?.providerHash,
            pc?.providerName,
            pc?.dashboardAppId,
            indexName,
            refresh,
        ]
    );

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { settings, loading, saving, error, updateSettings, refresh };
}
