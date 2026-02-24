import React, { useState, useMemo } from "react";
import {
    Button,
    ButtonIcon,
    InputText,
    SearchInput,
    SubHeading3,
    Tag,
    FontAwesomeIcon,
} from "@trops/dash-react";
import * as DashReact from "@trops/dash-react";

export const FOLDER_ICONS = [
    // General / UI
    "home",
    "folder",
    "star",
    "heart",
    "bookmark",
    "tag",
    "flag",
    "bell",
    "circle",
    "square",
    "circle-check",
    "thumbs-up",
    "clone",
    "signal",
    // Communication
    "phone",
    "envelope",
    "comment",
    "message",
    "paper-plane",
    // Media
    "image",
    "camera",
    "music",
    "video",
    "film",
    "headphones",
    // Tech
    "code",
    "terminal",
    "database",
    "server",
    "wifi",
    "plug",
    "robot",
    "microchip",
    "globe",
    // Nature
    "leaf",
    "seedling",
    "tree",
    "sun",
    "moon",
    "cloud",
    "bolt",
    "fire",
    "snowflake",
    "water",
    // Objects
    "hammer",
    "wrench",
    "gear",
    "briefcase",
    "cart-shopping",
    "truck",
    "car",
    "plane",
    "rocket",
    // People / Activity
    "user",
    "users",
    "trophy",
    "gamepad",
    "dumbbell",
    "graduation-cap",
    "baby",
    "baby-carriage",
    // Arrows / Navigation
    "arrow-up",
    "arrow-down",
    "arrow-left",
    "arrow-right",
    "arrows-up-down",
    "arrows-left-right",
    "minus",
    // Data / Charts
    "chart-bar",
    "chart-line",
    "chart-pie",
    "table",
    "list",
    "layer-group",
    // Files
    "file",
    "file-code",
    "clipboard",
    "book",
    "pen",
    "pencil",
    // Misc
    "magnifying-glass",
    "eye",
    "lock",
    "key",
    "shield",
    "clock",
    "calendar",
    "link",
];

const ALL_ICON_NAMES = Object.keys(DashReact)
    .filter((key) => key.startsWith("fa") && key !== "fas")
    .map((key) => DashReact[key]?.iconName)
    .filter(Boolean)
    .filter((name, index, arr) => arr.indexOf(name) === index)
    .sort();

const CURATED_SET = new Set(FOLDER_ICONS);

const IconPicker = ({ selectedIcon, onSelectIcon }) => {
    const [search, setSearch] = useState("");
    const query = search.trim().toLowerCase();

    const filteredCurated = useMemo(
        () =>
            query
                ? FOLDER_ICONS.filter((name) => name.includes(query))
                : FOLDER_ICONS,
        [query]
    );

    const remainingIcons = useMemo(() => {
        const all = ALL_ICON_NAMES.filter((name) => !CURATED_SET.has(name));
        return query ? all.filter((name) => name.includes(query)) : all;
    }, [query]);

    const hasResults = filteredCurated.length > 0 || remainingIcons.length > 0;

    const renderIcon = (icon) => (
        <ButtonIcon
            key={icon}
            icon={icon}
            selected={icon === selectedIcon}
            onClick={() => onSelectIcon(icon)}
            iconSize="h-6 w-6"
            backgroundColor="transparent"
            className={
                icon !== selectedIcon ? "opacity-50 hover:!opacity-80" : ""
            }
        />
    );

    return (
        <div className="flex flex-col flex-1 min-h-0 space-y-3">
            <div className="flex-shrink-0">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search icons..."
                />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                {!hasResults && (
                    <span className="text-sm opacity-50 py-2">
                        No icons match "{search}"
                    </span>
                )}

                {filteredCurated.length > 0 && (
                    <div className="flex flex-col space-y-1.5">
                        <span className="text-xs font-medium opacity-50">
                            Suggested
                        </span>
                        <div className="grid grid-cols-6 gap-2">
                            {filteredCurated.map(renderIcon)}
                        </div>
                    </div>
                )}

                {remainingIcons.length > 0 && (
                    <div className="flex flex-col space-y-1.5">
                        <span className="text-xs font-medium opacity-50">
                            All Icons
                        </span>
                        <div className="grid grid-cols-6 gap-2">
                            {remainingIcons.map(renderIcon)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const FolderDetail = ({
    menuItem = null,
    workspaces = [],
    isEditing = false,
    isCreating = false,
    formName = "",
    setFormName,
    formIcon = "folder",
    setFormIcon,
    onSaveEdit,
    onCancelEdit,
    onStartEdit,
    onCreate,
    onDelete,
}) => {
    const isFormMode = isEditing || isCreating;

    // Get dashboards in this folder
    const folderDashboards = menuItem
        ? workspaces.filter((ws) => ws.menuId === menuItem.id)
        : [];

    if (isFormMode) {
        return (
            <div className="flex flex-col flex-1 min-h-0">
                {/* Fixed header fields */}
                <div className="flex-shrink-0 p-6 pb-0 space-y-5">
                    <SubHeading3
                        title={isCreating ? "New Folder" : "Edit Folder"}
                        padding={false}
                    />
                    <InputText
                        value={formName}
                        onChange={(value) => setFormName(value)}
                        placeholder="Folder name"
                    />
                </div>
                {/* Scrollable icon picker */}
                <div className="flex flex-col flex-1 min-h-0 px-6 pt-5 pb-6 space-y-2">
                    <span className="flex-shrink-0 text-sm font-medium opacity-70">
                        Icon
                    </span>
                    <IconPicker
                        selectedIcon={formIcon}
                        onSelectIcon={setFormIcon}
                    />
                </div>
                {/* Footer */}
                <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-6 py-4 border-t border-white/10">
                    <Button title="Cancel" onClick={onCancelEdit} size="sm" />
                    <Button
                        title={isCreating ? "Create" : "Save"}
                        onClick={isCreating ? onCreate : onSaveEdit}
                        size="sm"
                    />
                </div>
            </div>
        );
    }

    if (!menuItem) return null;

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                {/* Name + icon */}
                <div className="flex flex-row items-center gap-3">
                    <FontAwesomeIcon
                        icon={menuItem.folder || menuItem.icon || "folder"}
                        className="h-5 w-5 opacity-60"
                    />
                    <SubHeading3 title={menuItem.name} padding={false} />
                </div>

                {/* Dashboard count + list */}
                <div className="flex flex-col space-y-3">
                    <span className="text-sm opacity-70">
                        {folderDashboards.length} dashboard
                        {folderDashboards.length !== 1 ? "s" : ""}
                    </span>
                    {folderDashboards.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {folderDashboards.map((ws) => (
                                <Tag key={ws.id} text={ws.name || "Untitled"} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-6 py-4 border-t border-white/10">
                <Button
                    title="Edit"
                    onClick={() => onStartEdit(menuItem)}
                    size="sm"
                />
                <Button
                    title="Delete"
                    onClick={() => onDelete(menuItem)}
                    size="sm"
                />
            </div>
        </div>
    );
};
