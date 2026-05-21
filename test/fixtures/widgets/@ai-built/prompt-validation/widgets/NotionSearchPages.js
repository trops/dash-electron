// File: widgets/NotionSearchPages.js
import React, { useState, useEffect, useMemo } from "react";
import {
    Panel,
    SubHeading2,
    SearchInput,
    Menu,
    MenuItem,
    Alert2,
    EmptyState,
    Skeleton,
    Caption,
    Caption3,
    Button3,
} from "@trops/dash-react";
import { useMcpProvider, useWidgetEvents } from "@trops/dash-core";

export default function NotionSearchPages({
    title = "Search Notion Pages",
    initialQuery = "",
    pageSize = 20,
}) {
    const {
        callTool,
        tools,
        isConnected,
        error: providerError,
    } = useMcpProvider("notion");
    const { publishEvent } = useWidgetEvents();

    const [query, setQuery] = useState(initialQuery);
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
    const [results, setResults] = useState(null);
    const [searchError, setSearchError] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    // Pattern B: sync prop -> state so userConfig edits flow through
    useEffect(() => {
        setQuery(initialQuery);
    }, [initialQuery]);

    // Debounce the input so we don't spam Notion's API per keystroke
    useEffect(() => {
        const t = setTimeout(
            () => setDebouncedQuery(typeof query === "string" ? query : ""),
            300
        );
        return () => clearTimeout(t);
    }, [query]);

    // Notion MCP servers expose search under different tool names depending
    // on which server is installed (official server uses "API-post-search";
    // community ones use "search" or "notion_search"). Pick the first match.
    const searchToolName = useMemo(() => {
        if (!Array.isArray(tools) || tools.length === 0) return null;
        const preferred = [
            "API-post-search",
            "search",
            "notion_search",
            "search_pages",
            "search-pages",
        ];
        for (const name of preferred) {
            if (tools.some((t) => t && t.name === name)) return name;
        }
        const fallback = tools.find(
            (t) =>
                t &&
                typeof t.name === "string" &&
                t.name.toLowerCase().includes("search")
        );
        return fallback ? fallback.name : null;
    }, [tools]);

    useEffect(() => {
        if (!isConnected || !Array.isArray(tools) || tools.length === 0) return;
        if (!searchToolName) return;

        const trimmed =
            typeof debouncedQuery === "string" ? debouncedQuery.trim() : "";
        if (!trimmed) {
            setResults(null);
            setSearchError(null);
            setIsSearching(false);
            return;
        }

        let cancelled = false;
        setIsSearching(true);
        setSearchError(null);

        const safePageSize =
            Number.isFinite(pageSize) && pageSize > 0
                ? Math.min(pageSize, 100)
                : 20;

        const args = {
            query: trimmed,
            filter: { property: "object", value: "page" },
            page_size: safePageSize,
        };

        callTool(searchToolName, args)
            .then((response) => {
                if (cancelled) return;
                setResults(parseNotionSearchResults(response));
                setIsSearching(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setSearchError(err);
                setResults(null);
                setIsSearching(false);
            });

        return () => {
            cancelled = true;
        };
    }, [
        isConnected,
        tools,
        searchToolName,
        debouncedQuery,
        pageSize,
        callTool,
    ]);

    const handleSelect = (item) => {
        publishEvent("pageSelected", {
            id: item.id,
            title: item.title,
            url: item.url,
            lastEditedTime: item.lastEditedTime,
        });
    };

    const openInNotion = (url) => {
        if (typeof url !== "string" || !url) return;
        if (
            typeof window !== "undefined" &&
            window.open &&
            typeof window.open === "function"
        ) {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    const trimmedQuery =
        typeof debouncedQuery === "string" ? debouncedQuery.trim() : "";

    return (
        <Panel>
            <SubHeading2 title={title} />

            <div className="mb-3">
                <SearchInput
                    value={query}
                    onChange={(e) => {
                        const next =
                            e && e.target && typeof e.target.value === "string"
                                ? e.target.value
                                : typeof e === "string"
                                ? e
                                : "";
                        setQuery(next);
                    }}
                    placeholder="Search pages by title…"
                />
            </div>

            {providerError && (
                <Alert2
                    title="Notion provider error"
                    message={
                        (providerError && providerError.message) ||
                        String(providerError)
                    }
                />
            )}

            {!providerError && isConnected && !searchToolName && (
                <Alert2
                    title="No search tool available"
                    message="The configured Notion MCP server doesn't expose a search tool. Check the server in Settings → Providers."
                />
            )}

            {!providerError && !isConnected && (
                <div className="py-2">
                    <Caption text="Connecting to Notion…" />
                </div>
            )}

            {searchError && (
                <Alert2
                    title="Search failed"
                    message={
                        (searchError && searchError.message) ||
                        String(searchError)
                    }
                />
            )}

            {!searchError && !providerError && isConnected && (
                <>
                    {!trimmedQuery && results === null && (
                        <EmptyState
                            title="Search your Notion workspace"
                            description="Type a query above to find pages by title."
                        />
                    )}

                    {trimmedQuery && isSearching && results === null && (
                        <Skeleton.Text lines={5} />
                    )}

                    {trimmedQuery &&
                        !isSearching &&
                        Array.isArray(results) &&
                        results.length === 0 && (
                            <EmptyState
                                title="No matches"
                                description={`No Notion pages matched "${trimmedQuery}".`}
                            />
                        )}

                    {Array.isArray(results) && results.length > 0 && (
                        <>
                            <div className="mb-2">
                                <Caption3
                                    text={`${results.length} result${
                                        results.length === 1 ? "" : "s"
                                    } for "${trimmedQuery}"`}
                                />
                            </div>
                            <Menu>
                                {results.map((item) => (
                                    <MenuItem
                                        key={item.id}
                                        onClick={() => handleSelect(item)}
                                    >
                                        <div className="flex items-center justify-between w-full gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="truncate">
                                                    {item.title}
                                                </div>
                                                {item.lastEditedTime && (
                                                    <Caption3
                                                        text={`Edited ${formatDate(
                                                            item.lastEditedTime
                                                        )}`}
                                                    />
                                                )}
                                            </div>
                                            {item.url && (
                                                <Button3
                                                    title="Open"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        if (
                                                            e &&
                                                            typeof e.stopPropagation ===
                                                                "function"
                                                        )
                                                            e.stopPropagation();
                                                        openInNotion(item.url);
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </MenuItem>
                                ))}
                            </Menu>
                        </>
                    )}
                </>
            )}
        </Panel>
    );
}

// --- Defensive parsing helpers ---

function parseNotionSearchResults(response) {
    if (!response) return [];

    // MCP tool responses sometimes wrap JSON in { content: [{ type: "text", text: "..." }] }
    let payload = response;
    if (response && Array.isArray(response.content)) {
        const joined = response.content
            .filter((c) => c && c.type === "text" && typeof c.text === "string")
            .map((c) => c.text)
            .join("");
        if (joined) {
            try {
                payload = JSON.parse(joined);
            } catch (_) {
                payload = response;
            }
        }
    }

    const items = Array.isArray(payload && payload.results)
        ? payload.results
        : Array.isArray(payload)
        ? payload
        : [];

    const mapped = items
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const id = typeof item.id === "string" ? item.id : "";
            if (!id) return null;
            return {
                id,
                title: extractTitle(item),
                url: typeof item.url === "string" ? item.url : "",
                lastEditedTime:
                    typeof item.last_edited_time === "string"
                        ? item.last_edited_time
                        : "",
            };
        })
        .filter(Boolean);

    return mapped;
}

function extractTitle(item) {
    if (!item || typeof item !== "object") return "Untitled";

    const props =
        item.properties && typeof item.properties === "object"
            ? item.properties
            : {};

    for (const key of Object.keys(props)) {
        const prop = props[key];
        if (prop && prop.type === "title" && Array.isArray(prop.title)) {
            const text = prop.title
                .map((t) =>
                    t && typeof t.plain_text === "string" ? t.plain_text : ""
                )
                .join("");
            if (text) return text;
        }
    }

    if (Array.isArray(item.title)) {
        const text = item.title
            .map((t) =>
                t && typeof t.plain_text === "string" ? t.plain_text : ""
            )
            .join("");
        if (text) return text;
    }

    if (typeof item.title === "string" && item.title) return item.title;

    if (
        item.child_page &&
        typeof item.child_page.title === "string" &&
        item.child_page.title
    ) {
        return item.child_page.title;
    }

    return "Untitled";
}

function formatDate(iso) {
    if (typeof iso !== "string" || !iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
