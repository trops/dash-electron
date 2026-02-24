import React from "react";
import { InputText } from "@trops/dash-react";
import { LayoutContainer } from "../../../../Components/Layout";
const ThemePane = ({
    children,
    searchTerm,
    inputValue = null,
    onInputChange = null,
    inputPlaceholder = "",
    scroll = true,
}) => {
    return (
        <LayoutContainer
            id="theme-pane-layout-container"
            direction="col"
            scrollable={false}
            width="w-full"
        >
            {inputValue !== null && onInputChange !== null && (
                <div className="flex flex-row">
                    <InputText
                        value={searchTerm}
                        textSize="text-sm"
                        onChange={onInputChange}
                        placeholder={inputPlaceholder}
                    />
                </div>
            )}
            <div className="flex flex-col text-xs break-all h-full space-y-2 w-full">
                {children}
            </div>
        </LayoutContainer>
    );
};

export default ThemePane;
