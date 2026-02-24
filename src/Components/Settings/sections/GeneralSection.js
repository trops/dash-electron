import React, { useContext, useEffect, useState } from "react";
import { Switch, DataList, SubHeading3, Button } from "@trops/dash-react";
import { AppContext } from "../../../Context/App/AppContext";

export const GeneralSection = () => {
    const appContext = useContext(AppContext);
    const debugMode = appContext?.debugMode || false;
    const credentials = appContext?.credentials || {};
    const [dataDirectory, setDataDirectory] = useState(null);

    useEffect(() => {
        const dashApi = appContext?.dashApi;
        if (dashApi) {
            dashApi.getDataDirectory(
                (e, result) => {
                    if (result?.dataDirectory) {
                        setDataDirectory(result.dataDirectory);
                    }
                },
                () => {}
            );
        }
    }, [appContext?.dashApi]);

    function handleToggleDebug(value) {
        if (appContext?.changeDebugMode) {
            appContext.changeDebugMode(value);
        }
    }

    function handleOpenDataDirectory() {
        if (appContext?.openDataDirectory) {
            appContext.openDataDirectory();
        }
    }

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex flex-col space-y-3">
                <SubHeading3 title="Preferences" padding={false} />
                <div className="flex flex-row items-center justify-between py-3">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">Debug Mode</span>
                        <span className="text-xs opacity-50">
                            Show debug borders and logging information
                        </span>
                    </div>
                    <Switch checked={debugMode} onChange={handleToggleDebug} />
                </div>
            </div>

            <div className="flex flex-col space-y-3">
                <SubHeading3 title="Data Directory" padding={false} />
                <div className="flex flex-row items-center justify-between py-3">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">
                            Application Data
                        </span>
                        <span className="text-xs opacity-50">
                            Open the folder where settings, themes, and
                            workspaces are stored
                        </span>
                        {dataDirectory && (
                            <span className="text-xs opacity-40 mt-1 font-mono">
                                {dataDirectory}
                            </span>
                        )}
                    </div>
                    <Button
                        title="Open Folder"
                        onClick={handleOpenDataDirectory}
                    />
                </div>
            </div>

            <div className="flex flex-col space-y-3">
                <SubHeading3 title="App Info" padding={false} />
                <DataList>
                    <DataList.Item
                        label="App ID"
                        value={credentials.appId || "—"}
                    />
                    <DataList.Item
                        label="Version"
                        value={credentials.version || "—"}
                        divider={false}
                    />
                </DataList>
            </div>

            <div className="flex flex-col space-y-3">
                <SubHeading3 title="Settings File" padding={false} />
                <pre className="text-xs bg-black/20 rounded p-3 overflow-auto max-h-64">
                    {JSON.stringify(appContext?.settings, null, 2)}
                </pre>
            </div>
        </div>
    );
};
