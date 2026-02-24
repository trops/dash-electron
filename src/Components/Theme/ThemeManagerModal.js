import React, { useState, useContext, useEffect } from "react";
import {
    Button,
    Panel,
    Modal,
    ThemeContext,
    getStylesForItem,
    themeObjects,
} from "@trops/dash-react";
import { AppContext } from "../../Context/App/AppContext";
import { ThemeModel } from "../../Models/ThemeModel";
import { deepCopy } from "@trops/dash-react";

import { PanelTheme } from "./Panel/PanelTheme";
import PanelThemePicker from "./Panel/PanelThemePicker";
import { ThemeQuickCreate } from "./Wizard";

export const ThemeManagerModal = ({ open, setIsOpen }) => {
    const {
        changeThemesForApplication,
        rawThemes,
        themes,
        changeCurrentTheme,
        changeThemeVariant,
        currentTheme,
    } = useContext(ThemeContext);
    const { dashApi, credentials, settings } = useContext(AppContext);

    const [themeSelected, setThemeSelected] = useState(null);
    const [rawThemeSelected, setRawThemeSelected] = useState(null);
    const [themeKeySelected, setThemeKeySelected] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [wizardName, setWizardName] = useState("");
    const [wizardMethod, setWizardMethod] = useState(null);
    const [wizardTheme, setWizardTheme] = useState(null);
    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    const footerStyles = getStylesForItem(
        themeObjects.PANEL_FOOTER,
        currentTheme,
        {}
    );

    useEffect(() => {
        if (open === false) {
            setThemeSelected(null);
            setRawThemeSelected(null);
            setThemeKeySelected(null);
            setIsCreating(false);
        } else {
            if (themeKeySelected === null && themes) {
                const themeKeyTemp =
                    settings && "theme" in settings
                        ? settings["theme"] in themes
                            ? settings["theme"]
                            : Object.keys(themes)[0]
                        : Object.keys(themes)[0];

                const themeModel = ThemeModel(rawThemes[themeKeyTemp]);

                setThemeKeySelected(() => themeKeyTemp);
                setThemeSelected(() => themeModel);
                setRawThemeSelected(() => rawThemes[themeKeyTemp]);
            }
        }
    }, [open, themes, rawThemes, settings, themeKeySelected]);

    function handleThemeSelected(themeUpdated, themeKey) {
        let newRawThemeSelected = deepCopy(rawThemeSelected);
        if (newRawThemeSelected !== null) {
            Object.keys(themeUpdated).forEach((k) => {
                newRawThemeSelected[k] = themeUpdated[k];
            });
        } else {
            newRawThemeSelected = deepCopy(themeUpdated);
        }

        setRawThemeSelected(() => newRawThemeSelected);

        const newTheme = ThemeModel(deepCopy(newRawThemeSelected));

        setThemeKeySelected(() => themeKey);
        setThemeSelected(() => newTheme);
        forceUpdate();
    }

    function handleStartCreateTheme() {
        setIsCreating(true);
        setIsEditing(false);
        setWizardName("");
        setWizardMethod(null);
        setWizardTheme(null);
    }

    function handleWizardComplete() {
        if (!wizardTheme || !wizardName.trim()) return;
        const key = wizardTheme.id || `theme-${Date.now()}`;
        const finalTheme = { ...wizardTheme, id: key, name: wizardName.trim() };

        if (dashApi) {
            dashApi.saveTheme(
                credentials.appId,
                key,
                finalTheme,
                (e, message) => {
                    changeThemesForApplication(message["themes"]);
                    setIsCreating(false);
                    setIsEditing(false);
                    const newThemes = message["themes"];
                    if (newThemes && newThemes[key]) {
                        setThemeKeySelected(key);
                        setThemeSelected(newThemes[key]);
                        setRawThemeSelected(finalTheme);
                    }
                },
                handleSaveThemeError
            );
        }
    }

    function handleCancelCreate() {
        setIsCreating(false);
    }

    function handleSaveTheme() {
        if (themeKeySelected !== null && rawThemeSelected !== null) {
            if (dashApi) {
                dashApi.saveTheme(
                    credentials.appId,
                    themeKeySelected,
                    rawThemeSelected,
                    handleSaveThemeComplete,
                    handleSaveThemeError
                );
            }
        }
        setIsEditing(false);
    }

    function handleSaveThemeComplete(e, message) {
        changeThemesForApplication(message["themes"]);
        setIsEditing(false);
    }

    function handleSaveThemeError(e, message) {
        console.error("Theme save error:", e, message);
    }

    function handleDeleteTheme() {
        if (!themeKeySelected || !dashApi || !credentials) return;

        // Can't delete if only one theme
        const themeKeys = themes ? Object.keys(themes) : [];
        if (themeKeys.length <= 1) return;

        dashApi.deleteTheme(
            credentials.appId,
            themeKeySelected,
            (e, message) => {
                if (message && message.themes) {
                    changeThemesForApplication(message.themes);
                }
                // Select first remaining theme
                const remainingKeys = Object.keys(message.themes || {});
                if (remainingKeys.length > 0) {
                    handleChooseTheme(remainingKeys[0]);
                } else {
                    setThemeSelected(null);
                    setThemeKeySelected(null);
                    setRawThemeSelected(null);
                }
            },
            (e, err) => {
                console.error("Error deleting theme:", err);
            }
        );
    }

    function handleChooseTheme(themeKey) {
        setThemeSelected(() => themes[themeKey]);
        setThemeKeySelected(() => themeKey);
        setRawThemeSelected(() => rawThemes[themeKey]);
    }

    function handleActivateTheme() {
        changeCurrentTheme(themeKeySelected);
        setIsOpen(false);
        setThemeSelected(null);
        setIsEditing(false);
    }

    return (
        <Modal
            isOpen={open}
            setIsOpen={setIsOpen}
            width={"w-11/12"}
            height="h-5/6"
            padding={false}
        >
            <Panel padding={false}>
                <div className={`flex flex-col w-full h-full overflow-clip`}>
                    <div className="flex flex-row w-full h-full overflow-clip">
                        <div className="flex flex-row w-full h-full overflow-clip">
                            {themeSelected && isEditing === false && (
                                <PanelThemePicker
                                    theme={themeSelected}
                                    themeKey={themeKeySelected}
                                    onUpdate={handleThemeSelected}
                                    onCreateNew={handleStartCreateTheme}
                                    onChooseTheme={handleChooseTheme}
                                    onChangeVariant={changeThemeVariant}
                                    rawTheme={rawThemeSelected}
                                    wizardContent={
                                        isCreating ? (
                                            <ThemeQuickCreate
                                                wizardName={wizardName}
                                                setWizardName={setWizardName}
                                                wizardMethod={wizardMethod}
                                                setWizardMethod={
                                                    setWizardMethod
                                                }
                                                wizardTheme={wizardTheme}
                                                setWizardTheme={setWizardTheme}
                                                onComplete={
                                                    handleWizardComplete
                                                }
                                            />
                                        ) : null
                                    }
                                />
                            )}
                            {!isCreating &&
                                themeSelected &&
                                isEditing === true && (
                                    <PanelTheme
                                        theme={themeSelected}
                                        themeKey={themeKeySelected}
                                        onUpdate={handleThemeSelected}
                                        onCreateNew={handleStartCreateTheme}
                                        rawTheme={rawThemeSelected}
                                    />
                                )}
                        </div>
                    </div>
                    <div
                        className={`flex flex-row p-2 rounded-br rounded-bl border-t justify-between items-center ${
                            footerStyles.backgroundColor || ""
                        } ${footerStyles.borderColor || ""}`}
                    >
                        {themeSelected !== null && (
                            <div className="flex flex-row">
                                <div
                                    className={`flex flex-col font-bold text-xl px-2`}
                                >
                                    {themeSelected !== null
                                        ? themeSelected["name"]
                                        : ""}
                                    <span className="text-xs opacity-40">
                                        {themeKeySelected}
                                    </span>
                                </div>
                            </div>
                        )}
                        {isCreating && (
                            <div className="flex flex-row space-x-2">
                                <Button
                                    onClick={handleCancelCreate}
                                    title="Cancel"
                                />
                            </div>
                        )}
                        {!isCreating && isEditing === false && (
                            <div className="flex flex-row space-x-2">
                                <Button
                                    onClick={() => setIsOpen(false)}
                                    title="Cancel"
                                />
                                {themeSelected !== null && (
                                    <Button
                                        onClick={handleDeleteTheme}
                                        title="Delete"
                                    />
                                )}
                                {themeSelected !== null && (
                                    <Button
                                        onClick={() => setIsEditing(true)}
                                        title="Edit"
                                    />
                                )}
                                {themeSelected !== null && (
                                    <Button
                                        onClick={handleActivateTheme}
                                        title="Activate"
                                    />
                                )}
                            </div>
                        )}
                        {!isCreating && isEditing === true && (
                            <div className="flex flex-row space-x-2">
                                <Button
                                    onClick={() => setIsEditing(false)}
                                    title="Cancel"
                                />
                                <Button
                                    onClick={() =>
                                        handleSaveTheme(themeKeySelected)
                                    }
                                    title="Save Changes"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Panel>
        </Modal>
    );
};
