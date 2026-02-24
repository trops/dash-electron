import React from "react";
import { Panel, Modal } from "@trops/dash-react";
import { PanelDashboardLoader } from "../../../Components/Dashboard/Panel/PanelDashboardLoader";

export const DashboardLoaderModal = ({
    open,
    setIsOpen,
    onSelecDashboard,
    onClose,
}) => {
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
                            <PanelDashboardLoader
                                onSelecDashboard={onSelecDashboard}
                                onClose={onClose}
                            />
                        </div>
                    </div>
                </div>
            </Panel>
        </Modal>
    );
};
