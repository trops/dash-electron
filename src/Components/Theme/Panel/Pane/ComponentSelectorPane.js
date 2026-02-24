import React, { useState } from "react";
import { themeObjects, getStylesForItem } from "@trops/dash-react";
import { LayoutContainer } from "../../../../Components/Layout";

const COMPONENT_GROUPS = {
    Typography: [
        themeObjects.HEADING,
        themeObjects.HEADING_2,
        themeObjects.HEADING_3,
        themeObjects.SUBHEADING,
        themeObjects.SUBHEADING_2,
        themeObjects.SUBHEADING_3,
        themeObjects.PARAGRAPH,
        themeObjects.PARAGRAPH_2,
        themeObjects.PARAGRAPH_3,
    ],
    Buttons: [
        themeObjects.BUTTON,
        themeObjects.BUTTON_2,
        themeObjects.BUTTON_3,
        themeObjects.BUTTON_ICON,
        themeObjects.BUTTON_ICON_2,
        themeObjects.BUTTON_ICON_3,
    ],
    Panels: [
        themeObjects.PANEL,
        themeObjects.PANEL_2,
        themeObjects.PANEL_3,
        themeObjects.PANEL_HEADER,
        themeObjects.PANEL_HEADER_2,
        themeObjects.PANEL_HEADER_3,
        themeObjects.PANEL_FOOTER,
        themeObjects.PANEL_FOOTER_2,
        themeObjects.PANEL_FOOTER_3,
    ],
    "Dash Panels": [
        themeObjects.DASH_PANEL,
        themeObjects.DASH_PANEL_2,
        themeObjects.DASH_PANEL_3,
        themeObjects.DASH_PANEL_HEADER,
        themeObjects.DASH_PANEL_HEADER_2,
        themeObjects.DASH_PANEL_HEADER_3,
        themeObjects.DASH_PANEL_FOOTER,
        themeObjects.DASH_PANEL_FOOTER_2,
        themeObjects.DASH_PANEL_FOOTER_3,
    ],
    Cards: [themeObjects.CARD, themeObjects.CARD_2, themeObjects.CARD_3],
    "Menu & Navigation": [
        themeObjects.MENU_ITEM,
        themeObjects.MENU_ITEM_2,
        themeObjects.MENU_ITEM_3,
        themeObjects.SIDEBAR,
        themeObjects.SIDEBAR_ITEM,
        themeObjects.NAVBAR,
        themeObjects.TABBED_NAVBAR,
        themeObjects.BREADCRUMBS,
        themeObjects.BREADCRUMBS_2,
        themeObjects.BREADCRUMBS_3,
    ],
    Tags: [themeObjects.TAG, themeObjects.TAG_2, themeObjects.TAG_3],
    Forms: [
        themeObjects.INPUT_TEXT,
        themeObjects.SELECT_MENU,
        themeObjects.FORM_LABEL,
        themeObjects.TEXTAREA,
        themeObjects.CHECKBOX,
        themeObjects.RADIO,
        themeObjects.SWITCH,
        themeObjects.SLIDER,
        themeObjects.SEARCH_INPUT,
    ],
    Tabs: [
        themeObjects.TABS,
        themeObjects.TABS_2,
        themeObjects.TABS_3,
        themeObjects.TABS_LIST,
        themeObjects.TABS_LIST_2,
        themeObjects.TABS_LIST_3,
        themeObjects.TABS_TRIGGER,
        themeObjects.TABS_TRIGGER_2,
        themeObjects.TABS_TRIGGER_3,
        themeObjects.TABS_CONTENT,
        themeObjects.TABS_CONTENT_2,
        themeObjects.TABS_CONTENT_3,
    ],
    Accordion: [
        themeObjects.ACCORDION,
        themeObjects.ACCORDION_ITEM,
        themeObjects.ACCORDION_ITEM_2,
        themeObjects.ACCORDION_ITEM_3,
        themeObjects.ACCORDION_TRIGGER,
        themeObjects.ACCORDION_TRIGGER_2,
        themeObjects.ACCORDION_TRIGGER_3,
        themeObjects.ACCORDION_CONTENT,
        themeObjects.ACCORDION_CONTENT_2,
        themeObjects.ACCORDION_CONTENT_3,
    ],
    Feedback: [
        themeObjects.ALERT,
        themeObjects.ALERT_2,
        themeObjects.ALERT_3,
        themeObjects.ALERT_BANNER,
        themeObjects.TOAST,
        themeObjects.TOAST_2,
        themeObjects.TOAST_3,
        themeObjects.PROGRESS_BAR,
        themeObjects.PROGRESS_BAR_2,
        themeObjects.PROGRESS_BAR_3,
    ],
    "Tables & Data": [
        themeObjects.TABLE,
        themeObjects.TABLE_2,
        themeObjects.TABLE_3,
        themeObjects.DATA_LIST,
        themeObjects.DATA_LIST_ITEM,
        themeObjects.STAT_CARD,
        themeObjects.STAT_CARD_LABEL,
        themeObjects.STAT_CARD_VALUE,
        themeObjects.STAT_CARD_CHANGE,
    ],
    Toggles: [
        themeObjects.TOGGLE,
        themeObjects.TOGGLE_2,
        themeObjects.TOGGLE_3,
    ],
    Overlays: [
        themeObjects.DRAWER,
        themeObjects.DRAWER_HEADER,
        themeObjects.DRAWER_FOOTER,
        themeObjects.TOOLTIP,
        themeObjects.COMMAND_PALETTE,
        themeObjects.COMMAND_PALETTE_INPUT,
        themeObjects.COMMAND_PALETTE_ITEM,
    ],
    Layout: [
        themeObjects.LAYOUT_CONTAINER,
        themeObjects.WIDGET,
        themeObjects.WORKSPACE,
        themeObjects.WIDGET_CHROME,
        themeObjects.DASHBOARD_FOOTER,
        themeObjects.DASHBOARD_FOOTER_2,
        themeObjects.DASHBOARD_FOOTER_3,
        themeObjects.SETTINGS_MODAL_SIDEBAR,
        themeObjects.SETTINGS_MODAL_FOOTER,
        themeObjects.EMPTY_STATE,
        themeObjects.SKELETON,
        themeObjects.STEPPER,
        themeObjects.STEPPER_STEP,
        themeObjects.STEPPER_CONNECTOR,
    ],
    Other: [themeObjects.CODE_EDITOR],
};

const ComponentSelectorPane = ({
    theme,
    themeVariant,
    rawTheme,
    selectedComponent,
    onSelectComponent,
}) => {
    const [collapsedGroups, setCollapsedGroups] = useState({});

    function toggleGroup(groupName) {
        setCollapsedGroups((prev) => ({
            ...prev,
            [groupName]: !prev[groupName],
        }));
    }

    function hasOverrides(itemKey) {
        try {
            const overrides =
                rawTheme && rawTheme[themeVariant]
                    ? rawTheme[themeVariant][itemKey]
                    : null;
            return (
                overrides !== null &&
                overrides !== undefined &&
                Object.keys(overrides).length > 0
            );
        } catch (e) {
            return false;
        }
    }

    function handleSelectItem(itemKey) {
        const styles = getStylesForItem(itemKey, theme[themeVariant]);
        onSelectComponent({ item: itemKey, styles });
    }

    return (
        <LayoutContainer direction="col" scrollable={true}>
            <div className="flex flex-col space-y-1 w-full">
                {Object.keys(COMPONENT_GROUPS).map((groupName) => {
                    const items = COMPONENT_GROUPS[groupName];
                    const isCollapsed = collapsedGroups[groupName] === true;
                    const groupHasOverrides = items.some((item) =>
                        hasOverrides(item)
                    );

                    return (
                        <div
                            key={`group-${groupName}`}
                            className="flex flex-col w-full"
                        >
                            <div
                                className="flex flex-row items-center justify-between text-xs uppercase font-bold text-gray-200 bg-gray-900 p-2 rounded cursor-pointer hover:bg-gray-800 border-b border-gray-700"
                                onClick={() => toggleGroup(groupName)}
                            >
                                <div className="flex flex-row items-center space-x-2">
                                    <span className="text-gray-500 text-xs">
                                        {isCollapsed ? "+" : "-"}
                                    </span>
                                    <span>{groupName}</span>
                                </div>
                                {groupHasOverrides && (
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                )}
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col">
                                    {items.map((itemKey) => {
                                        const isSelected =
                                            selectedComponent === itemKey;
                                        const itemHasOverrides =
                                            hasOverrides(itemKey);

                                        return (
                                            <div
                                                key={`item-${itemKey}`}
                                                className={`flex flex-row items-center justify-between px-3 py-1.5 cursor-pointer text-sm ${
                                                    isSelected
                                                        ? "bg-blue-900 text-blue-200"
                                                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                                                }`}
                                                onClick={() =>
                                                    handleSelectItem(itemKey)
                                                }
                                            >
                                                <span className="truncate">
                                                    {itemKey}
                                                </span>
                                                {itemHasOverrides && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 ml-2" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </LayoutContainer>
    );
};

export default ComponentSelectorPane;
