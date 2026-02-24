import React, { useState, useEffect } from "react";
import { SelectMenu, InputText, Button } from "@trops/dash-react";
import { tailwindHeightFractions } from "@trops/dash-react";
import { LayoutContainer } from "../../../../Components/Layout";

export const WidgetConfigPanel = ({
    onSave = null,
    onChange,
    item = null,
    disabled = false,
    scrollable = true,
    context, // this is the Workspace context for the item...
}) => {
    const [itemSelected, setItemSelected] = useState(item);

    useEffect(() => {
        if (item !== itemSelected) {
            setItemSelected(() => item);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item]);

    function handleSaveChanges() {
        // setItemSelected(null);
        console.log("SAVE ", itemSelected);
        onSave && onSave(itemSelected);
        // setItemSelected(null);
    }

    function generateFractions() {
        const numerators = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const denominators = [2, 3, 4, 5, 6, 12];
        const fractions = [];
        return numerators.map((v) => {
            return denominators
                .map((vv) => {
                    const fraction = v / vv;
                    if (
                        v % vv > 0 &&
                        v < vv &&
                        fractions.indexOf(fraction) < 0
                    ) {
                        fractions.push(fraction);
                        return (
                            <option
                                key={`${v}-${vv}`}
                                value={`w-${v}/${vv} min-w-${v}/${vv}`}
                            >
                                {v}/{vv}
                            </option>
                        );
                    } else {
                        return null;
                    }
                })
                .filter((p) => p !== null);
        });
    }

    function generateHeightFractions() {
        // get the fraction variants for height
        const fractions = tailwindHeightFractions();
        return fractions.map((fractionObject) => {
            return (
                <option name={fractionObject.name} value={fractionObject.value}>
                    {fractionObject.fraction}
                </option>
            );
        });
    }

    function handleUpdate(e) {
        try {
            let newItem = JSON.parse(JSON.stringify(itemSelected));
            const { name, value } = e.target;
            newItem[name] = value;

            if (value === "false") newItem[name] = false;
            if (value === "true") newItem[name] = true;

            setItemSelected(() => newItem);
            onChange(e, newItem);
        } catch (e) {
            console.log(e);
        }
    }

    function handleTextChangeCustom(e, config) {
        const newItem = JSON.parse(JSON.stringify(itemSelected));
        if ("userPrefs" in itemSelected === false) {
            newItem["userPrefs"] = {};
        }
        newItem["userPrefs"][e.target.name] = e.target.value;
        //setItemSelected(() => newItem);
        onChange(e, newItem);
    }

    /**
     * renderCustomSettings
     * This will use the userConfig key in the Component.dash.js file to render the inputs to the end user
     * The Developer can specify the options in the userConfig that are then translated to inputs
     *
     * @returns
     */
    function renderCustomSettings() {
        if (itemSelected) {
            if ("userConfig" in itemSelected) {
                const userConfig = itemSelected["userConfig"];
                return Object.keys(userConfig).map((key) => {
                    // depending on the type...
                    const configItem = userConfig[key];
                    const { instructions, displayName, required } = configItem;

                    // console.log("widget config", configItem);

                    // get the user prefs for the key
                    const userPrefs = itemSelected.userPrefs;

                    return renderFormItem(
                        displayName,
                        key,
                        instructions,
                        required,
                        userPrefs[key],
                        handleTextChangeCustom,
                        configItem
                    );
                });
            }
        }
        return null;
    }

    function renderFormItem(
        displayName,
        key,
        instructions,
        required,
        value,
        onChange,
        configItem
    ) {
        return (
            <div
                key={`config-item-${key}`}
                className={`rounded flex flex-col p-2 space-y-1`}
            >
                <span className="text-gray-400 font-bold text-sm">
                    {displayName}{" "}
                    {required === true && (
                        <span className="text-red-500">*</span>
                    )}
                </span>
                <div className="text-xs text-gray-400 pb-1">{instructions}</div>
                {configItem["type"] === "text" && (
                    <InputText
                        type="text"
                        name={key}
                        value={value}
                        onChange={(e) => onChange(e, configItem)}
                        textSize="text-sm"
                    />
                )}
                {configItem["type"] === "secret" && (
                    <InputText
                        type="password"
                        name={key}
                        value={value}
                        onChange={(e) => onChange(e, configItem)}
                        textSize="text-sm"
                    />
                )}
                {configItem["type"] === "select" && (
                    <SelectMenu
                        name={key}
                        selectedValue={value}
                        onChange={(e) => onChange(e, configItem)}
                        textSize="text-xs"
                        className="font-normal"
                    >
                        {"options" in configItem &&
                            configItem.options.map((option) => {
                                return (
                                    <option
                                        value={option.value}
                                        className={"text-sm"}
                                    >
                                        {option.displayName}
                                    </option>
                                );
                            })}
                        {"optionsValues" in configItem && (
                            <option>{configItem["optionsValues"]}</option>
                        )}
                    </SelectMenu>
                )}
            </div>
        );
    }

    return (
        itemSelected && (
            <div className="flex flex-col w-full bg-gray-900 p-2 text-2xl rounded text-gray-400 h-full">
                <div className="flex flex-col w-full h-full">
                    <LayoutContainer
                        direction="col"
                        scrollable={scrollable}
                        space={false}
                        grow={true}
                    >
                        {/* <div className="flex flex-col space-y-2 w-full h-full"> */}
                        {renderCustomSettings()}

                        <div className={`rounded flex flex-col p-2`}>
                            <span className="text-gray-400 font-bold text-sm pb-1q">
                                {"Width"}{" "}
                                <span className="text-red-500">*</span>
                            </span>
                            <SelectMenu
                                name={"width"}
                                onChange={handleUpdate}
                                selectedValue={itemSelected.width}
                                textSize="text-sm"
                                className="font-normal"
                            >
                                <option key={"width-full"} value="">
                                    -
                                </option>
                                <option key={"width-full"} value="w-full">
                                    Full
                                </option>
                                {generateFractions()}
                            </SelectMenu>
                        </div>

                        <div className={`rounded flex flex-col p-2`}>
                            <span className=" text-gray-400 font-bold text-sm pb-1">
                                {"Height"}{" "}
                                <span className="text-red-500">*</span>
                            </span>
                            <SelectMenu
                                name={"height"}
                                onChange={handleUpdate}
                                selectedValue={itemSelected.height}
                                textSize="text-sm"
                                className="font-normal"
                            >
                                <option key={"height-full"} value="h-full">
                                    Full Height
                                </option>
                                {generateHeightFractions()}
                                <option key={"height-fit"} value="h-fit">
                                    Fit Content
                                </option>
                            </SelectMenu>
                        </div>

                        <div className={`rounded flex flex-col p-2`}>
                            <span className=" text-gray-400 font-bold text-sm pb-1">
                                {"Layout Direction"}{" "}
                                <span className="text-red-500">*</span>
                            </span>
                            <SelectMenu
                                name={"direction"}
                                onChange={handleUpdate}
                                selectedValue={
                                    itemSelected && itemSelected.direction
                                }
                                textSize="text-sm"
                                className="font-normal"
                            >
                                <option key={"direction-col"} value="col">
                                    Vertical
                                </option>
                                <option key={"direction-row"} value="row">
                                    Horizontal
                                </option>
                            </SelectMenu>
                        </div>

                        <div className={`rounded flex flex-col p-2`}>
                            <span className=" text-gray-400 font-bold text-sm pb-1">
                                {"Scrolling"}{" "}
                                <span className="text-red-500">*</span>
                            </span>
                            <SelectMenu
                                name={"scrollable"}
                                onChange={handleUpdate}
                                selectedValue={itemSelected.scrollable}
                                textSize="text-sm"
                                className="font-normal"
                            >
                                <option key={"scrollable-yes"} value={true}>
                                    Scrollable
                                </option>
                                <option key={"scrollable-no"} value={false}>
                                    Fixed (No Scrolling)
                                </option>
                            </SelectMenu>
                        </div>

                        <div className={`rounded flex flex-col p-2`}>
                            <span className=" text-gray-400 font-bold text-sm">
                                {"Spacing"}{" "}
                                <span className="text-red-500">*</span>
                            </span>
                            <div className="text-xs text-gray-400 pb-2">
                                If this item will be space child items evenly.
                            </div>
                            <SelectMenu
                                name={"space"}
                                onChange={handleUpdate}
                                selectedValue={itemSelected.space}
                                textSize="text-sm"
                                className="font-normal"
                            >
                                <option key={"space-yes"} value={true}>
                                    Allow Spacing
                                </option>
                                <option key={"space-no"} value={false}>
                                    No Spacing
                                </option>
                            </SelectMenu>
                        </div>

                        <div className={`rounded flex flex-col p-2`}>
                            <span className=" text-gray-400 font-bold text-sm">
                                {"Grow"} <span className="text-red-500">*</span>
                            </span>
                            <div className="text-xs text-gray-400 pb-2">
                                If this item will grow to fit the space.
                            </div>
                            <SelectMenu
                                name={"grow"}
                                onChange={handleUpdate}
                                selectedValue={itemSelected.grow}
                                textSize="text-sm"
                                className="font-normal"
                            >
                                <option key={"grow-yes"} value={true}>
                                    Allow Growing
                                </option>
                                <option key={"grow-no"} value={false}>
                                    No Growing Allowed
                                </option>
                            </SelectMenu>
                        </div>

                        {/* <div className="text-xs p-4 break-all rounded bg-gray-800 w-full">
                            <pre>{JSON.stringify(itemSelected, null, 2)}</pre>
                        </div> */}
                    </LayoutContainer>
                </div>

                {onSave !== null && (
                    <div className="flex flex-row w-full">
                        <Button
                            title="Save Changes"
                            onClick={handleSaveChanges}
                            block
                            disabled={disabled}
                        />
                    </div>
                )}
            </div>
        )
    );
};
