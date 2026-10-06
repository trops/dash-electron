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
import { useState, useEffect, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    Button2,
    AlertBanner,
    Caption2,
    InputText,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();
    if (!items.length) {
        return (
            <Caption2 block className="italic">
                None configured.
            </Caption2>
        );
    }
    const chipClass = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["text-primary-medium"] || ""
    }`;
    return (
        <div className="flex flex-wrap gap-1">
            {items.map((item) => (
                <span
                    key={item}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${chipClass}`}
                >
                    {item}
                    <button
                        onClick={() => onRemove(item)}
                        className={`opacity-70 ${status.error.hoverText}`}
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
            <InputText
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={placeholder}
                className="flex-1"
                height="h-7"
                padding="px-2 py-1"
                inputClassName="text-xs"
            />
            <Button2 onClick={handleAdd} size="sm">
                Add
            </Button2>
        </div>
    );
}

function AlgoliaHighlightSnippetContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

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
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia credential provider not configured. Add an Algolia provider with your App ID and API Key."
                />
            </div>
        );
    }

    // Preview box sits one step above the Panel surface.
    const previewClass = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["border-primary-dark"] || ""
    } ${currentTheme?.["text-primary-medium"] || ""}`;

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />
            <IndexSelector
                pc={pc}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
            />
            {!selectedIndex && (
                <Caption2 block className="italic">
                    Select an index to configure highlight & snippet settings.
                </Caption2>
            )}
            {loading && (
                <Caption2 block className="italic">
                    Loading settings...
                </Caption2>
            )}
            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
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
                            <InputText
                                value={preTag}
                                onChange={(e) => {
                                    setPreTag(e.target.value);
                                    setDirty(true);
                                }}
                                height="h-7"
                                padding="px-2 py-1"
                                inputClassName="text-xs font-mono"
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
                            <InputText
                                value={postTag}
                                onChange={(e) => {
                                    setPostTag(e.target.value);
                                    setDirty(true);
                                }}
                                height="h-7"
                                padding="px-2 py-1"
                                inputClassName="text-xs font-mono"
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
                        <InputText
                            value={ellipsis}
                            onChange={(e) => {
                                setEllipsis(e.target.value);
                                setDirty(true);
                            }}
                            className="w-32"
                            height="h-7"
                            padding="px-2 py-1"
                            inputClassName="text-xs font-mono"
                        />
                    </div>
                    {/* Live preview */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold">Preview</span>
                        <div
                            className={`p-2 border rounded text-xs ${previewClass}`}
                        >
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
                        <Button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            size="sm"
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
                        {saveSuccess && (
                            <span className={`text-xs ${status.success.icon}`}>
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
