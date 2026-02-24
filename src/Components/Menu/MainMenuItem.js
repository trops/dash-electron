import React from "react";
import { MenuItem3 } from "@trops/dash-react";

const MainMenuItem = ({ workspaceMenuId, onDropItem, onClick, title }) => {
    return (
        // <DragDropWidget
        //     id={workspaceMenuId}
        //     width={"w-full"}
        //     type={"menu-item"}
        //     onDropItem={onDropItem}
        // >
        <MenuItem3 onClick={onClick} className={"p-4 font-bold rounded"}>
            {title}
        </MenuItem3>
        // </DragDropWidget>
    );
};

export { MainMenuItem };
