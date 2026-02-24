import React, { useContext } from "react";
import { ButtonIcon, SubHeading3 } from "@trops/dash-react";
import { ThemeContext } from "../../Context";
import { getStylesForItem, themeObjects } from "@trops/dash-react";
import { LayoutContainer } from "../../Components/Layout";

export const DashboardFooter = ({
    workspace,
    preview,
    editMode,
    backgroundColor = null,
    borderColor = null,
    textColor = null,
    onClickEdit = null,
    onSaveChanges = null,
    onHome = null,
}) => {
    const { currentTheme } = useContext(ThemeContext);
    const stylesFooter = getStylesForItem(
        themeObjects.DASHBOARD_FOOTER,
        currentTheme,
        { borderColor, grow: false }
    );
    const handleHome = () => {
        onHome && onHome();
    };

    return (
        <LayoutContainer
            direction="row"
            grow={false}
            space={true}
            className={`p-2 border-t ${stylesFooter.string}`}
        >
            <div className="flex flex-row justify-between w-full">
                <div className="flex flex-row space-x-4">
                    <div className="w-10 h-10 items-center justify-center">
                        <ButtonIcon icon="arrow-left" onClick={handleHome} />
                    </div>
                    {workspace && (
                        <div className="flex flex-row justify-center items-center">
                            <SubHeading3
                                title={`${workspace.name}`}
                                padding={false}
                                className="text-gray-700 font-bold text-base"
                            />
                        </div>
                    )}
                </div>
                {preview === true && (
                    <div className="flex flex-row space-x-1">
                        <ButtonIcon
                            text={"Edit"}
                            onClick={onClickEdit}
                            hoverBackgroundColor={"hover:bg-indigo-700"}
                        />
                    </div>
                )}

                {preview === false && (
                    //     <><div className="flex flex-row space-x-1">
                    //         Edit Mode {editMode}
                    //     <ButtonIcon
                    //         text={"Layout"}
                    //         onClick={() => onChangeEditMode("layout")}
                    //         hoverBackgroundColor={"hover:bg-indigo-700"}
                    //     />
                    //     <ButtonIcon
                    //         text={"Functionality"}
                    //         onClick={() => onChangeEditMode("workspace")}
                    //         hoverBackgroundColor={"hover:bg-green-700"}
                    //     />
                    //     <ButtonIcon
                    //         text={"Widgets"}
                    //         onClick={() => onChangeEditMode("widget")}
                    //         hoverBackgroundColor={"hover:bg-green-700"}
                    //     />
                    // </div>
                    <div className="flex flex-row space-x-1">
                        <ButtonIcon
                            text={"Cancel"}
                            onClick={onClickEdit}
                            hoverBackgroundColor={"hover:bg-indigo-700"}
                        />
                        <ButtonIcon
                            text={"Save Changes"}
                            onClick={onSaveChanges}
                            hoverBackgroundColor={"hover:bg-green-700"}
                        />
                    </div>
                )}
            </div>
        </LayoutContainer>
    );
};
