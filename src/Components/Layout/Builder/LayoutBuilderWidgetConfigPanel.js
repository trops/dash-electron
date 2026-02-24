import { useEffect, useState } from "react";
import { Button, FontAwesomeIcon } from "@trops/dash-react";
import { SlidePanelOverlay } from "@trops/dash-react";
import { FormLabel, InputText, SelectMenu } from "@trops/dash-react";

/**
 *
 *
 * @returns
 */
function LayoutBuilderWidgetConfigPanel({
    layoutItem = null,
    open,
    setOpen,
    onComplete,
    onClose,
}) {
    const [item, setItem] = useState(layoutItem);

    useEffect(() => {
        if (layoutItem !== undefined && layoutItem !== item) {
            setItem(layoutItem);
        }
    }, [layoutItem, item]);

    function handleUpdate(e) {
        const newItem = JSON.parse(JSON.stringify(item));
        item[e.target.name] = e.target.value;
        setItem(newItem);
    }

    function handleTextChange(e) {
        const newItem = JSON.parse(JSON.stringify(item));
        item[e.target.name] = e.target.value;
        setItem(newItem);
    }

    function handleSubmit() {
        console.log("submitting! ", item);
        onComplete(item);
    }

    function generateFractions() {
        const numerators = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const denominators = [2, 3, 4, 5, 6, 12];
        const fractions = [];
        return numerators.map((v) => {
            return denominators
                .map((vv) => {
                    const fraction = v / vv;
                    if (
                        v % vv > 0 &&
                        v < vv &&
                        fractions.indexOf(fraction) < 0
                    ) {
                        fractions.push(fraction);
                        return (
                            <option value={`w-${v}/${vv}`}>
                                {v}/{vv}
                            </option>
                        );
                    } else {
                        return null;
                    }
                })
                .filter((p) => p !== null);
        });
    }

    return (
        item !== null &&
        item !== undefined && (
            <SlidePanelOverlay
                open={open}
                setOpen={setOpen}
                backgroundColor="bg-gray-800"
                onClose={onClose}
            >
                <div className="flex flex-col w-full h-full justify-center items-center bg-gray-900 p-4 space-y-4 grow flex-grow">
                    <div className="flex flex-col rounded w-full h-full space-y-4 bg-gray-800 p-4 justify-between grow">
                        <div className="flex flex-col rounded w-full space-y-4 bg-gray-900 p-4 grow">
                            <div className="rounded flex flex-row justify-between items-center justify-center">
                                <FormLabel
                                    title="Settings"
                                    fontWeight="font-bold"
                                    textSize="text-xl"
                                />
                                <div
                                    onClick={onClose}
                                    className="flex flex-col bg-gray-900 hover:bg-indigo-600 text-gray-200 rounded items-center justify-center w-10 h-10 cursor-pointer"
                                >
                                    <FontAwesomeIcon
                                        icon="xmark"
                                        className="h-6 w-6"
                                    />
                                </div>
                            </div>

                            <div className="rounded flex flex-col bg-gray-800 p-4 space-y-2">
                                <FormLabel
                                    title="Width"
                                    fontWeight="font-bold"
                                    textSize="text-lg"
                                />
                                <div className="text-sm text-gray-300 pb-2">
                                    The width of your Widget in the Layout.
                                </div>
                                <SelectMenu
                                    name={"width"}
                                    onChange={handleUpdate}
                                    selectedValue={item ? item.width : "w-full"}
                                >
                                    <option value="">-</option>
                                    <option value="w-full">Full</option>
                                    {generateFractions()}
                                </SelectMenu>
                            </div>

                            <div className="rounded flex flex-col bg-gray-800 p-4 space-y-2">
                                <FormLabel
                                    title="Width"
                                    fontWeight="font-bold"
                                    textSize="text-lg"
                                />
                                <div className="text-sm text-gray-300 pb-2">
                                    The width of your Widget in the Layout.
                                </div>
                                <InputText
                                    name={"component"}
                                    value={item.component}
                                    onChange={handleTextChange}
                                />
                            </div>

                            <div className="rounded flex flex-col bg-gray-800 p-4 space-y-2">
                                <FormLabel
                                    title="Scrolling"
                                    fontWeight="font-bold"
                                    textSize="text-lg"
                                />
                                <div className="text-sm text-gray-300 pb-2">
                                    The width of your Widget in the Layout.
                                </div>
                                <SelectMenu
                                    name={"scrollable"}
                                    onChange={handleUpdate}
                                    selectedValue={item ? item.scrollable : ""}
                                >
                                    <option value="true">Scrollable</option>
                                    <option value="false">
                                        Fixed (No Scrolling)
                                    </option>
                                </SelectMenu>
                            </div>

                            <pre>{JSON.stringify(item, 2, null)}</pre>
                        </div>

                        <div className="flex flex-row w-full">
                            <Button
                                title="Save Changes"
                                onClick={handleSubmit}
                                hoverBackgroundColor="hover:bg-indigo-600"
                                block
                            />
                        </div>
                    </div>
                </div>
            </SlidePanelOverlay>
        )
    );
}

export { LayoutBuilderWidgetConfigPanel };
