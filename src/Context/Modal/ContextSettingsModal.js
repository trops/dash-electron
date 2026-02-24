/**
 * ContextSettingsModal.js
 *
 * - Save the settings for the dashboard
 * - Store the settings in the global settings file?
 * - Allow the user to select a context to power their Widget
 * - Get the list of contexts that are stored globally
 * - Select the context to use for the Widget
 *
 */
import React, { useContext, useEffect } from "react";
import { Panel, Modal, Button, ButtonIcon } from "@trops/dash-react";
import { AppContext, ThemeContext } from "..";
import { DashboardModel } from "../../Models";
import PanelEditContext from "./Panel/PanelEditContext";
import { ContextModel } from "../../Models/ContextModel";

export const ContextSettingsModal = ({
    workspace,
    widget,
    open,
    setIsOpen,
    onSave,
    contextComponent = null,
    _contextConfig = null,
}) => {
    const { dashApi, appId } = useContext(AppContext);
    useContext(ThemeContext);
    const [globalContexts, setGlobalContexts] = React.useState(null);
    const [isLoadingGlobalContexts, setIsLoadingGlobalContexts] =
        React.useState(false);

    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    // this is the component
    const [contextComponentSelected, setContextComponentSelected] =
        React.useState(contextComponent || null);
    // this is the context config by the user that is stored in the application
    const [contextConfigSelected, setContextConfigSelected] = React.useState(
        _contextConfig || null
    );

    useEffect(() => {
        console.log(
            "use effect for ContextSettingsModal, workspace: ",
            workspace,
            globalContexts
        );
        if (globalContexts === null && isLoadingGlobalContexts === false)
            getGlobalContexts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function getGlobalContexts() {
        try {
            // using the electron/web api, fetch all of the stored contexts
            // the user has created and stored
            if (dashApi && dashApi.api) {
                // set the loader to true so we can show a spinner
                setIsLoadingGlobalContexts(true);
                dashApi.api.context
                    .listContexts(appId)
                    .then((contexts) => {
                        // we really want to store the contexts in an object with the key being the context TYPE
                        // and the value being another object with the context ID as the key and the contextModel object
                        // as the value
                        const contextMap = {};
                        Object.keys(contexts).forEach((contextId) => {
                            const contextModel = contexts[contextId];
                            // we want to store the context in a map with the componentName as the key
                            if (
                                contextModel.componentName in contextMap ===
                                false
                            ) {
                                contextMap[contexts[contextId].componentName] =
                                    {};
                            }
                            // now we can store the contextModel in the map
                            contextMap[contexts[contextId].componentName][
                                contextId
                            ] = contextModel;
                        });
                        setGlobalContexts(contextMap);
                    })
                    .catch((error) => {
                        console.error(
                            "Error fetching global contexts: ",
                            error
                        );
                        setGlobalContexts([]);
                    });
            }
        } catch (e) {
            console.error("Error getting global contexts: ", e);
        }
        return [];
    }

    /**
     * get the saved contexts for the workspace
     * - globally?
     * - per workspace?
     */
    function renderRequiredContexts(workspace) {
        try {
            console.log(
                "renderRequiredContexts for workspace: ",
                workspace,
                globalContexts,
                widget
            );
            if (workspace && globalContexts) {
                const dashboard = new DashboardModel(workspace);
                const requiredContexts = dashboard.getRequiredContexts();
                console.log(
                    "required contexts for workspace ",
                    workspace,
                    requiredContexts
                );
                if (requiredContexts && requiredContexts.length > 0) {
                    return requiredContexts
                        .filter((c) => {
                            // if we have a widget we should only show the compatible contexts for that widget
                            if (widget && widget.contexts) {
                                return widget.contexts.includes(c);
                            } else {
                                return true;
                            }
                        })
                        .map((context, index) => {
                            return (
                                <div
                                    key={index}
                                    className="flex flex-col p-2 cursor-pointer border-b border-gray-700"
                                    onClick={() =>
                                        handleSelectContextComponent({
                                            componentName: context,
                                        })
                                    }
                                >
                                    <span className="text-sm text-gray-300">
                                        {context}
                                    </span>
                                </div>
                            );
                        });
                }
            }
        } catch (e) {
            console.error("Error getting saved contexts for workspace: ", e);
        }
        return [];
    }

    function renderGlobalContextComponents(workspace) {
        try {
            if (workspace && globalContexts !== null) {
                const dashboard = new DashboardModel(workspace);
                const requiredContexts = dashboard.getRequiredContexts();
                console.log(
                    "required contexts for workspace ",
                    workspace,
                    requiredContexts,
                    globalContexts,
                    widget
                );
                if (globalContexts && Object.keys(globalContexts).length > 0) {
                    return Object.keys(globalContexts)
                        .filter((c) => {
                            if (
                                requiredContexts &&
                                requiredContexts.length > 0
                            ) {
                                console.log(
                                    "filtering global contexts: ",
                                    c,
                                    globalContexts[c],
                                    requiredContexts
                                );
                                // we want to filter the global contexts based on the required contexts for the workspace
                                return requiredContexts.includes(c);
                            } else {
                                // if there are no required contexts, we want to show all global contexts
                                return true;
                            }
                        })
                        .filter((c) => {
                            // if we have a widget we should only show the compatible contexts for that widget
                            if (widget && widget.contexts) {
                                return widget.contexts.includes(c);
                            } else {
                                return true;
                            }
                        })
                        .map((context, index) => {
                            console.log(
                                "context: ",
                                context,
                                globalContexts[context]
                            );

                            // We want to show a menu of the component names for the contexts globally
                            // and then filter them based on the required contexts for the workspace
                            const isSelected =
                                contextComponentSelected !== null &&
                                contextComponentSelected === context;
                            return (
                                <div
                                    key={index}
                                    className={`flex flex-col rounded p-4 cursor-pointer ${
                                        isSelected === true && "bg-gray-900"
                                    } hover:bg-gray-900`}
                                    onClick={() =>
                                        handleSelectContextComponent(context)
                                    }
                                >
                                    <span className="font-bold text-base text-gray-300">
                                        {context}
                                    </span>
                                </div>
                            );
                        });
                }
            }
        } catch (e) {
            console.error("Error getting saved contexts for workspace: ", e);
        }
        return [];
    }

    /**
     * the saved contexts for the entire application
     * - we HAVE to show the required contexts for the application, and then we will show the global saved contexts
     * - if there are any saved yet in the second column
     */
    function renderGlobalContexts(workspace) {
        try {
            if (workspace && globalContexts !== null) {
                const dashboard = new DashboardModel(workspace);
                const requiredContexts = dashboard.getRequiredContexts();

                console.log(
                    "renderGlobalContexts for workspace ",
                    workspace,
                    requiredContexts,
                    globalContexts,
                    widget
                );
                if (
                    globalContexts &&
                    Object.keys(globalContexts).length > 0 &&
                    contextComponentSelected !== null
                ) {
                    return Object.keys(globalContexts)
                        .filter((c) => {
                            console.log(
                                "filtering global contexts: ",
                                c,
                                contextComponentSelected
                            );
                            // we want to filter the global contexts based on the required contexts for the workspace
                            return c === contextComponentSelected;
                        })
                        .map((context, index) => {
                            console.log(
                                "context: ",
                                context,
                                globalContexts[context]
                            );

                            // We want to show a menu of the component names for the contexts globally
                            // and then filter them based on the required contexts for the workspace
                            const contextModels = globalContexts[context];
                            return Object.keys(contextModels).map(
                                (contextId) => {
                                    // we want to show the contextModel in a card format
                                    const contextModel =
                                        contextModels[contextId];
                                    return (
                                        <div
                                            key={index}
                                            className="flex flex-col p-2 cursor-pointer border-b border-gray-700"
                                            onClick={() =>
                                                handleSelectContextConfig(
                                                    contextId
                                                )
                                            }
                                        >
                                            <span className="text-sm text-gray-300">
                                                {contextModel.name}
                                            </span>
                                            <span className="text-xs text-gray-600">
                                                {contextId}
                                            </span>
                                        </div>
                                    );
                                }
                            );
                        });
                } else {
                    return null;
                }
            }
        } catch (e) {
            console.error("Error getting saved contexts for workspace: ", e);
        }
        return [];
    }

    function handleSelectContextComponent(context) {
        console.log("Selected context: ", context);
        // now that we have the config for the context, we have to display the form, and then
        // populate the values from the context selected from the global contexts
        if (context) {
            setContextComponentSelected(context);
            // reset the context config to null so we can select a new one
            setContextConfigSelected(null);
            // now I think we have to merge the configuration questions
            // and the values stored in the workspace
        }
    }

    function handleSelectContextConfig(contextId) {
        console.log("Selected context: ", contextComponentSelected, contextId);
        // const contextConfig = ComponentManager.config(context.componentName);
        // const c = globalContexts[context.componentName][context];
        // now that we have the config for the context, we have to display the form, and then
        // populate the values from the context selected from the global contexts

        setContextConfigSelected(contextId);
        forceUpdate();
    }

    function handleCreateNewContextConfig() {
        // this will create a new context for the selected component
        const newContext = new ContextModel(
            {
                componentName: widget
                    ? widget.componentName
                    : contextComponentSelected.componentName,
                name: `New ${contextComponentSelected.componentName} Context`,
                description: `A new context for ${contextComponentSelected.componentName}`,
                // we can set default values here if needed
                // for example, if the context has a configuration with default values
                // we can set them here
            },
            workspace
        );

        setContextConfigSelected(newContext.id);
    }

    function getContext() {
        return new ContextModel(
            globalContexts[contextComponentSelected][contextConfigSelected],
            workspace
        );
    }

    return (
        <Modal
            isOpen={open}
            setIsOpen={setIsOpen}
            width={"w-11/12 xl:w-5/6"}
            height="h-5/6"
        >
            <Panel padding={false}>
                <div className={`flex flex-col w-full h-full overflow-clip`}>
                    <div className="flex flex-row w-full h-full overflow-clip">
                        <div className="flex flex-row w-full h-full space-x-4 overflow-clip">
                            {/* Panel */}
                            <div className="flex flex-col w-1/4 h-full overflow-y-auto bg-gray-800 p-4 space-y-2">
                                {widget && renderRequiredContexts(workspace)}
                                {!widget &&
                                    renderGlobalContextComponents(workspace)}
                            </div>
                            <div className="flex flex-col w-1/4 h-full overflow-y-auto p-4 space-y-2">
                                <ButtonIcon
                                    icon={"plus"}
                                    onClick={() =>
                                        handleCreateNewContextConfig()
                                    }
                                    className="text-gray-300 hover:text-gray-100"
                                    title="Create New Context"
                                />
                                {renderGlobalContexts(workspace)}
                            </div>
                            <div className="flex flex-col w-1/2 h-full overflow-y-auto p-4 bg-indigo-900">
                                {contextComponentSelected !== null &&
                                    contextConfigSelected !== null && (
                                        <PanelEditContext item={getContext()} />
                                    )}
                            </div>
                            {/* <div className="flex flex-col w-1/4 h-full overflow-y-auto text-xs text-gray-300">
                                <pre>{JSON.stringify(workspace, null, 2)}</pre>
                            </div> */}
                            {/* <div className="flex flex-col w-full h-full overflow-y-auto">
                                {renderRequiredContexts(workspace)}
                            {/* <PanelApplicationSettings
                                settings={settings}
                                setIsOpen={setIsOpen}
                                workspaces={workspaces}
                            /> */}
                        </div>
                    </div>
                    <div
                        className={`flex flex-row justify-end bg-gray-900 p-4 rounded-br rounded-bl border-t border-gray-800 justify-between items-center`}
                    >
                        {/* <div className={`flex flex-row font-bold text-xl ${currentTheme['text-primary-dark']} px-2`}>{themeSelected !== null ? themeSelected['name'] : ""}</div>
                    {isEditing === false && (
                        <div className="flex flex-row space-x-2">
                            <Button onClick={() => setIsOpen(false)} title="Cancel" textSize="text-base xl:text-lg" padding={'py-2 px-4'} backgroundColor={'bg-gray-700'} textColor={'text-gray-300'} hoverTextColor={'hover:text-gray-100'} hoverBackgroundColor={'hover:bg-gray-700'} />
                            <Button onClick={() => setIsEditing(true)} title="Edit" textSize="text-base xl:text-lg" padding={'py-2 px-4'} backgroundColor={'bg-gray-700'} textColor={'text-gray-300'} hoverTextColor={'hover:text-gray-100'} hoverBackgroundColor={'hover:bg-gray-700'} />
                            <Button onClick={handleActivateTheme} title="Activate" textSize="text-base xl:text-lg" padding={'py-2 px-4'} backgroundColor={'bg-gray-700'} textColor={'text-gray-300'} hoverTextColor={'hover:text-gray-100'} hoverBackgroundColor={'hover:bg-gray-700'} />
                        </div>
                    )}
                    {isEditing === true && (
                        <div className="flex flex-row space-x-2">
                            <Button onClick={() => setIsEditing(false)} title="Cancel" textSize="text-base xl:text-lg" padding={'py-2 px-4'} backgroundColor={'bg-gray-700'} textColor={'text-gray-300'} hoverTextColor={'hover:text-gray-100'} hoverBackgroundColor={'hover:bg-gray-700'} />
                            <Button onClick={() => handleSaveTheme(themeKeySelected)} title="Save Changes" textSize="text-base xl:text-lg" padding={'py-2 px-4'} backgroundColor={'bg-gray-700'} textColor={'text-gray-300'} hoverTextColor={'hover:text-gray-100'} hoverBackgroundColor={'hover:bg-gray-700'} />
                        </div>
                    )} */}
                    </div>
                </div>
                <Panel.Footer
                    className="flex flex-row justify-end"
                    padding={false}
                >
                    <div className="flex flex-row space-x-2 w-full justify-end">
                        <Button
                            title={"Cancel"}
                            bgColor={"bg-gray-800"}
                            textSize={"text-lg"}
                            padding={"py-2 px-4"}
                            onClick={() => setIsOpen(false)}
                        />
                        <Button
                            title={"Save Changes"}
                            bgColor={"bg-gray-800"}
                            hoverBackgroundColor={"hover:bg-green-700"}
                            textSize={"text-lg"}
                            padding={"py-2 px-4"}
                            onClick={() => console.log("Save Changes clicked")}
                        />
                    </div>
                </Panel.Footer>
            </Panel>
        </Modal>
    );
};
