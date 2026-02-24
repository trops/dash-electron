import React, { useMemo } from "react";
import {
    Button,
    SubHeading,
    Accordion2,
    getStylesForItem,
    themeObjects,
    colorTypes,
    themeVariants,
} from "@trops/dash-react";

const TOKEN_TYPES = ["bg", "text", "border"];

// --- Color Swatch Grid ---

const SwatchCell = ({ tokenKey, resolvedClass, type }) => {
    const tooltip = `${tokenKey} → ${resolvedClass || "(none)"}`;

    if (type === "bg") {
        return (
            <div
                className={`h-8 flex-1 rounded ${resolvedClass || ""}`}
                title={tooltip}
            />
        );
    }

    if (type === "text") {
        return (
            <div
                className="h-8 flex-1 rounded flex items-center justify-center bg-black/10"
                title={tooltip}
            >
                <span className={`text-xs font-bold ${resolvedClass || ""}`}>
                    Aa
                </span>
            </div>
        );
    }

    // border
    return (
        <div
            className={`h-8 flex-1 rounded border-2 ${resolvedClass || ""}`}
            title={tooltip}
        />
    );
};

const ColorSwatchGrid = ({ displayTheme }) => {
    return (
        <div className="flex flex-col space-y-5">
            {colorTypes.map((family) => (
                <div key={family} className="flex flex-col space-y-2">
                    <span className="text-xs font-semibold opacity-50 capitalize">
                        {family}
                    </span>
                    {TOKEN_TYPES.map((type) => (
                        <div
                            key={type}
                            className="flex flex-row items-center gap-2"
                        >
                            <span className="text-[10px] opacity-40 w-10 text-right shrink-0">
                                {type}
                            </span>
                            <div className="flex flex-row gap-1.5 flex-1">
                                {themeVariants.map((shade) => {
                                    const tokenKey = `${type}-${family}-${shade}`;
                                    const resolvedClass =
                                        displayTheme[tokenKey] || "";
                                    return (
                                        <SwatchCell
                                            key={shade}
                                            tokenKey={tokenKey}
                                            resolvedClass={resolvedClass}
                                            type={type}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

// --- Component Style Accordion ---

const COLOR_KEYS = [
    "backgroundColor",
    "textColor",
    "borderColor",
    "hoverBackgroundColor",
    "hoverTextColor",
    "hoverBorderColor",
    "activeBackgroundColor",
    "activeTextColor",
    "focusRingColor",
    "focusBorderColor",
];

const NON_COLOR_KEYS = [
    "shadow",
    "borderRadius",
    "spacing",
    "textSize",
    "iconSize",
    "fontWeight",
    "transition",
    "cursor",
    "disabledOpacity",
    "letterSpacing",
    "lineHeight",
];

const COMPONENT_GROUPS = [
    {
        label: "Buttons",
        keys: [
            "BUTTON",
            "BUTTON_2",
            "BUTTON_3",
            "BUTTON_ICON",
            "BUTTON_ICON_2",
            "BUTTON_ICON_3",
        ],
    },
    {
        label: "Panels",
        keys: [
            "PANEL",
            "PANEL_2",
            "PANEL_3",
            "PANEL_HEADER",
            "PANEL_HEADER_2",
            "PANEL_HEADER_3",
            "PANEL_FOOTER",
            "PANEL_FOOTER_2",
            "PANEL_FOOTER_3",
            "DASH_PANEL",
            "DASH_PANEL_2",
            "DASH_PANEL_3",
            "DASH_PANEL_HEADER",
            "DASH_PANEL_HEADER_2",
            "DASH_PANEL_HEADER_3",
            "DASH_PANEL_FOOTER",
            "DASH_PANEL_FOOTER_2",
            "DASH_PANEL_FOOTER_3",
        ],
    },
    {
        label: "Cards",
        keys: [
            "CARD",
            "CARD_2",
            "CARD_3",
            "STAT_CARD",
            "STAT_CARD_LABEL",
            "STAT_CARD_VALUE",
            "STAT_CARD_CHANGE",
        ],
    },
    {
        label: "Typography",
        keys: [
            "HEADING",
            "HEADING_2",
            "HEADING_3",
            "SUBHEADING",
            "SUBHEADING_2",
            "SUBHEADING_3",
            "PARAGRAPH",
            "PARAGRAPH_2",
            "PARAGRAPH_3",
        ],
    },
    {
        label: "Navigation",
        keys: [
            "MENU_ITEM",
            "MENU_ITEM_2",
            "MENU_ITEM_3",
            "TABS",
            "TABS_2",
            "TABS_3",
            "TABS_LIST",
            "TABS_LIST_2",
            "TABS_LIST_3",
            "TABS_TRIGGER",
            "TABS_TRIGGER_2",
            "TABS_TRIGGER_3",
            "TABS_CONTENT",
            "TABS_CONTENT_2",
            "TABS_CONTENT_3",
            "SIDEBAR",
            "SIDEBAR_ITEM",
            "NAVBAR",
            "TABBED_NAVBAR",
            "BREADCRUMBS",
            "BREADCRUMBS_2",
            "BREADCRUMBS_3",
        ],
    },
    {
        label: "Forms",
        keys: [
            "INPUT_TEXT",
            "SELECT_MENU",
            "TEXTAREA",
            "CHECKBOX",
            "RADIO",
            "SWITCH",
            "SLIDER",
            "SEARCH_INPUT",
            "TOGGLE",
            "TOGGLE_2",
            "TOGGLE_3",
            "FORM_LABEL",
        ],
    },
    {
        label: "Feedback",
        keys: [
            "ALERT",
            "ALERT_2",
            "ALERT_3",
            "ALERT_BANNER",
            "TOAST",
            "TOAST_2",
            "TOAST_3",
            "PROGRESS_BAR",
            "PROGRESS_BAR_2",
            "PROGRESS_BAR_3",
            "TAG",
            "TAG_2",
            "TAG_3",
            "TOOLTIP",
            "EMPTY_STATE",
        ],
    },
    {
        label: "Tables",
        keys: ["TABLE", "TABLE_2", "TABLE_3", "DATA_LIST", "DATA_LIST_ITEM"],
    },
    {
        label: "Advanced",
        keys: [
            "ACCORDION",
            "ACCORDION_2",
            "ACCORDION_3",
            "ACCORDION_ITEM",
            "ACCORDION_ITEM_2",
            "ACCORDION_ITEM_3",
            "ACCORDION_TRIGGER",
            "ACCORDION_TRIGGER_2",
            "ACCORDION_TRIGGER_3",
            "ACCORDION_CONTENT",
            "ACCORDION_CONTENT_2",
            "ACCORDION_CONTENT_3",
            "COMMAND_PALETTE",
            "COMMAND_PALETTE_INPUT",
            "COMMAND_PALETTE_ITEM",
            "DRAWER",
            "DRAWER_HEADER",
            "DRAWER_FOOTER",
            "STEPPER",
            "STEPPER_STEP",
            "STEPPER_CONNECTOR",
            "SKELETON",
            "CODE_EDITOR",
        ],
    },
    {
        label: "Layout",
        keys: [
            "WIDGET_CHROME",
            "WIDGET",
            "WORKSPACE",
            "LAYOUT_CONTAINER",
            "DASHBOARD_FOOTER",
            "DASHBOARD_FOOTER_2",
            "DASHBOARD_FOOTER_3",
            "SETTINGS_MODAL_SIDEBAR",
            "SETTINGS_MODAL_FOOTER",
        ],
    },
];

const ComponentStyleRow = ({ objectKey, styles }) => {
    if (!styles) return null;

    const colorEntries = COLOR_KEYS.filter((k) => styles[k]).map((k) => ({
        key: k,
        value: styles[k],
    }));

    const nonColorEntries = NON_COLOR_KEYS.filter((k) => styles[k]).map(
        (k) => ({
            key: k,
            value: styles[k],
        })
    );

    return (
        <div className="flex flex-row items-center gap-3 py-1.5">
            <span className="text-[11px] font-mono opacity-70 w-40 shrink-0 truncate">
                {objectKey}
            </span>
            <div className="flex flex-row items-center gap-1">
                {colorEntries.map(({ key, value }) => {
                    if (key.toLowerCase().includes("text")) {
                        return (
                            <div
                                key={key}
                                className="h-5 w-5 rounded-sm flex items-center justify-center bg-black/10"
                                title={`${key}: ${value}`}
                            >
                                <span
                                    className={`text-[8px] font-bold ${value}`}
                                >
                                    Aa
                                </span>
                            </div>
                        );
                    }
                    if (key.toLowerCase().includes("border")) {
                        return (
                            <div
                                key={key}
                                className={`h-5 w-5 rounded-sm border-2 ${value}`}
                                title={`${key}: ${value}`}
                            />
                        );
                    }
                    return (
                        <div
                            key={key}
                            className={`h-5 w-5 rounded-sm ${value}`}
                            title={`${key}: ${value}`}
                        />
                    );
                })}
            </div>
            <div className="flex flex-row items-center gap-2 flex-1 overflow-hidden">
                {nonColorEntries.map(({ key, value }) => (
                    <span
                        key={key}
                        className="text-[10px] opacity-40 whitespace-nowrap"
                        title={key}
                    >
                        {value}
                    </span>
                ))}
            </div>
        </div>
    );
};

// --- Main Component ---

export const ThemeDetail = ({
    themeKey,
    themes,
    currentThemeKey,
    themeVariant,
    onActivate,
    onOpenThemeEditor,
    onDelete = null,
}) => {
    const theme = themeKey && themes ? themes[themeKey] : null;
    const displayTheme = useMemo(() => {
        return theme ? theme[themeVariant] || {} : {};
    }, [theme, themeVariant]);
    const isActive = themeKey === currentThemeKey;

    // Memoize all component styles
    const allStyles = useMemo(() => {
        const result = {};
        Object.values(themeObjects).forEach((key) => {
            result[key] = getStylesForItem(key, displayTheme, {});
        });
        return result;
    }, [displayTheme]);

    if (!theme) return null;

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                {/* Header: Name */}
                <div className="flex flex-row items-center gap-3">
                    <SubHeading
                        title={theme.name || themeKey}
                        padding={false}
                    />
                    {isActive && (
                        <span className="text-xs opacity-40">active</span>
                    )}
                </div>

                {/* Color Palette */}
                <ColorSwatchGrid displayTheme={displayTheme} />

                {/* Component Styles Accordion */}
                <div className="flex flex-col space-y-2">
                    <span className="text-xs font-semibold opacity-50">
                        Component Styles
                    </span>
                    <Accordion2 type="multiple">
                        {COMPONENT_GROUPS.map((group) => {
                            // Only show groups that have valid theme objects
                            const validKeys = group.keys.filter(
                                (k) => themeObjects[k]
                            );
                            if (validKeys.length === 0) return null;

                            return (
                                <Accordion2.Item
                                    key={group.label}
                                    value={group.label}
                                >
                                    <Accordion2.Trigger value={group.label}>
                                        {group.label} ({validKeys.length})
                                    </Accordion2.Trigger>
                                    <Accordion2.Content value={group.label}>
                                        <div className="flex flex-col">
                                            {validKeys.map((k) => {
                                                const objectValue =
                                                    themeObjects[k];
                                                return (
                                                    <ComponentStyleRow
                                                        key={k}
                                                        objectKey={objectValue}
                                                        styles={
                                                            allStyles[
                                                                objectValue
                                                            ]
                                                        }
                                                    />
                                                );
                                            })}
                                        </div>
                                    </Accordion2.Content>
                                </Accordion2.Item>
                            );
                        })}
                    </Accordion2>
                </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex flex-row justify-between px-6 py-4 border-t border-white/10">
                <div>
                    {!isActive && onDelete && (
                        <Button
                            title="Delete"
                            onClick={() => onDelete(themeKey)}
                            size="sm"
                        />
                    )}
                </div>
                <div className="flex flex-row gap-2">
                    {!isActive && (
                        <Button
                            title="Activate"
                            onClick={() => onActivate(themeKey)}
                            size="sm"
                        />
                    )}
                    <Button
                        title="Edit"
                        onClick={onOpenThemeEditor}
                        size="sm"
                    />
                </div>
            </div>
        </div>
    );
};
