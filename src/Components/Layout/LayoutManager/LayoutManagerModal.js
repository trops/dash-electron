import { useState, useEffect, useContext } from "react";
import {
    Button,
    FontAwesomeIcon,
    Modal,
    Panel,
    Stepper,
    Heading,
    InputText,
    ThemeContext,
} from "@trops/dash-react";
import { LayoutManagerPicker } from "./Panel/LayoutManagerPicker";
import { layoutTemplates, createLayoutFromTemplate } from "./layoutTemplates";
import { FOLDER_ICONS } from "../../Settings/details/FolderDetail";

export const LayoutManagerModal = ({
    open,
    setIsOpen,
    onCreateWorkspace,
    menuItems = [],
    onSaveMenuItem = null,
}) => {
    const { themes, themeKey: appThemeKey } = useContext(ThemeContext);

    const [dashboardName, setDashboardName] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState(
        layoutTemplates[0]
    );
    const [activeStep, setActiveStep] = useState(0);
    const [selectedMenuId, setSelectedMenuId] = useState(null);
    const [selectedThemeKey, setSelectedThemeKey] = useState(null);
    const [localMenuItems, setLocalMenuItems] = useState([]);

    // Inline new-folder form state
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [newFolderIcon, setNewFolderIcon] = useState(null);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setDashboardName("");
            setActiveStep(0);
            setLocalMenuItems(menuItems || []);
            setSelectedMenuId(
                menuItems && menuItems.length > 0 ? menuItems[0].id : 1
            );
            setSelectedTemplate(layoutTemplates[0]);
            setSelectedThemeKey(null);
            setIsCreatingFolder(false);
            setNewFolderName("");
            setNewFolderIcon(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    function handleClose() {
        setIsOpen(false);
    }

    function handleConfirm() {
        let menuId = selectedMenuId;

        // If creating a new folder, save it and use its id
        if (isCreatingFolder && newFolderName.trim() && newFolderIcon) {
            const newItem = {
                id: Date.now(),
                name: newFolderName.trim(),
                icon: newFolderIcon,
            };
            menuId = newItem.id;
            if (onSaveMenuItem) {
                onSaveMenuItem(newItem);
            }
        }

        if (selectedTemplate && onCreateWorkspace) {
            const layoutObj = createLayoutFromTemplate(
                selectedTemplate,
                menuId
            );
            onCreateWorkspace(
                layoutObj,
                selectedThemeKey,
                dashboardName.trim()
            );
        }
        setIsOpen(false);
    }

    function handleCancelNewFolder() {
        setIsCreatingFolder(false);
        setNewFolderName("");
        setNewFolderIcon(null);
    }

    // Advance to Step 2 on double-click (instead of instant create)
    function handleTemplateDoubleClick(template) {
        setSelectedTemplate(template);
        setActiveStep(2);
    }

    const selectedFolder = localMenuItems.find(
        (item) => item.id === selectedMenuId
    );

    return (
        <Modal
            isOpen={open}
            setIsOpen={setIsOpen}
            width="w-11/12 xl:w-5/6"
            height="h-5/6"
            scrollable={false}
        >
            <Panel backgroundColor="bg-slate-800" padding={false}>
                <Panel.Body scrollable={false} className="h-full">
                    <Stepper
                        activeStep={activeStep}
                        onStepChange={setActiveStep}
                        showNavigation={false}
                        className="h-full p-6 pb-0"
                    >
                        <Stepper.Step
                            label="Name"
                            description="Name your dashboard"
                        >
                            <div className="flex flex-row w-full h-full">
                                {/* Left 1/3 — Info sidebar */}
                                <div className="flex flex-col w-1/3 p-6 py-10 space-y-4 justify-start">
                                    <Heading
                                        title="Name"
                                        padding={false}
                                        textColor="text-gray-300"
                                    />
                                    <p className="text-base font-normal text-gray-400">
                                        Give your new dashboard a name.
                                    </p>
                                    {dashboardName.trim() && (
                                        <div className="flex flex-row items-center space-x-2 mt-4 pt-4 border-t border-gray-700">
                                            <FontAwesomeIcon
                                                icon="clone"
                                                className="text-blue-400"
                                            />
                                            <span className="text-sm font-medium text-gray-300">
                                                {dashboardName.trim()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {/* Right 2/3 — Name input */}
                                <div className="flex flex-col w-2/3 p-6 justify-start pt-10">
                                    <InputText
                                        value={dashboardName}
                                        onChange={(val) =>
                                            setDashboardName(val)
                                        }
                                        placeholder="Dashboard name"
                                        autoFocus={true}
                                    />
                                </div>
                            </div>
                        </Stepper.Step>
                        <Stepper.Step
                            label="Choose Layout"
                            description="Pick a template"
                        >
                            <LayoutManagerPicker
                                selectedTemplate={selectedTemplate}
                                onSelect={setSelectedTemplate}
                                onConfirm={handleTemplateDoubleClick}
                            />
                        </Stepper.Step>
                        <Stepper.Step
                            label="Organize"
                            description="Choose a folder"
                        >
                            {/* Folder selection UI */}
                            <div className="flex flex-row w-full h-full">
                                {/* Left 1/3 — Info sidebar */}
                                <div className="flex flex-col w-1/3 p-6 py-10 space-y-4 justify-start">
                                    <Heading
                                        title="Organize"
                                        padding={false}
                                        textColor="text-gray-300"
                                    />
                                    <p className="text-base font-normal text-gray-400">
                                        Assign this dashboard to a folder for
                                        easy organization in the sidebar.
                                    </p>
                                    {selectedFolder && (
                                        <div className="flex flex-row items-center space-x-2 mt-4 pt-4 border-t border-gray-700">
                                            <FontAwesomeIcon
                                                icon={
                                                    selectedFolder.icon ||
                                                    selectedFolder.folder ||
                                                    "folder"
                                                }
                                                className="text-blue-400"
                                            />
                                            <span className="text-sm font-medium text-gray-300">
                                                {selectedFolder.name}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Right 2/3 — Folder list */}
                                <div className="flex flex-col w-2/3 p-6 overflow-y-auto space-y-2">
                                    {/* Create New Folder — at the top */}
                                    {!isCreatingFolder ? (
                                        <button
                                            type="button"
                                            className="flex flex-row items-center space-x-3 px-4 py-3 rounded-lg cursor-pointer transition-all text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                                            onClick={() =>
                                                setIsCreatingFolder(true)
                                            }
                                        >
                                            <FontAwesomeIcon
                                                icon="plus"
                                                className="w-5 h-5"
                                            />
                                            <span className="text-sm font-medium">
                                                Create New Folder
                                            </span>
                                        </button>
                                    ) : (
                                        <div className="flex flex-col space-y-3 p-4 rounded-lg bg-gray-800 border border-gray-700">
                                            <div className="flex flex-row items-center justify-between">
                                                <span className="text-sm font-medium text-gray-300">
                                                    New Folder
                                                </span>
                                                <button
                                                    type="button"
                                                    className="text-gray-500 hover:text-gray-300 transition-colors"
                                                    onClick={
                                                        handleCancelNewFolder
                                                    }
                                                >
                                                    <FontAwesomeIcon icon="xmark" />
                                                </button>
                                            </div>
                                            <InputText
                                                value={newFolderName}
                                                onChange={(val) =>
                                                    setNewFolderName(val)
                                                }
                                                placeholder="Folder name"
                                            />
                                            <div className="grid grid-cols-10 gap-2">
                                                {FOLDER_ICONS.map((icon) => {
                                                    const isIconSelected =
                                                        icon === newFolderIcon;
                                                    return (
                                                        <div
                                                            key={icon}
                                                            className={`flex items-center justify-center p-2 rounded cursor-pointer transition-all ${
                                                                isIconSelected
                                                                    ? "bg-blue-600 ring-2 ring-blue-400 text-white"
                                                                    : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200"
                                                            }`}
                                                            onClick={() =>
                                                                setNewFolderIcon(
                                                                    icon
                                                                )
                                                            }
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={icon}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {localMenuItems.length > 0 && (
                                        <div className="border-t border-gray-700 my-2" />
                                    )}

                                    {localMenuItems.map((item) => {
                                        const isSelected =
                                            !isCreatingFolder &&
                                            item.id === selectedMenuId;
                                        return (
                                            <div
                                                key={item.id}
                                                className={`flex flex-row items-center space-x-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                                                    isSelected
                                                        ? "ring-2 ring-blue-500 bg-gray-700"
                                                        : "hover:bg-gray-750 hover:ring-1 hover:ring-gray-600 bg-gray-800/50"
                                                }`}
                                                onClick={() => {
                                                    setSelectedMenuId(item.id);
                                                    setIsCreatingFolder(false);
                                                    setNewFolderName("");
                                                    setNewFolderIcon(null);
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={
                                                        item.icon ||
                                                        item.folder ||
                                                        "folder"
                                                    }
                                                    className={`w-5 h-5 ${
                                                        isSelected
                                                            ? "text-blue-400"
                                                            : "text-gray-400"
                                                    }`}
                                                />
                                                <span
                                                    className={`text-sm font-medium ${
                                                        isSelected
                                                            ? "text-blue-300"
                                                            : "text-gray-300"
                                                    }`}
                                                >
                                                    {item.name}
                                                </span>
                                                {isSelected && (
                                                    <FontAwesomeIcon
                                                        icon="check"
                                                        className="ml-auto text-blue-400 text-sm"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Stepper.Step>
                        <Stepper.Step
                            label="Choose Theme"
                            description="Dashboard theme"
                        >
                            <div className="flex flex-row w-full h-full">
                                {/* Left 1/3 — Info sidebar */}
                                <div className="flex flex-col w-1/3 p-6 py-10 space-y-4 justify-start">
                                    <Heading
                                        title="Theme"
                                        padding={false}
                                        textColor="text-gray-300"
                                    />
                                    <p className="text-base font-normal text-gray-400">
                                        Choose a theme for this dashboard, or
                                        use the application default.
                                    </p>
                                    {selectedThemeKey !== null &&
                                        themes &&
                                        themes[selectedThemeKey] && (
                                            <>
                                                <div className="flex flex-row items-center space-x-2 mt-4 pt-4 border-t border-gray-700">
                                                    <FontAwesomeIcon
                                                        icon="palette"
                                                        className="text-blue-400"
                                                    />
                                                    <span className="text-sm font-medium text-gray-300">
                                                        {themes[
                                                            selectedThemeKey
                                                        ].name ||
                                                            selectedThemeKey}
                                                    </span>
                                                </div>
                                                <div className="flex flex-row space-x-2 mt-3">
                                                    {themes[selectedThemeKey]
                                                        .primary && (
                                                        <div
                                                            className={`w-8 h-8 rounded bg-${themes[selectedThemeKey].primary}-500`}
                                                        />
                                                    )}
                                                    {themes[selectedThemeKey]
                                                        .secondary && (
                                                        <div
                                                            className={`w-8 h-8 rounded bg-${themes[selectedThemeKey].secondary}-500`}
                                                        />
                                                    )}
                                                    {themes[selectedThemeKey]
                                                        .tertiary && (
                                                        <div
                                                            className={`w-8 h-8 rounded bg-${themes[selectedThemeKey].tertiary}-500`}
                                                        />
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    {selectedThemeKey === null && (
                                        <div className="flex flex-row items-center space-x-2 mt-4 pt-4 border-t border-gray-700">
                                            <FontAwesomeIcon
                                                icon="palette"
                                                className="text-blue-400"
                                            />
                                            <span className="text-sm font-medium text-gray-300">
                                                App Default
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Right 2/3 — Theme list */}
                                <div className="flex flex-col w-2/3 p-6 overflow-y-auto space-y-2">
                                    <div
                                        className={`flex flex-row items-center px-4 py-3 rounded-lg cursor-pointer transition-all ${
                                            selectedThemeKey === null
                                                ? "ring-2 ring-blue-500 bg-gray-700"
                                                : "hover:bg-gray-750 hover:ring-1 hover:ring-gray-600 bg-gray-800/50"
                                        }`}
                                        onClick={() =>
                                            setSelectedThemeKey(null)
                                        }
                                    >
                                        <FontAwesomeIcon
                                            icon="palette"
                                            className={`w-5 h-5 mr-3 ${
                                                selectedThemeKey === null
                                                    ? "text-blue-400"
                                                    : "text-gray-400"
                                            }`}
                                        />
                                        <span
                                            className={`text-sm font-medium ${
                                                selectedThemeKey === null
                                                    ? "text-blue-300"
                                                    : "text-gray-300"
                                            }`}
                                        >
                                            App Default
                                        </span>
                                        <div className="flex flex-row space-x-1 ml-auto">
                                            {themes &&
                                                appThemeKey &&
                                                themes[appThemeKey] && (
                                                    <>
                                                        {themes[appThemeKey]
                                                            .primary && (
                                                            <div
                                                                className={`w-4 h-4 rounded bg-${themes[appThemeKey].primary}-500`}
                                                            />
                                                        )}
                                                        {themes[appThemeKey]
                                                            .secondary && (
                                                            <div
                                                                className={`w-4 h-4 rounded bg-${themes[appThemeKey].secondary}-500`}
                                                            />
                                                        )}
                                                        {themes[appThemeKey]
                                                            .tertiary && (
                                                            <div
                                                                className={`w-4 h-4 rounded bg-${themes[appThemeKey].tertiary}-500`}
                                                            />
                                                        )}
                                                    </>
                                                )}
                                        </div>
                                    </div>
                                    {themes &&
                                        Object.entries(themes).map(
                                            ([key, t]) => {
                                                const isThemeSelected =
                                                    selectedThemeKey === key;
                                                return (
                                                    <div
                                                        key={key}
                                                        className={`flex flex-row items-center px-4 py-3 rounded-lg cursor-pointer transition-all ${
                                                            isThemeSelected
                                                                ? "ring-2 ring-blue-500 bg-gray-700"
                                                                : "hover:bg-gray-750 hover:ring-1 hover:ring-gray-600 bg-gray-800/50"
                                                        }`}
                                                        onClick={() =>
                                                            setSelectedThemeKey(
                                                                key
                                                            )
                                                        }
                                                    >
                                                        <FontAwesomeIcon
                                                            icon="palette"
                                                            className={`w-5 h-5 mr-3 ${
                                                                isThemeSelected
                                                                    ? "text-blue-400"
                                                                    : "text-gray-400"
                                                            }`}
                                                        />
                                                        <span
                                                            className={`text-sm font-medium ${
                                                                isThemeSelected
                                                                    ? "text-blue-300"
                                                                    : "text-gray-300"
                                                            }`}
                                                        >
                                                            {t.name || key}
                                                        </span>
                                                        <div className="flex flex-row space-x-1 ml-auto">
                                                            {t.primary && (
                                                                <div
                                                                    className={`w-4 h-4 rounded bg-${t.primary}-500`}
                                                                />
                                                            )}
                                                            {t.secondary && (
                                                                <div
                                                                    className={`w-4 h-4 rounded bg-${t.secondary}-500`}
                                                                />
                                                            )}
                                                            {t.tertiary && (
                                                                <div
                                                                    className={`w-4 h-4 rounded bg-${t.tertiary}-500`}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        )}
                                </div>
                            </div>
                        </Stepper.Step>
                    </Stepper>
                </Panel.Body>
            </Panel>
            <Modal.Footer>
                <div className="flex flex-row space-x-2">
                    {activeStep === 0 && (
                        <>
                            <Button
                                onClick={handleClose}
                                title="Cancel"
                                textSize="text-base xl:text-lg"
                                padding="py-2 px-4"
                                backgroundColor="bg-gray-700"
                                textColor="text-gray-300"
                                hoverTextColor="hover:text-gray-100"
                                hoverBackgroundColor="hover:bg-gray-600"
                            />
                            <Button
                                onClick={() => setActiveStep(1)}
                                title="Next"
                                textSize="text-base xl:text-lg"
                                padding="py-2 px-4"
                                backgroundColor="bg-blue-600"
                                textColor="text-white"
                                hoverTextColor="hover:text-white"
                                hoverBackgroundColor="hover:bg-blue-500"
                                disabled={!dashboardName.trim()}
                            />
                        </>
                    )}
                    {activeStep === 1 && (
                        <>
                            <Button
                                onClick={() => setActiveStep(0)}
                                title="Back"
                                textSize="text-base xl:text-lg"
                                padding="py-2 px-4"
                                backgroundColor="bg-gray-700"
                                textColor="text-gray-300"
                                hoverTextColor="hover:text-gray-100"
                                hoverBackgroundColor="hover:bg-gray-600"
                            />
                            <Button
                                onClick={() => setActiveStep(2)}
                                title="Next"
                                textSize="text-base xl:text-lg"
                                padding="py-2 px-4"
                                backgroundColor="bg-blue-600"
                                textColor="text-white"
                                hoverTextColor="hover:text-white"
                                hoverBackgroundColor="hover:bg-blue-500"
                                disabled={!selectedTemplate}
                            />
                        </>
                    )}
                    {activeStep === 2 && (
                        <>
                            <Button
                                onClick={() => setActiveStep(1)}
                                title="Back"
                                textSize="text-base xl:text-lg"
                                padding="py-2 px-4"
                                backgroundColor="bg-gray-700"
                                textColor="text-gray-300"
                                hoverTextColor="hover:text-gray-100"
                                hoverBackgroundColor="hover:bg-gray-600"
                            />
                            <Button
                                onClick={() => setActiveStep(3)}
                                title="Next"
                                textSize="text-base xl:text-lg"
                                padding="py-2 px-4"
                                backgroundColor="bg-blue-600"
                                textColor="text-white"
                                hoverTextColor="hover:text-white"
                                hoverBackgroundColor="hover:bg-blue-500"
                            />
                        </>
                    )}
                    {activeStep === 3 && (
                        <>
                            <Button
                                onClick={() => setActiveStep(2)}
                                title="Back"
                                textSize="text-base xl:text-lg"
                                padding="py-2 px-4"
                                backgroundColor="bg-gray-700"
                                textColor="text-gray-300"
                                hoverTextColor="hover:text-gray-100"
                                hoverBackgroundColor="hover:bg-gray-600"
                            />
                            <Button
                                onClick={handleConfirm}
                                title="Create"
                                textSize="text-base xl:text-lg"
                                padding="py-2 px-4"
                                backgroundColor="bg-blue-600"
                                textColor="text-white"
                                hoverTextColor="hover:text-white"
                                hoverBackgroundColor="hover:bg-blue-500"
                            />
                        </>
                    )}
                </div>
            </Modal.Footer>
        </Modal>
    );
};
