import React, { useState, useEffect, useContext } from "react";
import deepEqual from "deep-equal";
import PreviewComponentsPane from "./Pane/PreviewComponentsPane";
import PreviewColorsPane from "./Pane/PreviewColorsPane";
import ThemeMenuPane from "./Pane/ThemeMenuPane";
import AvailableColorsGridPane from "./Pane/AvailableColorsGridPane";
import { ButtonIcon, Panel } from "@trops/dash-react";
import { ThemeContext } from "../../../Context";
import { deepCopy } from "@trops/dash-react";
import { InputText } from "@trops/dash-react";
import { ColorModel } from "../../../Models";
import { LayoutContainer } from "../../../Components/Layout";

export const PanelSelectTheme = ({
    onUpdate,
    theme = null,
    themeKey,
    rawTheme,
}) => {
    const { themeVariant, rawThemes } = useContext(ThemeContext);

    const [themeSelected, setThemeSelected] = useState(theme);
    // const [themeMainColor, setThemeMainColor] = useState(null);
    const [themeNameToEdit, setThemeNameToEdit] = useState(null);
    const [itemSelected, setItemSelected] = useState(null);
    const [itemColorSelected, setItemColorSelected] = useState(null);

    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        if (deepEqual(theme, themeSelected) === false) {
            setThemeSelected(() => theme);
            forceUpdate();
        }
    }, [theme, rawThemes, themeSelected, forceUpdate]);

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

    function handleSelectColorForItem(data) {
        try {
            if (rawTheme) {
                const newTheme = deepCopy(rawTheme);
                const { itemType, styleName, objectType } = itemColorSelected;
                const { colorName, shade } = data;
                if (itemType in newTheme[themeVariant] === false) {
                    newTheme[themeVariant][itemType] = {};
                }
                newTheme[themeVariant][itemType][
                    styleName
                ] = `${objectType}-${colorName}-${shade}`;
                // push the new color change to the theme manager modal
                onUpdate(newTheme, themeKey);
                setItemColorSelected(null);
            }
        } catch (e) {
            console.log("error selecting ", e.message);
        }
    }

    function handleSelectColorForItemTemp(data) {
        try {
            if (rawTheme !== null && rawTheme !== undefined) {
                const newTheme = deepCopy(rawTheme);
                const { itemType, styleName, objectType } = itemColorSelected;
                const { colorName, shade } = data;
                // check if light|dark exists in the raw theme
                if (themeVariant && themeVariant in newTheme === false) {
                    newTheme[themeVariant] = {};
                }
                // now check within the variant type for the item (button, etc...)
                if (itemType && itemType in newTheme[themeVariant] === false) {
                    newTheme[themeVariant][itemType] = {};
                }
                newTheme[themeVariant][itemType][
                    styleName
                ] = `${objectType}-${colorName}-${shade}`;
                console.log("new theme ", newTheme);
                // push the new color change to the theme manager modal
                onUpdate(newTheme, themeKey);
            }
        } catch (e) {
            console.log("error selecting ", e.message);
        }
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

    return (
        <Panel theme={false} backgroundColor={""} padding={false}>
            <div className="flex flex-row w-full h-full space-x-4 overflow-clip">
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
                                    onClick={handleResetStylesForTheme}
                                    icon="trash"
                                    text={"Reset Theme"}
                                />
                            </div>
                            <div className="flex flex-row overflow-clip space-x-1 h-full rounded bg-black w-full p-1">
                                <div className="flex flex-col min-w-1/4 w-1/4 h-full overflow-clip">
                                    <ThemeMenuPane
                                        currentColor={themeNameToEdit}
                                        theme={themeSelected}
                                        onChooseColor={handleSelectColor}
                                        onChooseReplacementColor={
                                            handleSelectReplacementColor
                                        }
                                        onCancel={handleSelectColorCancel}
                                    />
                                </div>
                                {themeSelected && (
                                    <div
                                        className={`flex flex-col ${
                                            itemSelected === null
                                                ? "w-3/4"
                                                : "w-1/2"
                                        }`}
                                    >
                                        <PreviewComponentsPane
                                            theme={themeSelected}
                                            themeVariant={themeVariant}
                                            onClick={handleSelectComponent}
                                        />
                                    </div>
                                )}

                                <div className="flex flex-col w-1/4 min-w-1/4 p-1 space-y-1">
                                    {itemSelected !== null && (
                                        <div
                                            className={`flex flex-col rounded bg-gray-800 space-y-4 overflow-clip ${
                                                itemColorSelected !== null
                                                    ? ""
                                                    : "h-full"
                                            }`}
                                        >
                                            <div className="flex flex-row text-xs uppercase font-bold w-full text-gray-200 bg-gray-900 p-2 rounded-t border-b border-gray-700">
                                                {itemSelected["item"]}
                                            </div>
                                            <LayoutContainer
                                                scrollable={true}
                                                direction="col"
                                                grow={true}
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
                                                    ? "h-fit"
                                                    : "h-full"
                                            }`}
                                        >
                                            <div className="flex flex-row text-xs uppercase font-bold w-full text-gray-200 bg-gray-900 p-2 rounded-t border-b border-gray-700">
                                                Inspector
                                            </div>
                                            {/* <div className="flex flex-col p-2 overflow-y-scroll"></div> */}
                                        </div>
                                    )}
                                    {itemColorSelected !== null && (
                                        <div className="flex flex-col rounded bg-gray-800 space-y-4 overflow-clip h-full">
                                            {/* <div className="flex flex-row text-xs uppercase font-bold w-full text-gray-200 bg-gray-900 p-2 rounded-t border-b border-gray-700">
                                                Available Colors
                                            </div> */}
                                            {/* <LayoutContainer
                                                scrollable={true}
                                                direction="col"
                                                grow={true}
                                            > */}
                                            {/* <div className="flex flex-col overflow-y-scroll"> */}
                                            <AvailableColorsGridPane
                                                colorType={"primary"}
                                                itemType={itemSelected}
                                                onMouseOver={
                                                    handleSelectColorForItemTemp
                                                }
                                                onClick={
                                                    handleSelectColorForItem
                                                }
                                            />
                                            {/* </LayoutContainer> */}
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

export default PanelSelectTheme;
