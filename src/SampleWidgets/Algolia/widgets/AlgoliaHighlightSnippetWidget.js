/**
 * AlgoliaHighlightSnippetWidget
 *
 * Configure highlighting and snippeting: attributesToHighlight, attributesToSnippet,
 * highlightPreTag, highlightPostTag, snippetEllipsisText.
 * Includes a live preview of how highlighting looks.
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";
import { useAlgoliaSettings } from "../hooks/useAlgoliaSettings";
import { IndexSelector } from "../components/IndexSelector";
import { SettingHeader } from "../components/SettingHeader";
import { SETTINGS_META } from "../utils/algoliaSettingsMetadata";

function TagList({ items, onRemove }) {
    if (!items.length) {
        return (
            <div className="text-xs text-gray-500 italic">None configured.</div>
        );
    }
    return (
        <div className="flex flex-wrap gap-1">
            {items.map((item) => (
                <span
                    key={item}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-200"
                >
                    {item}
                    <button
                        onClick={() => onRemove(item)}
                        className="text-gray-400 hover:text-red-400"
                    >
                        &times;
                    </button>
                </span>
            ))}
        </div>
    );
}

function AddInput({ onAdd, placeholder }) {
    const [value, setValue] = useState("");
    const handleAdd = () => {
        const v = value.trim();
        if (v) {
            onAdd(v);
            setValue("");
        }
    };
    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={placeholder}
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
            <button
                onClick={handleAdd}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200"
            >
                Add
            </button>
        </div>
    );
}

function AlgoliaHighlightSnippetContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();

    const [selectedIndex, setSelectedIndex] = useState("");
    const { settings, loading, saving, error, updateSettings } =
        useAlgoliaSettings(pc, selectedIndex);

    const [highlightAttrs, setHighlightAttrs] = useState([]);
    const [snippetAttrs, setSnippetAttrs] = useState([]);
    const [preTag, setPreTag] = useState("<em>");
    const [postTag, setPostTag] = useState("</em>");
    const [ellipsis, setEllipsis] = useState("\u2026");
    const [dirty, setDirty] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Listen for indexSelected events from IndexSelector widget
    useEffect(() => {
        if (!listeners || !listen) return;
        const hasListeners =
            typeof listeners === "object" && Object.keys(listeners).length > 0;
        if (hasListeners) {
            listen(listeners, {
                indexSelected: (data) => {
                    const payload = data.message || data;
                    if (payload.name) setSelectedIndex(payload.name);
                },
            });
        }
    }, [listeners, listen]);

    useEffect(() => {
        if (!settings) return;
        setHighlightAttrs(settings.attributesToHighlight || []);
        setSnippetAttrs(settings.attributesToSnippet || []);
        setPreTag(settings.highlightPreTag || "<em>");
        setPostTag(settings.highlightPostTag || "</em>");
        setEllipsis(settings.snippetEllipsisText ?? "\u2026");
        setDirty(false);
    }, [settings]);

    const handleSave = async () => {
        setSaveSuccess(false);
        const ok = await updateSettings({
            attributesToHighlight: highlightAttrs,
            attributesToSnippet: snippetAttrs,
            highlightPreTag: preTag,
            highlightPostTag: postTag,
            snippetEllipsisText: ellipsis,
        });
        if (ok) {
            setDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const addHighlight = (attr) => {
        if (!highlightAttrs.includes(attr)) {
            setHighlightAttrs([...highlightAttrs, attr]);
            setDirty(true);
        }
    };
    const removeHighlight = (attr) => {
        setHighlightAttrs(highlightAttrs.filter((a) => a !== attr));
        setDirty(true);
    };
    const addSnippet = (attr) => {
        if (!snippetAttrs.includes(attr)) {
            setSnippetAttrs([...snippetAttrs, attr]);
            setDirty(true);
        }
    };
    const removeSnippet = (attr) => {
        setSnippetAttrs(snippetAttrs.filter((a) => a !== attr));
        setDirty(true);
    };

    if (!hasCredentials) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs">
                    Algolia credential provider not configured. Add an Algolia
                    provider with your App ID and API Key.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />
            <IndexSelector
                pc={pc}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
            />
            {!selectedIndex && (
                <div className="text-xs text-gray-500 italic">
                    Select an index to configure highlight & snippet settings.
                </div>
            )}
            {loading && (
                <div className="text-xs text-gray-400 italic">
                    Loading settings...
                </div>
            )}
            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}
            {settings && selectedIndex && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.attributesToHighlight.label}
                            description={
                                SETTINGS_META.attributesToHighlight.description
                            }
                            docUrl={SETTINGS_META.attributesToHighlight.docUrl}
                        />
                        <TagList
                            items={highlightAttrs}
                            onRemove={removeHighlight}
                        />
                        <AddInput
                            onAdd={addHighlight}
                            placeholder="Attribute name"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <SettingHeader
                            title={SETTINGS_META.attributesToSnippet.label}
                            description={
                                SETTINGS_META.attributesToSnippet.description
                            }
                            docUrl={SETTINGS_META.attributesToSnippet.docUrl}
                        />
                        <TagList
                            items={snippetAttrs}
                            onRemove={removeSnippet}
                        />
                        <AddInput
                            onAdd={addSnippet}
                            placeholder="e.g., content:30"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <SettingHeader
                                title={SETTINGS_META.highlightPreTag.label}
                                description={
                                    SETTINGS_META.highlightPreTag.description
                                }
                                docUrl={SETTINGS_META.highlightPreTag.docUrl}
                            />
                            <input
                                type="text"
                                value={preTag}
                                onChange={(e) => {
                                    setPreTag(e.target.value);
                                    setDirty(true);
                                }}
                                className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <SettingHeader
                                title={SETTINGS_META.highlightPostTag.label}
                                description={
                                    SETTINGS_META.highlightPostTag.description
                                }
                                docUrl={SETTINGS_META.highlightPostTag.docUrl}
                            />
                            <input
                                type="text"
                                value={postTag}
                                onChange={(e) => {
                                    setPostTag(e.target.value);
                                    setDirty(true);
                                }}
                                className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <SettingHeader
                            title={SETTINGS_META.snippetEllipsisText.label}
                            description={
                                SETTINGS_META.snippetEllipsisText.description
                            }
                            docUrl={SETTINGS_META.snippetEllipsisText.docUrl}
                        />
                        <input
                            type="text"
                            value={ellipsis}
                            onChange={(e) => {
                                setEllipsis(e.target.value);
                                setDirty(true);
                            }}
                            className="w-32 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    {/* Live preview */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-gray-200">
                            Preview
                        </span>
                        <div className="p-2 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300">
                            {ellipsis}the quick brown{" "}
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: `${preTag}fox${postTag}`,
                                }}
                            />{" "}
                            jumped over the lazy dog{ellipsis}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs text-white transition-colors"
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                        {saveSuccess && (
                            <span className="text-xs text-green-400">
                                Saved!
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export const AlgoliaHighlightSnippetWidget = ({
    title = "Highlight & Snippet",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaHighlightSnippetContent title={title} />
            </Panel>
        </Widget>
    );
};
