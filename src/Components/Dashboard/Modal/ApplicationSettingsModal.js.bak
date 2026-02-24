import React, { useContext } from "react";
import { Panel, Modal } from "@trops/dash-react";
import { AppContext } from "../../../Context";

import { PanelApplicationSettings } from "./PanelApplicationSettings";

export const ApplicationSettingsModal = ({
    workspaces,
    open,
    setIsOpen,
    onSave,
}) => {
    const { settings } = useContext(AppContext);

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
                        <div className="flex flex-row w-full h-full space-x-4 overflow-clip p-4">
                            {/* Panel */}
                            <PanelApplicationSettings
                                settings={settings}
                                setIsOpen={setIsOpen}
                                workspaces={workspaces}
                            />
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
            </Panel>
        </Modal>
    );
};
