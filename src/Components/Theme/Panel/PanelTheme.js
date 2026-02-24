import React, { useState, useEffect, useContext } from "react";
import deepEqual from "deep-equal";
import PreviewComponentsPane from "./Pane/PreviewComponentsPane";
import PreviewColorsPane from "./Pane/PreviewColorsPane";
import ThemeMenuPane from "./Pane/ThemeMenuPane";
import ComponentSelectorPane from "./Pane/ComponentSelectorPane";
import TokenColorPickerPane from "./Pane/TokenColorPickerPane";
import NonColorPickerPane from "./Pane/NonColorPickerPane";
import {
    ButtonIcon,
    Panel,
    Panel2,
    Panel3,
    Button,
    Button2,
    Button3,
    ButtonIcon2,
    ButtonIcon3,
    Heading,
    Heading2,
    Heading3,
    SubHeading,
    SubHeading2,
    SubHeading3,
    Paragraph,
    Paragraph2,
    Paragraph3,
    MenuItem,
    MenuItem2,
    MenuItem3,
    Tag,
    Tag2,
    Tag3,
    InputText,
    Card,
    Card2,
    Card3,
    Tabs,
    Tabs2,
    Tabs3,
    Accordion,
    Accordion2,
    Accordion3,
    Alert,
    Alert2,
    Alert3,
    Toast,
    Toast2,
    Toast3,
    ProgressBar,
    ProgressBar2,
    ProgressBar3,
    Toggle,
    Toggle2,
    Toggle3,
    Breadcrumbs,
    Breadcrumbs2,
    Breadcrumbs3,
    StatCard,
    DataList,
    Checkbox,
    Switch,
    ThemeContext,
    getStylesForItem,
} from "@trops/dash-react";
import { deepCopy } from "@trops/dash-react";
import { ColorModel } from "../../../Models";
import { LayoutContainer } from "../../../Components/Layout";

const COLOR_PROPERTIES = new Set([
    "backgroundColor",
    "textColor",
    "borderColor",
    "hoverBackgroundColor",
    "hoverTextColor",
    "hoverBorderColor",
    "focusRingColor",
    "focusBorderColor",
    "activeBackgroundColor",
    "activeTextColor",
    "placeholderTextColor",
]);
const isColorProperty = (name) => COLOR_PROPERTIES.has(name);

// Pencil edit icon SVG
const EditIcon = () => (
    <svg
        className="w-5 h-5 text-gray-400 hover:text-blue-400 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
        />
    </svg>
);

// Tier-based composite configurations
const TIER_COMPOSITES = {
    1: {
        PanelComponent: Panel,
        panelKey: "panel",
        components: [
            {
                key: "heading",
                Component: Heading,
                props: { title: "Heading", padding: false },
            },
            {
                key: "subheading",
                Component: SubHeading,
                props: { title: "Subheading", padding: false },
            },
            {
                key: "paragraph",
                Component: Paragraph,
                props: {
                    text: "The quick brown fox jumps over the lazy dog.",
                    padding: false,
                },
            },
            { key: "button", Component: Button, props: { title: "Button" } },
            {
                key: "button-icon",
                Component: ButtonIcon,
                props: { text: "Button Icon", icon: "pencil" },
            },
            {
                key: "menu-item",
                Component: MenuItem,
                props: { children: "Menu Item" },
            },
            {
                key: "tag",
                Component: Tag,
                props: { text: "Tag" },
            },
            {
                key: "card",
                render: () => (
                    <Card>
                        <Card.Header>Card Title</Card.Header>
                        <Card.Body>
                            <Paragraph
                                text="Card content goes here."
                                padding={false}
                            />
                        </Card.Body>
                    </Card>
                ),
            },
            {
                key: "tabs",
                render: () => (
                    <Tabs defaultValue="tab1">
                        <Tabs.List>
                            <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
                            <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
                        </Tabs.List>
                        <Tabs.Content value="tab1">
                            <Paragraph
                                text="Tab content here."
                                padding={false}
                            />
                        </Tabs.Content>
                        <Tabs.Content value="tab2">
                            <Paragraph
                                text="Second tab content."
                                padding={false}
                            />
                        </Tabs.Content>
                    </Tabs>
                ),
            },
            {
                key: "accordion",
                render: () => (
                    <Accordion type="single" defaultValue={["section1"]}>
                        <Accordion.Item value="section1">
                            <Accordion.Trigger value="section1">
                                Section 1
                            </Accordion.Trigger>
                            <Accordion.Content value="section1">
                                Accordion content for section one.
                            </Accordion.Content>
                        </Accordion.Item>
                        <Accordion.Item value="section2">
                            <Accordion.Trigger value="section2">
                                Section 2
                            </Accordion.Trigger>
                            <Accordion.Content value="section2">
                                Accordion content for section two.
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                ),
            },
            {
                key: "alert",
                Component: Alert,
                props: { title: "Alert", message: "Something to notice." },
            },
            {
                key: "toast",
                Component: Toast,
                props: {
                    title: "Toast",
                    message: "Action completed successfully.",
                },
            },
            {
                key: "progress-bar",
                Component: ProgressBar,
                props: { value: 65, showLabel: true },
            },
            {
                key: "toggle",
                Component: Toggle,
                props: { text: "Toggle option", enabled: true },
            },
            {
                key: "breadcrumbs",
                Component: Breadcrumbs,
                props: {
                    items: [
                        { label: "Home" },
                        { label: "Dashboard" },
                        { label: "Settings" },
                    ],
                },
            },
        ],
    },
    2: {
        PanelComponent: Panel2,
        panelKey: "panel-2",
        components: [
            {
                key: "heading-2",
                Component: Heading2,
                props: { title: "Heading 2", padding: false },
            },
            {
                key: "subheading-2",
                Component: SubHeading2,
                props: { title: "Subheading 2", padding: false },
            },
            {
                key: "paragraph-2",
                Component: Paragraph2,
                props: {
                    text: "The quick brown fox jumps over the lazy dog.",
                    padding: false,
                },
            },
            {
                key: "button-2",
                Component: Button2,
                props: { title: "Button 2" },
            },
            {
                key: "button-icon-2",
                Component: ButtonIcon2,
                props: { text: "Button Icon 2", icon: "pencil" },
            },
            {
                key: "menu-item-2",
                Component: MenuItem2,
                props: { children: "Menu Item 2" },
            },
            {
                key: "tag-2",
                Component: Tag2,
                props: { text: "Tag 2" },
            },
            {
                key: "card-2",
                render: () => (
                    <Card2>
                        <Card2.Header>Card Title</Card2.Header>
                        <Card2.Body>
                            <Paragraph2
                                text="Card content goes here."
                                padding={false}
                            />
                        </Card2.Body>
                    </Card2>
                ),
            },
            {
                key: "tabs-2",
                render: () => (
                    <Tabs2 defaultValue="tab1">
                        <Tabs2.List>
                            <Tabs2.Trigger value="tab1">Tab 1</Tabs2.Trigger>
                            <Tabs2.Trigger value="tab2">Tab 2</Tabs2.Trigger>
                        </Tabs2.List>
                        <Tabs2.Content value="tab1">
                            <Paragraph2
                                text="Tab content here."
                                padding={false}
                            />
                        </Tabs2.Content>
                        <Tabs2.Content value="tab2">
                            <Paragraph2
                                text="Second tab content."
                                padding={false}
                            />
                        </Tabs2.Content>
                    </Tabs2>
                ),
            },
            {
                key: "accordion-2",
                render: () => (
                    <Accordion2 type="single" defaultValue={["section1"]}>
                        <Accordion2.Item value="section1">
                            <Accordion2.Trigger value="section1">
                                Section 1
                            </Accordion2.Trigger>
                            <Accordion2.Content value="section1">
                                Accordion content for section one.
                            </Accordion2.Content>
                        </Accordion2.Item>
                        <Accordion2.Item value="section2">
                            <Accordion2.Trigger value="section2">
                                Section 2
                            </Accordion2.Trigger>
                            <Accordion2.Content value="section2">
                                Accordion content for section two.
                            </Accordion2.Content>
                        </Accordion2.Item>
                    </Accordion2>
                ),
            },
            {
                key: "alert-2",
                Component: Alert2,
                props: { title: "Alert", message: "Something to notice." },
            },
            {
                key: "toast-2",
                Component: Toast2,
                props: {
                    title: "Toast",
                    message: "Action completed successfully.",
                },
            },
            {
                key: "progress-bar-2",
                Component: ProgressBar2,
                props: { value: 65, showLabel: true },
            },
            {
                key: "toggle-2",
                Component: Toggle2,
                props: { text: "Toggle option", enabled: true },
            },
            {
                key: "breadcrumbs-2",
                Component: Breadcrumbs2,
                props: {
                    items: [
                        { label: "Home" },
                        { label: "Dashboard" },
                        { label: "Settings" },
                    ],
                },
            },
        ],
    },
    3: {
        PanelComponent: Panel3,
        panelKey: "panel-3",
        components: [
            {
                key: "heading-3",
                Component: Heading3,
                props: { title: "Heading 3", padding: false },
            },
            {
                key: "subheading-3",
                Component: SubHeading3,
                props: { title: "Subheading 3", padding: false },
            },
            {
                key: "paragraph-3",
                Component: Paragraph3,
                props: {
                    text: "The quick brown fox jumps over the lazy dog.",
                    padding: false,
                },
            },
            {
                key: "button-3",
                Component: Button3,
                props: { title: "Button 3" },
            },
            {
                key: "button-icon-3",
                Component: ButtonIcon3,
                props: { text: "Button Icon 3", icon: "pencil" },
            },
            {
                key: "menu-item-3",
                Component: MenuItem3,
                props: { children: "Menu Item 3" },
            },
            {
                key: "tag-3",
                Component: Tag3,
                props: { text: "Tag 3" },
            },
            {
                key: "card-3",
                render: () => (
                    <Card3>
                        <Card3.Header>Card Title</Card3.Header>
                        <Card3.Body>
                            <Paragraph3
                                text="Card content goes here."
                                padding={false}
                            />
                        </Card3.Body>
                    </Card3>
                ),
            },
            {
                key: "tabs-3",
                render: () => (
                    <Tabs3 defaultValue="tab1">
                        <Tabs3.List>
                            <Tabs3.Trigger value="tab1">Tab 1</Tabs3.Trigger>
                            <Tabs3.Trigger value="tab2">Tab 2</Tabs3.Trigger>
                        </Tabs3.List>
                        <Tabs3.Content value="tab1">
                            <Paragraph3
                                text="Tab content here."
                                padding={false}
                            />
                        </Tabs3.Content>
                        <Tabs3.Content value="tab2">
                            <Paragraph3
                                text="Second tab content."
                                padding={false}
                            />
                        </Tabs3.Content>
                    </Tabs3>
                ),
            },
            {
                key: "accordion-3",
                render: () => (
                    <Accordion3 type="single" defaultValue={["section1"]}>
                        <Accordion3.Item value="section1">
                            <Accordion3.Trigger value="section1">
                                Section 1
                            </Accordion3.Trigger>
                            <Accordion3.Content value="section1">
                                Accordion content for section one.
                            </Accordion3.Content>
                        </Accordion3.Item>
                        <Accordion3.Item value="section2">
                            <Accordion3.Trigger value="section2">
                                Section 2
                            </Accordion3.Trigger>
                            <Accordion3.Content value="section2">
                                Accordion content for section two.
                            </Accordion3.Content>
                        </Accordion3.Item>
                    </Accordion3>
                ),
            },
            {
                key: "alert-3",
                Component: Alert3,
                props: { title: "Alert", message: "Something to notice." },
            },
            {
                key: "toast-3",
                Component: Toast3,
                props: {
                    title: "Toast",
                    message: "Action completed successfully.",
                },
            },
            {
                key: "progress-bar-3",
                Component: ProgressBar3,
                props: { value: 65, showLabel: true },
            },
            {
                key: "toggle-3",
                Component: Toggle3,
                props: { text: "Toggle option", enabled: true },
            },
            {
                key: "breadcrumbs-3",
                Component: Breadcrumbs3,
                props: {
                    items: [
                        { label: "Home" },
                        { label: "Dashboard" },
                        { label: "Settings" },
                    ],
                },
            },
        ],
    },
};

export const PanelTheme = ({ onUpdate, theme = null, themeKey, rawTheme }) => {
    const themeContextValue = useContext(ThemeContext);
    const { themeVariant, rawThemes } = themeContextValue;

    const [themeSelected, setThemeSelected] = useState(theme);
    // const [themeMainColor, setThemeMainColor] = useState(null);
    const [themeNameToEdit, setThemeNameToEdit] = useState(null);
    const [itemSelected, setItemSelected] = useState(null);
    const [itemColorSelected, setItemColorSelected] = useState(null);
    const [leftPanelTab, setLeftPanelTab] = useState("palette");
    const [showPreview, setShowPreview] = useState(false);

    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        if (deepEqual(theme, themeSelected) === false) {
            setThemeSelected(() => theme);
            forceUpdate();
        }
    }, [theme, rawThemes, themeSelected, forceUpdate]);

    // Re-compute itemSelected.styles when the edited theme changes
    useEffect(() => {
        if (itemSelected && themeSelected && themeVariant) {
            const updatedStyles = getStylesForItem(
                itemSelected.item,
                themeSelected[themeVariant]
            );
            setItemSelected((prev) => ({ ...prev, styles: updatedStyles }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [themeSelected, themeVariant]);

    // function handleSelectThemeColor(colorType, variant, objectType) {
    //     const themeToEdit = { colorType, variant, objectType };
    //     setThemeNameToEdit(() => themeToEdit);
    // }

    function handleSelectColor(color) {
        // const c = ColorModel(color);
        // if (color['panelType'] === 'main') {
        //     setThemeMainColor(c);
        // }
        // if (color['panelType'] === 'sub') {
        //     console.log('color selected SUB ', color);
        // }
        console.log("select ", color);
        setThemeNameToEdit(color);
    }

    function handleSelectColorCancel(color) {
        console.log("cancelling ", color);
        const newTheme = deepCopy(rawTheme);

        // // set the MAIN color
        if (themeNameToEdit["panelType"] === "main") {
            newTheme[color["colorType"]] = color["colorName"];
            onUpdate(newTheme, themeKey);
            forceUpdate();
        }

        if (themeNameToEdit["panelType"] === "sub") {
            newTheme[themeVariant][themeNameToEdit["themeClass"]] =
                color["class"];
            onUpdate(newTheme, themeKey);
            forceUpdate();
        }
    }

    function handleSelectReplacementColor(color, colorReplacement) {
        console.log(
            "handle select replacement color ",
            color,
            colorReplacement
        );
        const newTheme = deepCopy(rawTheme);
        const replacementColorModel = ColorModel(colorReplacement);
        // set the MAIN color
        if (themeNameToEdit["panelType"] === "main") {
            // use the type we added on in the main panel, not from the model
            newTheme[color["colorType"]] = replacementColorModel["colorName"];
            onUpdate(newTheme, themeKey);
            // setThemeMainColor(() => null);
            forceUpdate();
        }

        // set the generated value (override)
        if (themeNameToEdit["panelType"] === "sub") {
            // make sure we have the variant in the RAW THEME
            if (themeVariant in newTheme === false) {
                newTheme[themeVariant] = {};
            }
            newTheme[themeVariant][themeNameToEdit["themeClass"]] =
                replacementColorModel["class"];
            onUpdate(newTheme, themeKey);
            // setThemeMainColor(() => null);
            forceUpdate();
        }
    }

    function handleThemeNameChange(e) {
        try {
            if (rawTheme) {
                const newTheme = deepCopy(rawTheme);
                newTheme["name"] = e.target.value;
                // push the new color change to the theme manager modal
                onUpdate(newTheme, themeKey);
            }
        } catch (e) {
            console.log("error selecting ", e.message);
        }
    }

    function handleSelectComponent(data) {
        setItemSelected(() => data);
        setItemColorSelected(null);
    }

    function handleResetStylesForItem(itemType) {
        try {
            if (rawTheme !== null && rawTheme !== undefined) {
                const newTheme = deepCopy(rawTheme);
                // check if light|dark exists in the raw theme
                if (themeVariant && themeVariant in newTheme === false) {
                    newTheme[themeVariant] = {};
                }
                newTheme[themeVariant][itemType] = {};
                // push the new color change to the theme manager modal
                onUpdate(newTheme, themeKey);
            }
        } catch (e) {
            console.log("error selecting ", e.message);
        }
    }

    function handleSelectOverrideForItem(itemType, styleName, value) {
        try {
            if (rawTheme) {
                const newTheme = deepCopy(rawTheme);
                if (!(themeVariant in newTheme)) {
                    newTheme[themeVariant] = {};
                }
                if (!(itemType in newTheme[themeVariant])) {
                    newTheme[themeVariant][itemType] = {};
                }
                newTheme[themeVariant][itemType][styleName] = value;
                onUpdate(newTheme, themeKey);
                setItemColorSelected(null);
            }
        } catch (e) {
            console.log("error selecting override ", e.message);
        }
    }

    function handleResetStylesForTheme(itemType) {
        try {
            if (rawTheme !== null && rawTheme !== undefined) {
                const newTheme = deepCopy(rawTheme);

                // remove all of the custom colors for each variant...
                newTheme["dark"] = {};
                newTheme["light"] = {};

                // push the new color change to the theme manager modal
                onUpdate(newTheme, themeKey);
            }
        } catch (e) {
            console.log("error selecting ", e.message);
        }
    }

    function renderComponentRow(key, content) {
        const isSelected = itemSelected?.item === key;
        return (
            <div
                key={key}
                className={`flex flex-row items-center space-x-2 cursor-pointer transition-all rounded p-1 ${
                    isSelected
                        ? "ring-2 ring-blue-400"
                        : "hover:ring-1 hover:ring-gray-600"
                }`}
                onClick={(e) => {
                    e.stopPropagation();
                    const clickStyles = getStylesForItem(
                        key,
                        themeSelected[themeVariant]
                    );
                    handleSelectComponent({
                        item: key,
                        styles: clickStyles,
                    });
                }}
            >
                <div className="pt-1 flex-shrink-0">
                    <EditIcon />
                </div>
                <div className="flex-1 min-w-0">{content}</div>
            </div>
        );
    }

    function renderAllTiers() {
        if (!themeSelected) return null;
        const themeData = themeSelected[themeVariant];

        const tierSections = [1, 2, 3].map((tier) => {
            const { PanelComponent, panelKey, components } =
                TIER_COMPOSITES[tier];
            const panelStyles = getStylesForItem(panelKey, themeData);
            const isPanelSelected = itemSelected?.item === panelKey;

            return (
                <div key={tier} className="flex flex-col space-y-2">
                    <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                        Level {tier}
                    </div>
                    <div
                        className={`cursor-pointer rounded transition-all ${
                            isPanelSelected
                                ? "ring-2 ring-blue-400"
                                : "hover:ring-1 hover:ring-gray-600"
                        }`}
                        onClick={() => {
                            const clickStyles = getStylesForItem(
                                panelKey,
                                themeData
                            );
                            handleSelectComponent({
                                item: panelKey,
                                styles: clickStyles,
                            });
                        }}
                    >
                        <PanelComponent
                            {...panelStyles}
                            scrollable={false}
                            className="rounded"
                            height=""
                        >
                            <PanelComponent.Body>
                                <div className="flex flex-col space-y-3 p-2">
                                    {components.map((comp) => {
                                        if (comp.render) {
                                            return renderComponentRow(
                                                comp.key,
                                                comp.render()
                                            );
                                        }
                                        const {
                                            children: childContent,
                                            ...restProps
                                        } = comp.props;
                                        const renderedComponent =
                                            childContent !== undefined ? (
                                                <comp.Component {...restProps}>
                                                    {childContent}
                                                </comp.Component>
                                            ) : (
                                                <comp.Component
                                                    {...restProps}
                                                />
                                            );
                                        return renderComponentRow(
                                            comp.key,
                                            renderedComponent
                                        );
                                    })}
                                </div>
                            </PanelComponent.Body>
                        </PanelComponent>
                    </div>
                </div>
            );
        });

        // Non-tiered: Forms & Inputs
        const formsSection = (
            <div className="flex flex-col space-y-2">
                <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                    Forms & Inputs
                </div>
                <Panel
                    {...getStylesForItem("panel", themeData)}
                    scrollable={false}
                    className="rounded"
                    height=""
                >
                    <Panel.Body>
                        <div className="flex flex-col space-y-3 p-2">
                            {renderComponentRow(
                                "input-text",
                                <InputText
                                    placeholder="Enter text..."
                                    bgColor=""
                                    textColor=""
                                    hasBorder={true}
                                />
                            )}
                            {renderComponentRow(
                                "checkbox",
                                <Checkbox label="Enable notifications" />
                            )}
                            {renderComponentRow(
                                "switch",
                                <Switch label="Dark mode" />
                            )}
                        </div>
                    </Panel.Body>
                </Panel>
            </div>
        );

        // Non-tiered: Data & Stats
        const dataSection = (
            <div className="flex flex-col space-y-2">
                <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                    Data & Stats
                </div>
                <Panel
                    {...getStylesForItem("panel", themeData)}
                    scrollable={false}
                    className="rounded"
                    height=""
                >
                    <Panel.Body>
                        <div className="flex flex-col space-y-3 p-2">
                            {renderComponentRow(
                                "stat-card",
                                <StatCard
                                    label="Revenue"
                                    value="$12,450"
                                    change="+12.5%"
                                    trend="up"
                                />
                            )}
                            {renderComponentRow(
                                "data-list",
                                <DataList>
                                    <DataList.Item
                                        label="Name"
                                        value="John Doe"
                                    />
                                    <DataList.Item
                                        label="Email"
                                        value="john@example.com"
                                    />
                                    <DataList.Item label="Role" value="Admin" />
                                </DataList>
                            )}
                        </div>
                    </Panel.Body>
                </Panel>
            </div>
        );

        return (
            <>
                {tierSections}
                {formsSection}
                {dataSection}
            </>
        );
    }

    return (
        <Panel theme={false} backgroundColor={""} padding={false}>
            <div className="flex flex-row w-full h-full space-x-2 overflow-clip">
                <div className="flex flex-row h-full rounded space-x-2 w-full">
                    <div className="flex flex-row w-full space-x-2">
                        <div
                            className={`flex flex-col h-full rounded w-full overflow-clip space-y-2`}
                        >
                            <div className="flex flex-row space-x-2">
                                {themeSelected !== null && (
                                    <InputText
                                        name="name"
                                        padding={"p-4"}
                                        value={themeSelected.name}
                                        onChange={handleThemeNameChange}
                                        textSize={"text-lg"}
                                        placeholder="Colorama ;-)"
                                        bgColor={"bg-gray-900"}
                                        textColor={"text-gray-400"}
                                        hasBorder={false}
                                    />
                                )}
                                <ButtonIcon
                                    onClick={() =>
                                        setShowPreview((prev) => !prev)
                                    }
                                    icon="eye"
                                    text={showPreview ? "Editor" : "Preview"}
                                />
                                <ButtonIcon
                                    onClick={handleResetStylesForTheme}
                                    icon="trash"
                                    text={"Reset Theme"}
                                />
                            </div>
                            <div className="flex flex-row overflow-clip space-x-1 h-full rounded bg-black w-full p-1">
                                <div className="flex flex-col h-full w-1/4 min-w-[25%] max-w-[25%] overflow-clip">
                                    <div className="flex flex-col h-full space-y-2 border-r border-gray-700 p-2 w-full">
                                        <Tabs3
                                            value={leftPanelTab}
                                            onValueChange={setLeftPanelTab}
                                        >
                                            <Tabs3.List className="w-full">
                                                <Tabs3.Trigger value="palette">
                                                    Colors
                                                </Tabs3.Trigger>
                                                <Tabs3.Trigger value="components">
                                                    Components
                                                </Tabs3.Trigger>
                                            </Tabs3.List>
                                        </Tabs3>
                                        {leftPanelTab === "palette" && (
                                            <ThemeMenuPane
                                                currentColor={themeNameToEdit}
                                                theme={themeSelected}
                                                onChooseColor={
                                                    handleSelectColor
                                                }
                                                onChooseReplacementColor={
                                                    handleSelectReplacementColor
                                                }
                                                onCancel={
                                                    handleSelectColorCancel
                                                }
                                            />
                                        )}
                                        {leftPanelTab === "components" && (
                                            <ComponentSelectorPane
                                                theme={themeSelected}
                                                themeVariant={themeVariant}
                                                rawTheme={rawTheme}
                                                selectedComponent={
                                                    itemSelected
                                                        ? itemSelected["item"]
                                                        : null
                                                }
                                                onSelectComponent={
                                                    handleSelectComponent
                                                }
                                            />
                                        )}
                                    </div>
                                </div>
                                {themeSelected && (
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <ThemeContext.Provider
                                            value={{
                                                ...themeContextValue,
                                                currentTheme:
                                                    themeSelected?.[
                                                        themeVariant
                                                    ] ||
                                                    themeContextValue.currentTheme,
                                            }}
                                        >
                                            {showPreview ? (
                                                <PreviewComponentsPane
                                                    theme={themeSelected}
                                                    themeVariant={themeVariant}
                                                    onClick={
                                                        handleSelectComponent
                                                    }
                                                    selectedComponent={
                                                        itemSelected?.item ||
                                                        null
                                                    }
                                                />
                                            ) : (
                                                <LayoutContainer
                                                    direction="col"
                                                    scrollable={true}
                                                >
                                                    <div className="flex flex-col p-4 space-y-6">
                                                        {renderAllTiers()}
                                                    </div>
                                                </LayoutContainer>
                                            )}
                                        </ThemeContext.Provider>
                                    </div>
                                )}

                                <div className="flex flex-col w-1/4 min-w-[25%] max-w-[25%] shrink-0 p-1 space-y-1">
                                    {itemSelected !== null && (
                                        <div
                                            className={`flex flex-col rounded bg-gray-800 space-y-4 overflow-clip ${
                                                itemColorSelected !== null
                                                    ? "h-1/2"
                                                    : "h-full"
                                            }`}
                                        >
                                            <div className="flex flex-col bg-gray-900 p-3 rounded-t border-b border-gray-700 border-l-2 border-l-blue-400">
                                                <span className="text-sm font-bold text-blue-300">
                                                    {itemSelected["item"]}
                                                </span>
                                                <span className="text-xs uppercase text-gray-500 tracking-wider">
                                                    Properties
                                                </span>
                                            </div>
                                            <LayoutContainer
                                                scrollable={true}
                                                direction="col"
                                            >
                                                <PreviewColorsPane
                                                    styles={
                                                        itemSelected["styles"]
                                                    }
                                                    theme={themeSelected}
                                                    itemType={
                                                        itemSelected["item"]
                                                    }
                                                    onClickItem={(i) => {
                                                        setItemColorSelected(i);
                                                        forceUpdate();
                                                    }}
                                                    onResetStyles={
                                                        handleResetStylesForItem
                                                    }
                                                />
                                            </LayoutContainer>
                                        </div>
                                    )}
                                    {itemSelected === null && (
                                        <div
                                            className={`flex flex-col rounded bg-gray-800 space-y-4 overflow-clip ${
                                                itemColorSelected !== null
                                                    ? "h-1/2"
                                                    : "h-full"
                                            }`}
                                        >
                                            <div className="flex flex-col bg-gray-900 p-3 rounded-t border-b border-gray-700 border-l-2 border-l-gray-600">
                                                <span className="text-sm font-bold text-gray-300">
                                                    Inspector
                                                </span>
                                                <span className="text-xs uppercase text-gray-500 tracking-wider">
                                                    Select a component to edit
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {itemColorSelected !== null && (
                                        <div className="flex flex-col rounded bg-gray-800 space-y-4 overflow-clip h-1/2">
                                            <div className="flex flex-col bg-gray-900 p-3 rounded-t border-b border-gray-700 border-l-2 border-l-yellow-500">
                                                <span className="text-sm font-bold text-yellow-300">
                                                    {isColorProperty(
                                                        itemColorSelected.styleName
                                                    )
                                                        ? "Theme Tokens"
                                                        : "Values"}
                                                </span>
                                                <span className="text-xs text-gray-500 tracking-wider">
                                                    {
                                                        itemColorSelected.styleName
                                                    }
                                                </span>
                                            </div>
                                            <LayoutContainer
                                                scrollable={true}
                                                direction="col"
                                            >
                                                {isColorProperty(
                                                    itemColorSelected.styleName
                                                ) ? (
                                                    <TokenColorPickerPane
                                                        theme={themeSelected}
                                                        themeVariant={
                                                            themeVariant
                                                        }
                                                        styleName={
                                                            itemColorSelected.styleName
                                                        }
                                                        currentValue={
                                                            rawTheme?.[
                                                                themeVariant
                                                            ]?.[
                                                                itemColorSelected
                                                                    .itemType
                                                            ]?.[
                                                                itemColorSelected
                                                                    .styleName
                                                            ] ||
                                                            itemSelected
                                                                ?.styles?.[
                                                                itemColorSelected
                                                                    .styleName
                                                            ] ||
                                                            null
                                                        }
                                                        onSelect={(value) =>
                                                            handleSelectOverrideForItem(
                                                                itemColorSelected.itemType,
                                                                itemColorSelected.styleName,
                                                                value
                                                            )
                                                        }
                                                        onPreview={(value) => {
                                                            try {
                                                                if (rawTheme) {
                                                                    const newTheme =
                                                                        deepCopy(
                                                                            rawTheme
                                                                        );
                                                                    if (
                                                                        !(
                                                                            themeVariant in
                                                                            newTheme
                                                                        )
                                                                    )
                                                                        newTheme[
                                                                            themeVariant
                                                                        ] = {};
                                                                    if (
                                                                        !(
                                                                            itemColorSelected.itemType in
                                                                            newTheme[
                                                                                themeVariant
                                                                            ]
                                                                        )
                                                                    )
                                                                        newTheme[
                                                                            themeVariant
                                                                        ][
                                                                            itemColorSelected.itemType
                                                                        ] = {};
                                                                    newTheme[
                                                                        themeVariant
                                                                    ][
                                                                        itemColorSelected.itemType
                                                                    ][
                                                                        itemColorSelected.styleName
                                                                    ] = value;
                                                                    onUpdate(
                                                                        newTheme,
                                                                        themeKey
                                                                    );
                                                                }
                                                            } catch (e) {
                                                                console.log(
                                                                    "preview error",
                                                                    e.message
                                                                );
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <NonColorPickerPane
                                                        styleName={
                                                            itemColorSelected.styleName
                                                        }
                                                        currentValue={
                                                            rawTheme?.[
                                                                themeVariant
                                                            ]?.[
                                                                itemColorSelected
                                                                    .itemType
                                                            ]?.[
                                                                itemColorSelected
                                                                    .styleName
                                                            ] ||
                                                            itemSelected
                                                                ?.styles?.[
                                                                itemColorSelected
                                                                    .styleName
                                                            ] ||
                                                            null
                                                        }
                                                        onSelect={(value) =>
                                                            handleSelectOverrideForItem(
                                                                itemColorSelected.itemType,
                                                                itemColorSelected.styleName,
                                                                value
                                                            )
                                                        }
                                                    />
                                                )}
                                            </LayoutContainer>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Panel>
    );
};
