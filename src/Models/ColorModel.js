import colors from "tailwindcss/colors";
import {
    deepCopy,
    capitalizeFirstLetter,
    getStyleName,
} from "@trops/dash-react";

/**
 * Handle all of the data for a color (theme)
 * @param {Object} obj the color object we would like to use to populate the model (optional)
 */
const ColorModel = (obj = {}) => {
    try {
        if (obj) {
            // console.log("cm: ", obj);
            const temp = deepCopy(obj);
            const color = {};

            color.panelType = "panelType" in temp ? temp.panelType : "main";
            color.colorName = "colorName" in temp ? temp.colorName : "white";
            color.colorType =
                "colorType" in temp
                    ? temp.colorType !== undefined && temp.colorType !== null
                        ? temp.colorType
                        : "primary"
                    : "primary";
            color.shade = "shade" in temp ? temp.shade : 500;
            color.variant = "variant" in temp ? temp.variant : "dark";
            color.level = "level" in temp ? temp.level : "light";

            color.objectType = "objectType" in temp ? temp.objectType : "bg";

            color.styleName = getStyleName(color.objectType); //'background';

            /**
             * generate the display name
             */
            color.displayName =
                "displayName" in temp
                    ? temp.name
                    : capitalizeFirstLetter(color.colorName);

            /**
             * Strings for the theme class name and the class to be used in className
             */
            color.themeClass = `${color.objectType}-${color.colorType}-${color.level}`;
            color.class = `${color.objectType}-${color.colorName}-${color.shade}`;

            /**
             * Grab the hex code via tailwind for the tailwind color
             * This may change as we move to hex codes for selection
             */
            color.hex = colors[color.colorName];

            return color;
        }
        return null;
    } catch (e) {
        console.log(e.message);
        return obj;
    }
};

export { ColorModel };
