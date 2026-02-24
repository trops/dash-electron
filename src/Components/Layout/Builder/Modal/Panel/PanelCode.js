import { useState, useEffect, useCallback } from "react";
import { CodeEditorInline } from "@trops/dash-react";
import deepEqual from "deep-equal";

export const PanelCode = ({ workspace, onUpdate, item = null }) => {
    const [itemSelected, setItemSelected] = useState(item);
    const [workspaceSelected, setWorkspaceSelected] = useState(workspace);
    const [, updateState] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);

    useEffect(() => {
        if (deepEqual(item, itemSelected) === false) {
            setItemSelected(() => item);
            forceUpdate();
        }

        if (deepEqual(workspace, workspaceSelected) === false) {
            setWorkspaceSelected(() => workspace);
            forceUpdate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace, item]);

    function handleCodeChange(code) {
        const itemToSave = JSON.parse(code);
        onUpdate(itemToSave, workspaceSelected);
    }

    return (
        itemSelected &&
        workspaceSelected && (
            <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-hidden">
                    <CodeEditorInline
                        code={JSON.stringify(itemSelected, null, 2)}
                        className="h-full"
                        setCode={handleCodeChange}
                    />
                </div>
            </div>
        )
    );
};

export default PanelCode;
