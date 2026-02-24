import { Button, InputText } from "@trops/dash-react";
import { useEffect, useState } from "react";
import { renderLayoutMenu } from "../../../utils/layout";

export default function LayoutBuilderConfigPanel({
    workspace,
    onComplete,
    onClickEdit,
}) {
    const [currentWorkspace, setCurrentWorkspace] = useState(workspace);

    useEffect(() => {
        if (workspace !== currentWorkspace && workspace !== undefined) {
            setCurrentWorkspace(workspace);
        }
    }, [workspace, currentWorkspace]);

    function handleTextChange(e) {
        const newItem = JSON.parse(JSON.stringify(currentWorkspace));
        currentWorkspace[e.target.name] = e.target.value;
        setCurrentWorkspace(newItem);
        // onComplete(currentWorkspace);
    }

    function handleClickMenuItem(item) {
        console.log("clicked menu item ", item);
        onClickEdit(item);
    }

    function handleHoverMenuItem(item) {
        //console.log(item);
    }

    function handleMouseOutMenuItem(item) {
        console.log("mouse out", item);
    }

    return (
        currentWorkspace && (
            <div className="flex flex-col overflow-clip h-full w-full">
                <div className="flex flex-col justify-between h-full overflow-clip w-full">
                    <div className="flex flex-col h-full overflow-clip w-full rounded space-y-4">
                        <div className="rounded flex flex-col">
                            <InputText
                                name={"name"}
                                value={currentWorkspace.name}
                                onChange={handleTextChange}
                            />
                        </div>

                        <div className="flex flex-col overflow-y-auto">
                            {renderLayoutMenu({
                                currentWorkspace,
                                parentKey: 0,
                                onClick: handleClickMenuItem,
                                onMouseOver: handleHoverMenuItem,
                                onMouseOut: handleMouseOutMenuItem,
                            })}
                        </div>
                    </div>

                    <div className="flex flex-row w-full p-2">
                        <Button
                            title="Save Changes"
                            onClick={() => onComplete(currentWorkspace)}
                            hoverBackgroundColor="hover:bg-indigo-600"
                            block
                        />
                    </div>
                </div>
            </div>
        )
    );
}
