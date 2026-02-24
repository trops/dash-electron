import { useState, useEffect } from "react";
import { Panel } from "@trops/dash-react";
import deepEqual from "deep-equal";

export const PanelThemeEditor = ({ onUpdate, theme = null }) => {
    const [themeSelected, setThemeSelected] = useState(theme);

    useEffect(() => {
        if (deepEqual(theme, themeSelected) === false) {
            setThemeSelected(() => theme);
        }
    }, [theme, themeSelected]);

    return (
        <Panel>
            <div className="flex flex-row w-full h-full space-x-4 overflow-clip">
                <div className="flex flex-row w-full min-w-3/4 h-full rounded">
                    {/* render the widget item here. */}
                    <div className="flex-col h-full rounded font-medium text-gray-400 w-full hidden xl:flex lg:w-1/3">
                        {/* render the widget item here. */}

                        <div className="flex flex-col rounded p-4 py-10 space-y-4">
                            <p className="text-5xl font-bold text-gray-200">
                                Theme.
                            </p>
                            <p className="text-xl font-normal text-gray-300">
                                If this appears to be jibberish to you, please
                                turn around.
                            </p>
                            <p className="text-xl font-normal text-gray-300">
                                If you need to manually edit the code for the
                                Component selected, by all means.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col h-full rounded bg-gray-900 w-full xl:w-2/3">
                        <div className="flex bg-gray-800 p-2 text-xs text-gray-300 rounded-br uppercase font-bold">
                            Theme Chooser
                        </div>
                        <div className="flex flex-col text-green-600 overflow-y-scroll bg-gray-900">
                            <div className="text-xs break-all h-full bg-gray-900">
                                {/* <CodeEditorInline code={JSON.stringify(itemSelected, null, 2)} className="p-0 h-full bg-gray-900" setCode={handleCodeChange} /> */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Panel>
    );
};

export default PanelThemeEditor;
