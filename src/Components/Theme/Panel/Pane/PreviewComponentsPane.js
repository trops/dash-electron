import React from "react";

import {
    Button,
    Button2,
    Button3,
    ButtonIcon,
    Panel,
    Panel2,
    Panel3,
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
    ButtonIcon2,
    ButtonIcon3,
    Tag,
    Tag2,
    Tag3,
} from "@trops/dash-react";
import { LayoutContainer } from "../../../../Components/Layout";

import { getCSSStyleForClassname, getStylesForItem } from "@trops/dash-react";
import { themeObjects } from "@trops/dash-react";

const PreviewComponentsPane = ({ theme, themeVariant, onClick }) => {
    function handleClickItem(itemType, styles) {
        try {
            console.log("clicked item ", itemType, styles);
            // get the styles for the item and display...
            const temp = { item: itemType, styles };
            // setItemSelected(() => temp);
            // setItemColorSelected(null);
            onClick(temp);
        } catch (e) {
            console.log(e);
        }
    }

    function renderPanels() {
        console.log("render panels theme ", theme);
        const styles = getStylesForItem(
            themeObjects.PANEL,
            theme[themeVariant]
        );
        const styles2 = getStylesForItem(
            themeObjects.PANEL_2,
            theme[themeVariant]
        );
        const styles3 = getStylesForItem(
            themeObjects.PANEL_3,
            theme[themeVariant]
        );

        // Panel 1
        const headingStyles = getStylesForItem(
            themeObjects.HEADING,
            theme[themeVariant]
        );
        const subHeadingStyles = getStylesForItem(
            themeObjects.SUBHEADING,
            theme[themeVariant]
        );
        const paragraphStyles = getStylesForItem(
            themeObjects.PARAGRAPH,
            theme[themeVariant]
        );
        const buttonStyles = getStylesForItem(
            themeObjects.BUTTON,
            theme[themeVariant]
        );
        const buttonIconStyles = getStylesForItem(
            themeObjects.BUTTON_ICON,
            theme[themeVariant]
        );
        const menuItemStyles = getStylesForItem(
            themeObjects.MENU_ITEM,
            theme[themeVariant]
        );
        const tagStyles = getStylesForItem(
            themeObjects.TAG,
            theme[themeVariant]
        );

        const heading2Styles = getStylesForItem(
            themeObjects.HEADING_2,
            theme[themeVariant]
        );
        const subHeading2Styles = getStylesForItem(
            themeObjects.SUBHEADING_2,
            theme[themeVariant]
        );
        const paragraph2Styles = getStylesForItem(
            themeObjects.PARAGRAPH_2,
            theme[themeVariant]
        );
        const button2Styles = getStylesForItem(
            themeObjects.BUTTON_2,
            theme[themeVariant]
        );
        const buttonIcon2Styles = getStylesForItem(
            themeObjects.BUTTON_ICON_2,
            theme[themeVariant]
        );
        const menuItem2Styles = getStylesForItem(
            themeObjects.MENU_ITEM_2,
            theme[themeVariant]
        );
        const tag2Styles = getStylesForItem(
            themeObjects.TAG_2,
            theme[themeVariant]
        );

        const heading3Styles = getStylesForItem(
            themeObjects.HEADING_3,
            theme[themeVariant]
        );
        const subHeading3Styles = getStylesForItem(
            themeObjects.SUBHEADING_3,
            theme[themeVariant]
        );
        const paragraph3Styles = getStylesForItem(
            themeObjects.PARAGRAPH_3,
            theme[themeVariant]
        );
        const button3Styles = getStylesForItem(
            themeObjects.BUTTON_3,
            theme[themeVariant]
        );
        const buttonIcon3Styles = getStylesForItem(
            themeObjects.BUTTON_ICON_3,
            theme[themeVariant]
        );
        const menuItem3Styles = getStylesForItem(
            themeObjects.MENU_ITEM_3,
            theme[themeVariant]
        );
        const tag3Styles = getStylesForItem(
            themeObjects.TAG_3,
            theme[themeVariant]
        );

        return (
            <div className="flex flex-col space-y-4 p-4">
                <div className="flex flex-row bg-gray-900 p-4 space-x-4 rounded justify-between">
                    <Panel {...styles} scrollable={false} className="rounded">
                        <Panel.Header className={"text-xs uppercase font-bold"}>
                            Panel
                        </Panel.Header>
                        <Panel.Body
                            {...styles}
                            onClick={() => {
                                handleClickItem(themeObjects.PANEL, styles);
                            }}
                        ></Panel.Body>
                        <Panel.Footer
                            className={"text-xs uppercase font-light"}
                        >
                            {getCSSStyleForClassname(
                                "backgroundColor",
                                themeObjects.PANEL
                            )}
                        </Panel.Footer>
                    </Panel>
                    <Panel2
                        className={"rounded"}
                        {...styles2}
                        scrollable={false}
                    >
                        <Panel2.Header
                            className={"text-xs uppercase font-bold"}
                        >
                            Panel 2
                        </Panel2.Header>
                        <Panel2.Body
                            {...styles2}
                            onClick={() => {
                                handleClickItem(themeObjects.PANEL_2, styles2);
                            }}
                        ></Panel2.Body>
                        <Panel2.Footer
                            className={"text-xs uppercase font-light"}
                        >
                            {getCSSStyleForClassname(
                                "backgroundColor",
                                themeObjects.PANEL_2
                            )}
                        </Panel2.Footer>
                    </Panel2>
                    <Panel3
                        className={"rounded"}
                        {...styles3}
                        scrollable={false}
                    >
                        <Panel3.Header
                            className={"text-xs uppercase font-bold"}
                        >
                            Panel 3
                        </Panel3.Header>
                        <Panel3.Body
                            {...styles3}
                            onClick={() => {
                                handleClickItem(themeObjects.PANEL_3, styles3);
                            }}
                        ></Panel3.Body>
                        <Panel3.Footer
                            className={"text-xs uppercase font-light"}
                        >
                            {getCSSStyleForClassname(
                                "backgroundColor",
                                themeObjects.PANEL_3
                            )}
                        </Panel3.Footer>
                    </Panel3>
                </div>

                <Panel
                    className={"p-6 rounded border-4 space-y-4"}
                    scrollable={false}
                    height={"h-fit"}
                    {...styles}
                >
                    <Heading
                        title={"Heading"}
                        {...headingStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(themeObjects.HEADING, headingStyles)
                        }
                    />
                    <Heading2
                        title={"Heading 2"}
                        {...heading2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.HEADING_2,
                                heading2Styles
                            )
                        }
                    />
                    <Heading3
                        title={"Heading 3"}
                        {...heading3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.HEADING_3,
                                heading3Styles
                            )
                        }
                    />
                    <SubHeading
                        title={"Subheading"}
                        {...subHeadingStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING,
                                subHeadingStyles
                            )
                        }
                    />
                    <SubHeading2
                        title={"Subheading 2"}
                        {...subHeading2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING_2,
                                subHeading2Styles
                            )
                        }
                    />
                    <SubHeading3
                        title={"Subheading"}
                        {...subHeading3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING_3,
                                subHeading3Styles
                            )
                        }
                    />
                    <Paragraph
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraphStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH,
                                paragraphStyles
                            )
                        }
                    />
                    <Paragraph2
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraph2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH_2,
                                paragraph2Styles
                            )
                        }
                    />
                    <Paragraph3
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraph3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH_3,
                                paragraph3Styles
                            )
                        }
                    />
                    <div className="flex flex-row space-x-2 w-full">
                        <Button
                            title="Button"
                            {...buttonStyles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON,
                                    buttonStyles
                                )
                            }
                        />
                        <Button2
                            title="Button 2"
                            {...button2Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON_2,
                                    button2Styles
                                )
                            }
                        />
                        <Button3
                            title="Button 3"
                            {...button3Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON_3,
                                    button3Styles
                                )
                            }
                        />
                    </div>
                    <div className="flex flex-row space-x-4 w-full h-fit">
                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon"
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON,
                                        buttonIconStyles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON,
                                        buttonIconStyles
                                    )
                                }
                            />
                        </div>

                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon 2"
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_2,
                                        buttonIcon2Styles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_2,
                                        buttonIcon2Styles
                                    )
                                }
                            />
                        </div>

                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon 3"
                                icon="pencil"
                                {...buttonIcon3Styles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_3,
                                        buttonIcon3Styles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIcon3Styles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_3,
                                        buttonIcon3Styles
                                    )
                                }
                            />
                        </div>
                    </div>
                    <div className="flex flex-col space-y-2 w-full">
                        <MenuItem
                            {...menuItemStyles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM,
                                    menuItemStyles
                                )
                            }
                        >
                            Menu Item
                        </MenuItem>
                        <MenuItem2
                            {...menuItem2Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM_2,
                                    menuItem2Styles
                                )
                            }
                        >
                            Menu Item 2
                        </MenuItem2>
                        <MenuItem3
                            {...menuItem3Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM_3,
                                    menuItem3Styles
                                )
                            }
                        >
                            Menu Item 3
                        </MenuItem3>
                    </div>
                    <div className="flex flex-row space-x-2 w-full">
                        <Tag
                            text="Tag"
                            icon="pencil"
                            {...tagStyles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG, tagStyles)
                            }
                        />
                        <Tag2
                            text="Tag 2"
                            icon="pencil"
                            {...tag2Styles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG_2, tag2Styles)
                            }
                        />
                        <Tag3
                            text="Tag 3"
                            icon="pencil"
                            {...tag3Styles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG_3, tag3Styles)
                            }
                        />
                    </div>
                </Panel>

                <Panel2
                    className={"p-6 rounded border-4 space-y-4"}
                    height={"h-fit"}
                    {...styles2}
                >
                    <Heading
                        title={"Heading"}
                        {...headingStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(themeObjects.HEADING, headingStyles)
                        }
                    />
                    <Heading2
                        title={"Heading 2"}
                        {...heading2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.HEADING_2,
                                heading2Styles
                            )
                        }
                    />
                    <Heading3
                        title={"Heading 3"}
                        {...heading3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.HEADING_3,
                                heading3Styles
                            )
                        }
                    />
                    <SubHeading
                        title={"Subheading"}
                        {...subHeadingStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING,
                                subHeadingStyles
                            )
                        }
                    />
                    <SubHeading2
                        title={"Subheading 2"}
                        {...subHeading2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING_2,
                                subHeading2Styles
                            )
                        }
                    />
                    <SubHeading3
                        title={"Subheading"}
                        {...subHeading3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING_3,
                                subHeading3Styles
                            )
                        }
                    />
                    <Paragraph
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraphStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH,
                                paragraphStyles
                            )
                        }
                    />
                    <Paragraph2
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraph2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH_2,
                                paragraph2Styles
                            )
                        }
                    />
                    <Paragraph3
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraph3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH_3,
                                paragraph3Styles
                            )
                        }
                    />
                    <div className="flex flex-row space-x-2 w-full">
                        <Button
                            title="Button"
                            {...buttonStyles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON,
                                    buttonStyles
                                )
                            }
                        />
                        <Button2
                            title="Button 2"
                            {...button2Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON_2,
                                    button2Styles
                                )
                            }
                        />
                        <Button3
                            title="Button 3"
                            {...button3Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON_3,
                                    button3Styles
                                )
                            }
                        />
                    </div>
                    <div className="flex flex-row space-x-4 w-full">
                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon"
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON,
                                        buttonIconStyles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON,
                                        buttonIconStyles
                                    )
                                }
                            />
                        </div>

                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon 2"
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_2,
                                        buttonIcon2Styles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_2,
                                        buttonIcon2Styles
                                    )
                                }
                            />
                        </div>

                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon 3"
                                icon="pencil"
                                {...buttonIcon3Styles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_3,
                                        buttonIcon3Styles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIcon3Styles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_3,
                                        buttonIcon3Styles
                                    )
                                }
                            />
                        </div>
                    </div>
                    <div className="flex flex-col space-y-2 w-full">
                        <MenuItem
                            {...menuItemStyles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM,
                                    menuItemStyles
                                )
                            }
                        >
                            Menu Item
                        </MenuItem>
                        <MenuItem2
                            {...menuItem2Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM_2,
                                    menuItem2Styles
                                )
                            }
                        >
                            Menu Item 2
                        </MenuItem2>
                        <MenuItem3
                            {...menuItem3Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM_3,
                                    menuItem3Styles
                                )
                            }
                        >
                            Menu Item 3
                        </MenuItem3>
                    </div>
                    <div className="flex flex-row space-x-2 w-full">
                        <Tag
                            text="Tag"
                            icon="pencil"
                            {...tagStyles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG, tagStyles)
                            }
                        />
                        <Tag2
                            text="Tag 2"
                            icon="pencil"
                            {...tag2Styles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG_2, tag2Styles)
                            }
                        />
                        <Tag3
                            text="Tag 3"
                            icon="pencil"
                            {...tag3Styles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG_3, tag3Styles)
                            }
                        />
                    </div>
                </Panel2>

                <Panel3
                    className={"p-6 rounded border-4 space-y-4"}
                    {...styles3}
                    padding={false}
                    height={"h-fit"}
                >
                    <Heading
                        title={"Heading"}
                        {...headingStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(themeObjects.HEADING, headingStyles)
                        }
                    />
                    <Heading2
                        title={"Heading 2"}
                        {...heading2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.HEADING_2,
                                heading2Styles
                            )
                        }
                    />
                    <Heading3
                        title={"Heading 3"}
                        {...heading3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.HEADING_3,
                                heading3Styles
                            )
                        }
                    />
                    <SubHeading
                        title={"Subheading"}
                        {...subHeadingStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING,
                                subHeadingStyles
                            )
                        }
                    />
                    <SubHeading2
                        title={"Subheading 2"}
                        {...subHeading2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING_2,
                                subHeading2Styles
                            )
                        }
                    />
                    <SubHeading3
                        title={"Subheading"}
                        {...subHeading3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING_3,
                                subHeading3Styles
                            )
                        }
                    />
                    <Paragraph
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraphStyles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH,
                                paragraphStyles
                            )
                        }
                    />
                    <Paragraph2
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraph2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH,
                                paragraph2Styles
                            )
                        }
                    />
                    <Paragraph3
                        text={"The quick brown fox jumps over the lazy dog."}
                        {...paragraph3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH_3,
                                paragraph3Styles
                            )
                        }
                    />
                    <div className="flex flex-row space-x-2 w-full">
                        <Button
                            title="Button"
                            {...buttonStyles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON,
                                    buttonStyles
                                )
                            }
                        />
                        <Button2
                            title="Button 2"
                            {...button2Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON_2,
                                    button2Styles
                                )
                            }
                        />
                        <Button3
                            title="Button 3"
                            {...button3Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.BUTTON_3,
                                    button3Styles
                                )
                            }
                        />
                    </div>
                    <div className="flex flex-row space-x-4 w-full">
                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon"
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON,
                                        buttonIconStyles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON,
                                        buttonIconStyles
                                    )
                                }
                            />
                        </div>

                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon 2"
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_2,
                                        buttonIcon2Styles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIconStyles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_2,
                                        buttonIcon2Styles
                                    )
                                }
                            />
                        </div>

                        <div className="flex flex-row space-x-2">
                            <ButtonIcon
                                text="Button Icon 3"
                                icon="pencil"
                                {...buttonIcon3Styles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_3,
                                        buttonIcon3Styles
                                    )
                                }
                            />
                            <ButtonIcon
                                icon="pencil"
                                {...buttonIcon3Styles}
                                onClick={() =>
                                    handleClickItem(
                                        themeObjects.BUTTON_ICON_3,
                                        buttonIcon3Styles
                                    )
                                }
                            />
                        </div>
                    </div>
                    <div className="flex flex-col space-y-2 w-full">
                        <MenuItem
                            {...menuItemStyles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM,
                                    menuItemStyles
                                )
                            }
                        >
                            Menu Item
                        </MenuItem>
                        <MenuItem2
                            {...menuItem2Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM_2,
                                    menuItem2Styles
                                )
                            }
                        >
                            Menu Item 2
                        </MenuItem2>
                        <MenuItem3
                            {...menuItem3Styles}
                            onClick={() =>
                                handleClickItem(
                                    themeObjects.MENU_ITEM_3,
                                    menuItem3Styles
                                )
                            }
                        >
                            Menu Item 3
                        </MenuItem3>
                    </div>
                    <div className="flex flex-row space-x-2 w-full">
                        <Tag
                            text="Tag"
                            icon="pencil"
                            {...tagStyles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG, tagStyles)
                            }
                        />
                        <Tag2
                            text="Tag 2"
                            icon="pencil"
                            {...tag2Styles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG_2, tag2Styles)
                            }
                        />
                        <Tag3
                            text="Tag 3"
                            icon="pencil"
                            {...tag3Styles}
                            onClick={() =>
                                handleClickItem(themeObjects.TAG_3, tag3Styles)
                            }
                        />
                    </div>
                </Panel3>

                <Panel2
                    className={"p-6 rounded border-4 space-y-4"}
                    {...styles2}
                    height={"h-fit"}
                    padding={false}
                >
                    <Heading2
                        title={"Heading 2"}
                        {...heading2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.HEADING_2,
                                heading2Styles
                            )
                        }
                    />
                    <SubHeading2
                        title={"Subheading 2"}
                        {...subHeading2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING_2,
                                subHeading2Styles
                            )
                        }
                    />
                    <Paragraph2
                        text={
                            "Paragraph 2 - The quick brown fox jumps over the lazy dog."
                        }
                        {...paragraph2Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH_2,
                                paragraph2Styles
                            )
                        }
                    />
                    <Button2
                        title="Button"
                        {...button2Styles}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.BUTTON_2,
                                button2Styles
                            )
                        }
                    />
                    <ButtonIcon2
                        text="Button Icon"
                        icon="pencil"
                        {...buttonIcon2Styles}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.BUTTON_ICON_2,
                                buttonIcon2Styles
                            )
                        }
                    />
                    <ButtonIcon2
                        icon="pencil"
                        {...buttonIcon2Styles}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.BUTTON_ICON_2,
                                buttonIconStyles
                            )
                        }
                    />
                    <MenuItem2
                        {...menuItem2Styles}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.MENU_ITEM_2,
                                menuItem2Styles
                            )
                        }
                    >
                        Menu Item
                    </MenuItem2>
                    <Tag2
                        text="Tag 2"
                        icon="pencil"
                        {...tag2Styles}
                        onClick={() =>
                            handleClickItem(themeObjects.TAG_2, tag2Styles)
                        }
                    />
                </Panel2>

                <Panel3
                    className={"p-6 rounded border-4 space-y-4"}
                    {...styles3}
                    height={"h-fit"}
                    padding={false}
                >
                    <Heading3
                        title={"Heading 3"}
                        {...heading3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.HEADING_3,
                                heading3Styles
                            )
                        }
                    />
                    <SubHeading3
                        title={"Subheading"}
                        {...subHeading3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.SUBHEADING_3,
                                subHeading3Styles
                            )
                        }
                    />
                    <Paragraph3
                        text={
                            "Paragraph 3 - The quick brown fox jumps over the lazy dog."
                        }
                        {...paragraph3Styles}
                        padding={false}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.PARAGRAPH_3,
                                paragraph3Styles
                            )
                        }
                    />
                    <Button3
                        title="Button"
                        {...button3Styles}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.BUTTON_3,
                                button3Styles
                            )
                        }
                    />
                    <ButtonIcon3
                        text="Button Icon 3"
                        icon="pencil"
                        {...buttonIcon3Styles}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.BUTTON_ICON_3,
                                buttonIcon3Styles
                            )
                        }
                    />
                    <ButtonIcon3
                        icon="pencil"
                        {...buttonIcon3Styles}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.BUTTON_ICON_3,
                                buttonIcon3Styles
                            )
                        }
                    />
                    <MenuItem3
                        {...menuItem3Styles}
                        onClick={() =>
                            handleClickItem(
                                themeObjects.MENU_ITEM_3,
                                menuItem3Styles
                            )
                        }
                    >
                        Menu Item
                    </MenuItem3>
                    <Tag3
                        text="Tag"
                        icon="pencil"
                        {...tag3Styles}
                        onClick={() =>
                            handleClickItem(themeObjects.TAG_3, tag3Styles)
                        }
                    />
                </Panel3>
            </div>
        );
    }

    return (
        <LayoutContainer scrollable={true} direction="col">
            {renderPanels()}
            {/* <Panel className={"p-10 rounded space-y-4 h-fit"} padding={false}>
                {renderText()}
            </Panel> */}
        </LayoutContainer>
    );
};

export default PreviewComponentsPane;
