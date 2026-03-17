import React, { useState, useEffect, useCallback } from "react";

function ApiCatalog() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [collapsed, setCollapsed] = useState(new Set());

    const fetchCatalog = useCallback(async () => {
        if (!window.mainApi || !window.mainApi.debug) return;
        try {
            const catalog = await window.mainApi.debug.getApiCatalog();
            setGroups(catalog || []);
        } catch {
            // ignore
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCatalog();
    }, [fetchCatalog]);

    const toggleGroup = (namespace) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(namespace)) {
                next.delete(namespace);
            } else {
                next.add(namespace);
            }
            return next;
        });
    };

    const filtered = search
        ? groups
              .map((g) => ({
                  ...g,
                  channels: g.channels.filter(
                      (c) =>
                          c.channel
                              .toLowerCase()
                              .includes(search.toLowerCase()) ||
                          g.namespace
                              .toLowerCase()
                              .includes(search.toLowerCase())
                  ),
              }))
              .filter((g) => g.channels.length > 0)
        : groups;

    const totalChannels = groups.reduce((sum, g) => sum + g.channels.length, 0);
    const totalCalls = groups.reduce(
        (sum, g) =>
            sum + g.channels.reduce((s, c) => s + (c.callCount || 0), 0),
        0
    );

    if (loading) {
        return <div className="debug-empty">Loading API catalog...</div>;
    }

    return (
        <div className="api-catalog">
            <div className="api-catalog-controls">
                <input
                    type="text"
                    className="api-catalog-search"
                    placeholder="Filter channels..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button
                    className="debug-action-btn"
                    onClick={fetchCatalog}
                    title="Refresh catalog"
                >
                    Refresh
                </button>
            </div>

            <div className="api-catalog-list">
                {filtered.length === 0 ? (
                    <div className="debug-empty">
                        {search
                            ? "No channels match filter"
                            : "No handlers registered"}
                    </div>
                ) : (
                    filtered.map((group) => (
                        <div
                            key={group.namespace}
                            className="api-catalog-group"
                        >
                            <div
                                className="api-catalog-group-header"
                                onClick={() => toggleGroup(group.namespace)}
                            >
                                <span className="api-catalog-toggle">
                                    {collapsed.has(group.namespace) ? "▶" : "▼"}
                                </span>
                                <span className="api-catalog-namespace">
                                    {group.namespace}
                                </span>
                                <span className="api-catalog-count">
                                    {group.channels.length} channel
                                    {group.channels.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            {!collapsed.has(group.namespace) && (
                                <div className="api-catalog-channels">
                                    {group.channels.map((ch) => (
                                        <div
                                            key={ch.channel}
                                            className="api-catalog-channel"
                                        >
                                            <span className="api-catalog-channel-name">
                                                {ch.channel}
                                            </span>
                                            <span className="api-catalog-call-count">
                                                {ch.callCount || 0} call
                                                {ch.callCount !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="debug-status-bar">
                <span>
                    {filtered.reduce((s, g) => s + g.channels.length, 0)} /{" "}
                    {totalChannels} channels
                </span>
                <span>{totalCalls} total calls this session</span>
            </div>
        </div>
    );
}

export default ApiCatalog;
