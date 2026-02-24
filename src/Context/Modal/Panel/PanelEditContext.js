import React, { useState, useEffect, useContext } from "react";
import { Panel, SelectMenu, InputText } from "@trops/dash-react";
import deepEqual from "deep-equal";
import { ThemeContext } from "../../";

export const PanelEditContext = ({ onUpdate, item }) => {
    useContext(ThemeContext);

    const [itemSelected, setItemSelected] = useState(item);
    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    useEffect(() => {
        console.log("panel edit item", item);
        if (deepEqual(item, itemSelected) === false) {
            console.log("COMPARE CHECK DIFFERENT!");
            setItemSelected(() => item);
            forceUpdate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item]);

    function handleSaveChanges(itemData) {
        if (itemData !== null) {
            console.log("handleSaveChanges ", itemData);
            onUpdate(itemData);
            setItemSelected(null);
        }
    }

    // function handleUpdate(e, data) {
    //     console.log("handling update ", e, data);

    //     const workspaceTemp = WorkspaceModel(workspaceSelected);
    //     const newLayout = replaceItemInLayout(
    //         workspaceTemp.layout,
    //         data["id"],
    //         data
    //     );
    //     workspaceTemp.layout = newLayout;

    //     // setWorkspaceSelected(() => workspaceTemp);
    //     // setItemSelected(() => data);
    //     onUpdate(data, workspaceTemp);
    //     forceUpdate();
    // }

    function renderCustomSettings() {
        if (itemSelected) {
            console.log("renderCustomSettings ", itemSelected);

            if ("userConfig" in itemSelected) {
                const userConfig = itemSelected["userConfig"];
                // get the user prefs for the key
                // const layoutItem = LayoutModel(itemSelected, workspaceSelected);
                const userPrefs = itemSelected["userPrefs"] || {};

                console.log("userConfig", userConfig, userPrefs);
                return Object.keys(userConfig).map((key) => {
                    // if (key in userPrefs) {
                    // depending on the type...
                    const configItem = userConfig[key];
                    const { instructions, displayName, required } = configItem;

                    // console.log("widget config", configItem);

                    return renderFormItem(
                        displayName,
                        key,
                        instructions,
                        required,
                        userPrefs[key] || "",
                        handleTextChangeCustom,
                        configItem
                    );
                    //}
                });
            }
        }
        return null;
    }

    function handleTextChangeCustom(e, config) {
        const newItem = JSON.parse(JSON.stringify(itemSelected));
        if ("userPrefs" in itemSelected === false) {
            newItem["userPrefs"] = {};
        }
        newItem["userPrefs"][e.target.name] = e.target.value;
        //setItemSelected(() => newItem);
        onUpdate(newItem);
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
            <Panel padding={false} border={false}>
                <div className={`flex flex-col w-full h-full overflow-clip`}>
                    <div className="flex flex-col w-full h-full overflow-clip">
                        <div className="flex flex-row w-full h-full overflow-clip space-x-4 justify-between">
                            {/* <div className="flex-col h-full rounded font-medium text-gray-400 w-full hidden xl:flex lg:w-1/3">
                        <div className="flex flex-col rounded p-4 py-10 space-y-4">
                            <p
                                className={`text-5xl font-bold ${theme["text-secondary-very-light"]}`}
                            >
                                Settings
                            </p>
                            <p
                                className={`text-xl font-normal ${theme["text-secondary-light"]}`}
                            >
                                Some widgets may have additional configuration settings that you can change here.
                            </p>
                            <p
                                className={`text-xl font-normal ${theme["text-secondary-light"]}`}
                            >
                                You may be required to enter some additional information e.g, API Keys, etc.    
                            </p>
        
                        </div>
                    </div> */}

                            <div
                                className={`flex flex-col w-full h-full rounded p-2 space-y-2`}
                            >
                                <div className="flex flex-col w-full space-y-2 h-full overflow-y-auto">
                                    <div className="flex flex-col w-full">
                                        {/* name given by the user to identify the context */}
                                        <div
                                            key={`config-item-name}`}
                                            className={`rounded flex flex-col p-2 space-y-1`}
                                        >
                                            <span className="text-gray-400 font-bold text-sm">
                                                {"Name"}{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </span>
                                            <div className="text-xs text-gray-400 pb-1">
                                                The display name for the
                                                context.
                                            </div>
                                            <InputText
                                                type="text"
                                                name={"display_name"}
                                                value={itemSelected.name || ""}
                                                onChange={(e) =>
                                                    handleSaveChanges({
                                                        ...itemSelected,
                                                        name: e.target.value,
                                                    })
                                                }
                                                textSize="text-sm"
                                            />
                                        </div>

                                        {renderCustomSettings()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Panel>
        )
    );
};

export default PanelEditContext;
