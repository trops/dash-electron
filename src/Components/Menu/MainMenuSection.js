import React, { useContext } from "react";
import { ThemeContext } from "../../Context";
import {
    FontAwesomeIcon,
    Panel3,
    Paragraph3,
    Menu,
    ButtonIcon,
} from "@trops/dash-react";

export const MainMenuSection = ({
    id,
    type = "menu-item",
    menuItem,
    children,
    onCreateNew,
}) => {
    useContext(ThemeContext);

    // Drop Functionality
    // const [{ isOver, isOverCurrent, canDrop }, drop] = useDrop({
    //     accept: type,
    //     drop: (_item, monitor) => {
    //         const didDrop = monitor.didDrop();
    //         if (didDrop) {
    //             return;
    //         }
    //         return { id, type, dropIndex: id };
    //     },
    //     canDrop: (obj) => {
    //         return obj.id !== menuItem.id;
    //     },
    //     collect: (monitor) => {
    //         return {
    //             isDragging: monitor.isDragging,
    //             isOverCurrent: monitor.isOver({ shallow: true }),
    //             canDrop: monitor.canDrop(),
    //         };
    //     },
    // });

    function handleCreateNew(menuItem) {
        onCreateNew && onCreateNew(menuItem);
    }

    return (
        <Panel3
            id={menuItem.id}
            scrollable={false}
            grow={false}
            horizontal={false}
            padding={"px-1"}
            border={false}
        >
            <div className={`flex flex-row justify-between p-2 pl-2 w-full`}>
                <div className="flex flex-row text-xs items-center space-x-2 w-full">
                    <FontAwesomeIcon icon={menuItem.icon} />
                    <Paragraph3
                        text={menuItem.name}
                        className="font-bold uppercase text-xs items-center"
                    />
                </div>
                <ButtonIcon
                    icon="plus"
                    textSize={"text-xs"}
                    padding={false}
                    onClick={() => handleCreateNew(menuItem)}
                    className="hover:bg-green-500 bg-transparent"
                />
            </div>
            <Menu>{children}</Menu>
        </Panel3>
    );
};
