import React, { useContext } from "react";
import { Panel } from "@trops/dash-react";
import { ThemeContext } from "../../../Context";
import ThemePickerGridPane from "./Pane/ThemePickerGridPane";
import ThemeTitlePane from "./Pane/ThemeTitlePane";

export const PanelThemePicker = ({
    onUpdate,
    onCreateNew,
    onChangeVariant,
    theme = null,
    themeKey,
    wizardContent = null,
}) => {
    const { rawThemes } = useContext(ThemeContext);

    function handleSelectTheme(themeKey) {
        onUpdate(rawThemes[themeKey], themeKey);
    }

    function handleCreateNewTheme() {
        onCreateNew();
    }

    return (
        <Panel
            theme={false}
            backgroundColor={"bg-transparent"}
            width="w-full"
            padding={false}
        >
            <div className="flex flex-col w-full h-full overflow-clip">
                <div className="flex flex-row h-full rounded w-full">
                    <ThemeTitlePane
                        theme={theme}
                        themeKey={themeKey}
                        onClickNewTheme={handleCreateNewTheme}
                        onChooseVariant={onChangeVariant}
                    />
                    <div className="flex flex-col w-full w-1/2 xl:w-3/4">
                        {wizardContent ? (
                            <div
                                className={`flex flex-col h-full rounded w-full overflow-clip bg-gray-900 p-2`}
                            >
                                {wizardContent}
                            </div>
                        ) : (
                            theme !== null && (
                                <div
                                    className={`flex flex-row h-full rounded w-full overflow-clip bg-gray-900 xl:space-x-2 p-2`}
                                >
                                    <ThemePickerGridPane
                                        theme={theme}
                                        themeKey={themeKey}
                                        onClickNewTheme={handleCreateNewTheme}
                                        onChooseTheme={handleSelectTheme}
                                        onChooseVariant={onChangeVariant}
                                    />
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </Panel>
    );
};

export default PanelThemePicker;
