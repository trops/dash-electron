import { ButtonIcon, ButtonIcon3, SelectMenu } from "@trops/dash-react";

export const GridEditTile = ({
    dashboard,
    component,
    cellNumber,
    cellData,
    cellsSelected,
    handleSelectWidget,
    handleSplitCell,
    handleSelectCell,
    compatibleWidgets,
    handleAddCell,
    handleDeleteCell,
}) => {
    const bgColor =
        component !== null ? dashboard.getContainerColor(component) : "";

    // const direction = itemSelected.direction;
    const spanValue =
        "span" in cellData && cellData["span"] !== null
            ? `${cellData["span"]}`
            : "";

    const isSelected =
        cellsSelected.filter((cell) => cell.cellNumber === cellNumber).length >
        0;
    const borderStyle =
        component !== null
            ? isSelected === true
                ? "border-2 border-gray-200"
                : ""
            : isSelected === true
            ? "border-2 border-gray-200"
            : "border-dotted border-gray-600 border-2";
    const isHidden =
        "hide" in cellData === false ? false : cellData.hide === true;

    return (
        isHidden === false && (
            <div
                className={`flex flex-col ${bgColor} w-full h-full rounded-md text-gray-200 ${borderStyle} ${spanValue}`}
                onClick={() => handleSelectCell({ cellNumber, component })}
            >
                <div className="flex flex-row w-full justify-end p-1 space-x-1">
                    {component === null ? cellNumber : component.component}
                </div>
                {/* <div className="flex flex-col w-full h-full justify-center items-center text-2xl font-bold p-4 cursor-pointer">{component === null ? cellNumber : component.component}</div> */}
                {/* <div className="flex flex-col w-full h-full justify-center items-center text-2xl font-bold p-4 cursor-pointer">
                    <SelectMenu onChange={(e) => handleSelectWidget(e.target.value, cellNumber, cellData)}>
                        <option value="">Select a Widget</option>
                        {compatibleWidgets.map(cw => {
                            return (<option value={cw}>{cw}</option>);
                        })}
                    </SelectMenu>
                    
                </div> */}
                <div className="flex flex-row items-center justify-center w-full h-full">
                    <div className="grid grid-cols-3 grid-rows-3 gap-1 justify-center items-center">
                        <div>&nbsp;</div>
                        <div className="flex flex-row justify-center items-center">
                            <ButtonIcon
                                width={"w-10"}
                                height={"h-10"}
                                icon="plus"
                                onClick={() =>
                                    handleAddCell({
                                        cellNumber,
                                        cellData,
                                        position: "top",
                                    })
                                }
                            />
                        </div>
                        <div>&nbsp;</div>

                        {/* <ButtonIcon icon="plus" onClick={() => handleAddCell({cellNumber, cellData, position: "left"})}/> */}
                        <div className="flex flex-row justify-end">
                            <ButtonIcon
                                width={"w-10"}
                                height={"h-10"}
                                icon="plus"
                                onClick={() =>
                                    handleAddCell({
                                        cellNumber,
                                        cellData,
                                        position: "left",
                                    })
                                }
                            />
                        </div>
                        <SelectMenu
                            onChange={(e) =>
                                handleSelectWidget(
                                    e.target.value,
                                    cellNumber,
                                    cellData
                                )
                            }
                        >
                            <option value="">Select a Widget</option>
                            {compatibleWidgets.map((cw) => {
                                return <option value={cw}>{cw}</option>;
                            })}
                        </SelectMenu>
                        <div className="flex flex-row justify-start">
                            <ButtonIcon
                                width={"w-10"}
                                height={"h-10"}
                                icon="plus"
                                onClick={() =>
                                    handleAddCell({
                                        cellNumber,
                                        cellData,
                                        position: "right",
                                    })
                                }
                            />
                        </div>

                        <div>&nbsp;</div>
                        <div className="flex flex-row justify-center items-center">
                            <ButtonIcon
                                width={"w-10"}
                                height={"h-10"}
                                icon="plus"
                                onClick={() =>
                                    handleAddCell({
                                        cellNumber,
                                        cellData,
                                        position: "bottom",
                                    })
                                }
                            />
                        </div>
                        <div>&nbsp;</div>
                    </div>
                </div>
                <div className="flex flex-row w-full justify-end p-1 space-x-1">
                    <ButtonIcon3
                        icon="trash"
                        onClick={() => console.log("trash")}
                        backgroundColor="bg-transparent"
                        hoverBackgroundColor="hover:bg-green-700"
                        className={`text-gray-200`}
                    />
                    <ButtonIcon3
                        icon="xmark"
                        onClick={() => handleSplitCell(cellNumber)}
                        backgroundColor="bg-transparent"
                        hoverBackgroundColor="hover:bg-green-700"
                        className={`text-gray-200`}
                    />
                    <ButtonIcon3
                        icon="pencil"
                        onClick={() => console.log("edit")}
                        backgroundColor="bg-transparent"
                        hoverBackgroundColor="hover:bg-green-700"
                        className={`text-gray-200`}
                    />
                </div>
            </div>
        )
    );
};
