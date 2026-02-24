/**
 * DragDropWidget
 *
 * event: onDropItem
 */
import { useDrag } from "react-dnd";

export const DragDropWidget = ({ id, type, width, children, onDropItem }) => {
    const [collected, drag, dragPreview] = useDrag(() => ({
        type: type,
        item: { id, type },
        collect: (monitor) => {
            return {
                isDragging: monitor.isDragging(),
                sourceIndex: monitor.sourceIndex,
            };
        },
        monitor: () => ({ isDragging: collected.isDragging }),
        end: (item, monitor) => {
            const dropResult = monitor.getDropResult();
            if (item && dropResult) {
                onDropItem({
                    sourceIndex: item.id,
                    dropIndex: dropResult.id,
                });
            }
        },
    }));

    function renderDragItem() {
        return collected.isDragging ? (
            <div
                ref={dragPreview}
                className="h-full flex flex-col min-h-64 w-full opacity-50"
            >
                {children}
            </div>
        ) : (
            <div
                ref={drag}
                id={collected.id}
                type={collected.type}
                className={`scale-100 flex flex-col ${width} min-w-xl rounded min-h-64 h-full`}
                style={{ animationDelay: "-.75s", animationDuration: ".25s" }}
            >
                {children}
            </div>
        );
    }
    return <>{renderDragItem()}</>;
};
