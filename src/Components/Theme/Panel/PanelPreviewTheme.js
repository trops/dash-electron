import React, { useState, useContext } from "react";
import {
    Button,
    Button2,
    Button3,
    ButtonIcon,
    Panel,
    Heading,
    Heading2,
    Heading3,
    SubHeading,
    SubHeading2,
    SubHeading3,
    Paragraph,
    Paragraph2,
    Paragraph3,
    MenuItem,
    MenuItem2,
    MenuItem3,
} from "@trops/dash-react";
import { ThemeContext } from "../../../Context";
import ThemePane from "./Pane/ThemePane";
import { getStylesForItem } from "../../../utils/colors";
import PreviewColorsPane from "./Pane/PreviewColorsPane";
import AvailableColorsPane from "./Pane/AvailableColorsPane";
import { themeObjects } from "../../../utils/themeObjects";

export const PanelPreviewTheme = ({ onUpdate, onCreateNew, theme = null }) => {
    const { themeVariant } = useContext(ThemeContext);

    const [itemSelected, setItemSelected] = useState(null);
    const [itemColorSelected, setItemColorSelected] = useState(null);

    function handleClickItem(itemType, styles) {
        // get the styles for the item and display...
        const temp = { item: itemType, styles };
        setItemSelected(() => temp);
        setItemColorSelected(null);
    }

    function renderButtons() {
        const buttonStyles = getStylesForItem(
            themeObjects.BUTTON,
            theme[themeVariant]
        );
        const button2Styles = getStylesForItem(
            themeObjects.BUTTON_2,
            theme[themeVariant]
        );
        const button3Styles = getStylesForItem(
            themeObjects.BUTTON_3,
            theme[themeVariant]
        );
        return (
            <div className="flex flex-col space-y-4">
                <Button
                    title="Button"
                    {...buttonStyles}
                    onClick={() => handleClickItem("button", buttonStyles)}
                />
                <Button2
                    title="Button 2"
                    {...button2Styles}
                    onClick={() => handleClickItem("button2", button2Styles)}
                />
                <Button3
                    title="Button 3"
                    {...button3Styles}
                    onClick={() => handleClickItem("button3", button3Styles)}
                />
            </div>
        );
    }

    function renderButtonIcon() {
        const styles = getStylesForItem(
            themeObjects.BUTTON_ICON,
            theme[themeVariant]
        );

        return (
            <div className="flex flex-col space-y-2 w-full justify-center items-center">
                <div className="flex flex-row space-x-2">
                    <ButtonIcon
                        text="Button Icon"
                        icon="pencil"
                        {...styles}
                        onClick={() => handleClickItem("buttonIcon", styles)}
                    />
                    <ButtonIcon
                        icon="pencil"
                        {...styles}
                        onClick={() => handleClickItem("buttonIcon", styles)}
                    />
                </div>
            </div>
        );
    }

    function renderMenuItem() {
        const styles = getStylesForItem(
            themeObjects.MENU_ITEM,
            theme[themeVariant]
        );
        const styles2 = getStylesForItem(
            themeObjects.MENU_ITEM_2,
            theme[themeVariant]
        );
        const styles3 = getStylesForItem(
            themeObjects.MENU_ITEM_3,
            theme[themeVariant]
        );
        return (
            <div className="flex flex-col space-y-2">
                <MenuItem
                    {...styles}
                    onClick={() => handleClickItem("menuItem", styles)}
                >
                    Menu Item
                </MenuItem>
                <MenuItem2
                    {...styles2}
                    onClick={() => handleClickItem("menuItem2", styles2)}
                >
                    Menu Item 2
                </MenuItem2>
                <MenuItem3
                    {...styles3}
                    onClick={() => handleClickItem("menuItem3", styles3)}
                >
                    Menu Item 3
                </MenuItem3>
            </div>
        );
    }

    function renderText() {
        const headingStyles = getStylesForItem(
            themeObjects.HEADING,
            theme[themeVariant]
        );
        const heading2Styles = getStylesForItem(
            themeObjects.HEADING_2,
            theme[themeVariant]
        );
        const heading3Styles = getStylesForItem(
            themeObjects.HEADING_3,
            theme[themeVariant]
        );

        const subHeadingStyles = getStylesForItem(
            themeObjects.SUBHEADING,
            theme[themeVariant]
        );
        const subHeading2Styles = getStylesForItem(
            themeObjects.SUBHEADING_2,
            theme[themeVariant]
        );
        const subHeading3Styles = getStylesForItem(
            themeObjects.SUBHEADING_3,
            theme[themeVariant]
        );

        const paragraphStyles = getStylesForItem(
            themeObjects.PARAGRAPH,
            theme[themeVariant]
        );
        const paragraph2Styles = getStylesForItem(
            themeObjects.PARAGRAPH_2,
            theme[themeVariant]
        );
        const paragraph3Styles = getStylesForItem(
            themeObjects.PARAGRAPH_3,
            theme[themeVariant]
        );

        return (
            <div className="flex flex-col space-y-4 p-4">
                <Heading
                    title={"Heading"}
                    {...headingStyles}
                    padding={false}
                    onClick={() => handleClickItem("heading", headingStyles)}
                />
                <Heading2
                    title={"Heading 2"}
                    {...heading2Styles}
                    padding={false}
                    onClick={() => handleClickItem("heading2", heading2Styles)}
                />
                <Heading3
                    title={"Heading 3"}
                    {...heading3Styles}
                    padding={false}
                    onClick={() => handleClickItem("heading3", heading3Styles)}
                />
                <SubHeading
                    title={"Subheading"}
                    {...subHeadingStyles}
                    padding={false}
                    onClick={() =>
                        handleClickItem("subHeading", subHeadingStyles)
                    }
                />
                <SubHeading2
                    title={"Subheading 2"}
                    {...subHeading2Styles}
                    padding={false}
                    onClick={() =>
                        handleClickItem("subHeading2", subHeading2Styles)
                    }
                />
                <SubHeading3
                    title={"Subheading 3"}
                    {...subHeading3Styles}
                    padding={false}
                    onClick={() =>
                        handleClickItem("subHeading3", subHeading3Styles)
                    }
                />
                <Paragraph
                    text={"The quick brown fox jumps over the lazy dog."}
                    {...paragraphStyles}
                    padding={false}
                    onClick={() =>
                        handleClickItem("paragraph", paragraphStyles)
                    }
                />
                <Paragraph2
                    text={"The quick brown fox jumps over the lazy dog."}
                    {...paragraph2Styles}
                    padding={false}
                    onClick={() =>
                        handleClickItem("paragraph2", paragraph2Styles)
                    }
                />
                <Paragraph3
                    text={"The quick brown fox jumps over the lazy dog."}
                    {...paragraph3Styles}
                    padding={false}
                    onClick={() =>
                        handleClickItem("paragraph3", paragraph3Styles)
                    }
                />
            </div>
        );
    }

    /**
     *
     * @param {object} data
     */
    function handleSelectColorForItem(data) {
        console.log("chose ", data, itemColorSelected, theme);
    }

    return (
        <Panel theme={false} backgroundColor={""} padding={false}>
            <div className="flex flex-col w-full h-full xl:space-x-4 overflow-clip">
                <div className="flex flex-row h-full rounded space-x-0 xl:space-x-4 w-full">
                    {/* <ThemesPane theme={theme} themeKey={themeKey} onClickNewTheme={handleCreateNewTheme} onChooseTheme={handleSelectTheme} onChooseVariant={onChangeVariant} /> */}
                    <div className="flex flex-col w-full w-1/2 xl:w-3/4 ">
                        <div className="flex flex-row p-2 font-bold">
                            {theme["name"]} {themeVariant}{" "}
                        </div>
                        {theme !== null && (
                            <div
                                className={`flex flex-row h-full rounded w-full overflow-clip bg-gray-900 space-x-0 xl:space-x-2 p-2`}
                            >
                                {/* Theme Preview */}
                                {/* <MainColorsPane
                                    theme={theme}
                                    variant={themeVariant}
                                    useSelected={false}
                                /> */}
                                <ThemePane>
                                    <Panel
                                        padding={false}
                                        className={
                                            "p-4 rounded h-full overflow-y-scroll"
                                        }
                                        scrollable={false}
                                        {...getStylesForItem(
                                            themeObjects.PANEL,
                                            theme[themeVariant]
                                        )}
                                    >
                                        {/* <div className="flex flex-col space-y-2"> */}
                                        {renderButtons()}
                                        {renderButtonIcon()}
                                        {renderMenuItem()}
                                        {renderText()}
                                        {/* </div> */}
                                    </Panel>
                                </ThemePane>
                                {itemSelected !== null && (
                                    <PreviewColorsPane
                                        styles={itemSelected["styles"]}
                                        itemType={itemSelected["item"]}
                                        onClickItem={(i) => {
                                            setItemColorSelected(i);
                                            // setItemColorSelected(null);
                                        }}
                                    />
                                )}
                                {itemColorSelected !== null &&
                                    itemSelected !== null && (
                                        <AvailableColorsPane
                                            onChooseColor={
                                                handleSelectColorForItem
                                            }
                                        />
                                    )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Panel>
    );
};

export default PanelPreviewTheme;
