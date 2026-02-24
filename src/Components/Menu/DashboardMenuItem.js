import React, { useState } from "react";
import { useDrop } from "react-dnd";
import { ButtonIcon } from "@trops/dash-react";

function DashboardMenuItem({
    theme = true,
    item,
    id,
    icon,
    type = "menu-item",
    onClick,
    selected = false,
}) {
    const [, setHasDropped] = useState(false);
    const [, setHasDroppedOnChild] = useState(false);

    const [{ isOverCurrent }, drop] = useDrop(
        {
            accept: type,
            drop: (_item, monitor) => {
                const didDrop = monitor.didDrop();
                if (didDrop) {
                    return;
                }
                setHasDropped(true);
                setHasDroppedOnChild(didDrop);
                console.log("dropped ", { id, type, dropIndex: id, obj: item });
                return { id, type, dropIndex: id, obj: item };
            }, // the id and the type AGAIN of the item for dropping
            // canDrop: (obj) => {
            //     return id !== 1 && (item.canHaveChildren === true);// && obj.parent !== id; // cant drop in these places
            // }, // this will cause the elements that are droppable to be styles (if we choose!)
            collect: (monitor) => ({
                isOver: monitor.isOver(),
                canDrop: monitor.canDrop(),
                isDragging: monitor.isDragging,
                isOverCurrent: monitor.isOver({ shallow: true }),
            }),
        },
        [setHasDropped, setHasDroppedOnChild]
    );

    return (
        <div
            ref={drop}
            id={id}
            className={`drop-component relative cursor-pointer rounded min-w-lg ${
                isOverCurrent
                    ? "w-10 h-10 opacity-100 animate-pulse"
                    : "w-10 h-10 opacity-100"
            } `}
        >
            <div className={`w-full- h-full items-center justify-center`}>
                <ButtonIcon icon={icon} onClick={onClick} />
            </div>
        </div>
    );
}

export { DashboardMenuItem };
