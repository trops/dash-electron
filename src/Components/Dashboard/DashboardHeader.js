import React, { useContext, useEffect, useState } from "react";
import {
    ButtonIcon,
    ButtonIcon2,
    InputText,
    SelectInput,
    SubHeading3,
    Toggle,
} from "@trops/dash-react";
import { ThemeContext } from "../../Context";
import deepEqual from "deep-equal";

export const DashboardHeader = ({
    workspace,
    preview,
    onClickEdit = null,
    onNameChange,
    onSaveChanges = null,
    menuItems = [],
    themes = {},
    onFolderChange = null,
    onThemeChange = null,
    scrollableEnabled = false,
    onScrollableChange = null,
}) => {
    const [workspaceSelected, setWorkspaceSelected] = useState(workspace);
    const { currentTheme, themes: contextThemes } = useContext(ThemeContext);
    const resolvedThemes =
        themes && Object.keys(themes).length > 0 ? themes : contextThemes || {};

    useEffect(() => {
        if (deepEqual(workspace, workspaceSelected) === false) {
            setWorkspaceSelected(() => workspace);
        }
    }, [workspace, workspaceSelected]);

    return (
        <div
            className={`flex flex-row p-1 justify-between shrink items-center px-4 ${currentTheme["bg-primary-dark"]} py-2`}
        >
            {preview === true ? (
                <>
                    <SubHeading3
                        title={(workspaceSelected.name || "Untitled").replace(
                            /^./,
                            (c) => c.toUpperCase()
                        )}
                        padding={false}
                        className="font-bold text-base"
                    />
                    {onClickEdit !== null && (
                        <ButtonIcon
                            icon="pencil"
                            onClick={onClickEdit}
                            hoverBackgroundColor={"hover:bg-indigo-700"}
                        />
                    )}
                </>
            ) : (
                <>
                    <div className="flex flex-row items-center gap-2 flex-1 min-w-0">
                        <InputText
                            name="name"
                            value={workspaceSelected.name}
                            onChange={onNameChange}
                            textSize={"text-lg"}
                            placeholder="My Workspace"
                            bgColor={"bg-gray-800"}
                            textColor={"text-gray-400"}
                            hasBorder={false}
                            autoFocus
                        />
                        {onFolderChange && menuItems.length > 0 && (
                            <SelectInput
                                value={workspaceSelected.menuId ?? ""}
                                options={menuItems.map((m) => ({
                                    label: m.name,
                                    value: m.id,
                                    icon: m.icon || m.folder || "folder",
                                }))}
                                onChange={onFolderChange}
                                placeholder="Folder"
                                backgroundColor={"bg-gray-800"}
                                textColor={"text-gray-400"}
                                borderColor={"border-gray-700"}
                                inputClassName="py-1 text-sm"
                                className="w-40 shrink-0"
                            />
                        )}
                        {onThemeChange &&
                            Object.keys(resolvedThemes).length > 0 && (
                                <SelectInput
                                    value={workspaceSelected.themeKey || ""}
                                    options={Object.entries(resolvedThemes).map(
                                        ([key, t]) => ({
                                            label: t.name || key,
                                            value: key,
                                            icon: "palette",
                                        })
                                    )}
                                    onChange={onThemeChange}
                                    placeholder="Theme"
                                    backgroundColor={"bg-gray-800"}
                                    textColor={"text-gray-400"}
                                    borderColor={"border-gray-700"}
                                    inputClassName="py-1 text-sm"
                                    className="w-40 shrink-0"
                                />
                            )}
                        {onScrollableChange && (
                            <Toggle
                                text="Scrollable"
                                enabled={scrollableEnabled}
                                setEnabled={onScrollableChange}
                            />
                        )}
                    </div>
                    <div className="flex flex-row space-x-1 shrink-0">
                        {onClickEdit !== null && (
                            <ButtonIcon2
                                icon="xmark"
                                text="Cancel"
                                onClick={onClickEdit}
                                hoverBackgroundColor={"hover:bg-indigo-700"}
                            />
                        )}
                        {onSaveChanges !== null && (
                            <ButtonIcon2
                                icon="check"
                                text="Save"
                                onClick={onSaveChanges}
                                backgroundColor={"bg-green-800"}
                                hoverBackgroundColor={"hover:bg-green-700"}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
