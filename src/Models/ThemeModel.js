/**
 * ThemeModel
 *
 */
import { deepCopy, colorTypes } from "@trops/dash-react";

/**
 * getNextLevel
 * Need to generate the levels for tailwind
 * @param {int} currentLevel
 */
function getNextLevel(currentLevel) {
    const next = currentLevel + 100;
    return next <= 900 ? next : currentLevel;
}

function invert(shade) {
    return 900 - parseInt(shade, 10);
}

export const ThemeModel = (themeItem = {}) => {
    try {
        const obj = deepCopy(themeItem);

        const overrideDark = "dark" in themeItem ? themeItem["dark"] : null;
        const overrideLight = "light" in themeItem ? themeItem["light"] : null;

        const theme = {};

        theme.id = "id" in obj ? obj["id"] : null;
        theme.name = "name" in obj ? obj["name"] : "My Theme";

        // for each of the color types we should set...
        colorTypes.forEach((type) => {
            theme[type] = type in obj ? obj[type] : "gray";
        });

        // theme.primary = 'primary' in obj ? obj['primary'] : 'gray';
        // theme.secondary = 'secondary' in obj ? obj['secondary'] : 'blue';
        // theme.tertiary = 'tertiary' in obj ? obj['tertiary'] : 'indigo';

        theme.shadeFrom = "shadeFrom" in obj ? obj["shadeFrom"] : 100;

        // unused from
        theme.shadeBackgroundFrom =
            "shadeBackgroundFrom" in obj ? obj["shadeBackgroundFrom"] : 100;
        theme.shadeTextFrom =
            "shadeTextFrom" in obj ? obj["shadeTextFrom"] : 100;
        theme.shadeBorderFrom =
            "shadeBorderFrom" in obj ? obj["shadeBorderFrom"] : 100;
        theme.shadeTo = "shadeTo" in obj ? obj["shadeTo"] : 700;

        // somehow generate the colors based on the theme inputs...
        // light, medium, dark for each?
        // example: bg-primary-light, bg-primary-medium, bg-primary-dark,

        const variants = {
            light: {
                "very-light": 100,
                light: 200,
                medium: 300,
                dark: 400,
                "very-dark": 500,
            },
            dark: {
                "very-light": 500,
                light: 600,
                medium: 700,
                dark: 800,
                "very-dark": 900,
            },
        };

        // iterate over each color type "primary, secondary, tertiary ..."
        // and generate the colors necessary (shades) based on tailwind
        colorTypes.forEach((type) => {
            Object.keys(variants).forEach((variant) => {
                if (variant in theme === false) {
                    theme[variant] = {};
                }
                Object.keys(variants[variant]).forEach((shade) => {
                    theme[variant][
                        `bg-${type}-${shade}`
                    ] = `bg-${theme[type]}-${variants[variant][shade]}`;
                    theme[variant][`hover-bg-${type}-${shade}`] = `hover:bg-${
                        theme[type]
                    }-${getNextLevel(variants[variant][shade])}`;
                    theme[variant][
                        `hover-border-${type}-${shade}`
                    ] = `hover:border-${theme[type]}-${getNextLevel(
                        variants[variant][shade]
                    )}`;
                    theme[variant][
                        `border-${type}-${shade}`
                    ] = `border-${theme[type]}-${variants[variant][shade]}`;
                    // we should be "flipping" these so dark text on light and light on dark...
                    theme[variant][`text-${type}-${shade}`] = `text-${
                        theme[type]
                    }-${invert(variants[variant][shade])}`;
                    theme[variant][
                        `hover-text-${type}-${shade}`
                    ] = `hover:text-${theme[type]}-${invert(
                        variants[variant][shade]
                    )}`;
                });
            });
        });

        // lets try gradients

        // Primary

        theme["dark"][
            "bg-primary-gradient-right"
        ] = `bg-gradient-to-r from-${theme.primary}-${variants["dark"]["medium"]} via-${theme.primary}-${variants["dark"]["medium"]} to-${theme.primary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-primary-gradient-bottom"
        ] = `bg-gradient-to-b from-${theme.primary}-${variants["dark"]["medium"]} via-${theme.primary}-${variants["dark"]["medium"]} to-${theme.primary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-primary-gradient-bottom-right"
        ] = `bg-gradient-to-br from-${theme.primary}-${variants["dark"]["medium"]} via-${theme.primary}-${variants["dark"]["medium"]} to-${theme.primary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-primary-gradient-bottom-left"
        ] = `bg-gradient-to-bl from-${theme.primary}-${variants["dark"]["medium"]} via-${theme.primary}-${variants["dark"]["medium"]} to-${theme.primary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-primary-gradient-left"
        ] = `bg-gradient-to-l from-${theme.primary}-${variants["dark"]["medium"]} via-${theme.primary}-${variants["dark"]["medium"]} to-${theme.primary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-primary-gradient-top"
        ] = `bg-gradient-to-t from-${theme.primary}-${variants["dark"]["medium"]} via-${theme.primary}-${variants["dark"]["medium"]} to-${theme.primary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-primary-gradient-top-right"
        ] = `bg-gradient-to-tr from-${theme.primary}-${variants["dark"]["medium"]} via-${theme.primary}-${variants["dark"]["medium"]} to-${theme.primary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-primary-gradient-top-left"
        ] = `bg-gradient-to-tl from-${theme.primary}-${variants["dark"]["medium"]} via-${theme.primary}-${variants["dark"]["medium"]} to-${theme.primary}-${variants["dark"]["dark"]}`;

        theme["light"][
            "bg-primary-gradient-right"
        ] = `bg-gradient-to-r from-${theme.primary}-${variants["light"]["medium"]} via-${theme.primary}-${variants["light"]["medium"]} to-${theme.primary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-primary-gradient-bottom"
        ] = `bg-gradient-to-b from-${theme.primary}-${variants["light"]["medium"]} via-${theme.primary}-${variants["light"]["medium"]} to-${theme.primary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-primary-gradient-left"
        ] = `bg-gradient-to-l from-${theme.primary}-${variants["light"]["medium"]} via-${theme.primary}-${variants["light"]["medium"]} to-${theme.primary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-primary-gradient-top"
        ] = `bg-gradient-to-t from-${theme.primary}-${variants["light"]["medium"]} via-${theme.primary}-${variants["light"]["medium"]} to-${theme.primary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-primary-gradient-top-right"
        ] = `bg-gradient-to-tr from-${theme.primary}-${variants["light"]["medium"]} via-${theme.primary}-${variants["light"]["medium"]} to-${theme.primary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-primary-gradient-bottom-right"
        ] = `bg-gradient-to-br from-${theme.primary}-${variants["light"]["medium"]} via-${theme.primary}-${variants["light"]["medium"]} to-${theme.primary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-primary-gradient-top-left"
        ] = `bg-gradient-to-tl from-${theme.primary}-${variants["light"]["medium"]} via-${theme.primary}-${variants["light"]["medium"]} to-${theme.primary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-primary-gradient-bottom-left"
        ] = `bg-gradient-to-bl from-${theme.primary}-${variants["light"]["medium"]} via-${theme.primary}-${variants["light"]["medium"]} to-${theme.primary}-${variants["light"]["dark"]}`;

        // Secondary

        theme["dark"][
            "bg-secondary-gradient-right"
        ] = `bg-gradient-to-r from-${theme.secondary}-${variants["dark"]["medium"]} via-${theme.secondary}-${variants["dark"]["medium"]} to-${theme.secondary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-secondary-gradient-bottom"
        ] = `bg-gradient-to-b from-${theme.secondary}-${variants["dark"]["medium"]} via-${theme.secondary}-${variants["dark"]["medium"]} to-${theme.secondary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-secondary-gradient-bottom-right"
        ] = `bg-gradient-to-br from-${theme.secondary}-${variants["dark"]["medium"]} via-${theme.secondary}-${variants["dark"]["medium"]} to-${theme.secondary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-secondary-gradient-bottom-left"
        ] = `bg-gradient-to-bl from-${theme.secondary}-${variants["dark"]["medium"]} via-${theme.secondary}-${variants["dark"]["medium"]} to-${theme.secondary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-secondary-gradient-left"
        ] = `bg-gradient-to-l from-${theme.secondary}-${variants["dark"]["medium"]} via-${theme.secondary}-${variants["dark"]["medium"]} to-${theme.secondary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-secondary-gradient-top"
        ] = `bg-gradient-to-t from-${theme.secondary}-${variants["dark"]["medium"]} via-${theme.secondary}-${variants["dark"]["medium"]} to-${theme.secondary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-secondary-gradient-top-right"
        ] = `bg-gradient-to-tr from-${theme.secondary}-${variants["dark"]["medium"]} via-${theme.secondary}-${variants["dark"]["medium"]} to-${theme.secondary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-secondary-gradient-top-left"
        ] = `bg-gradient-to-tl from-${theme.secondary}-${variants["dark"]["medium"]} via-${theme.secondary}-${variants["dark"]["medium"]} to-${theme.secondary}-${variants["dark"]["dark"]}`;

        theme["light"][
            "bg-secondary-gradient-right"
        ] = `bg-gradient-to-r from-${theme.secondary}-${variants["light"]["medium"]} via-${theme.secondary}-${variants["light"]["medium"]} to-${theme.secondary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-secondary-gradient-bottom"
        ] = `bg-gradient-to-b from-${theme.secondary}-${variants["light"]["medium"]}  via-${theme.secondary}-${variants["light"]["medium"]} to-${theme.secondary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-secondary-gradient-left"
        ] = `bg-gradient-to-l from-${theme.secondary}-${variants["light"]["medium"]} via-${theme.secondary}-${variants["light"]["medium"]} to-${theme.secondary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-secondary-gradient-top"
        ] = `bg-gradient-to-t from-${theme.secondary}-${variants["light"]["medium"]} via-${theme.secondary}-${variants["light"]["medium"]} to-${theme.secondary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-secondary-gradient-top-right"
        ] = `bg-gradient-to-tr from-${theme.secondary}-${variants["light"]["medium"]} via-${theme.secondary}-${variants["light"]["medium"]} to-${theme.secondary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-secondary-gradient-bottom-right"
        ] = `bg-gradient-to-br from-${theme.secondary}-${variants["light"]["medium"]} via-${theme.secondary}-${variants["light"]["medium"]} to-${theme.secondary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-secondary-gradient-top-left"
        ] = `bg-gradient-to-tl from-${theme.secondary}-${variants["light"]["medium"]} via-${theme.secondary}-${variants["light"]["medium"]} to-${theme.secondary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-secondary-gradient-bottom-left"
        ] = `bg-gradient-to-bl from-${theme.secondary}-${variants["light"]["medium"]} via-${theme.secondary}-${variants["light"]["medium"]} to-${theme.secondary}-${variants["light"]["dark"]}`;

        // Tertiary

        theme["dark"][
            "bg-tertiary-gradient-right"
        ] = `bg-gradient-to-r from-${theme.tertiary}-${variants["dark"]["medium"]} via-${theme.tertiary}-${variants["dark"]["medium"]} to-${theme.tertiary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-tertiary-gradient-bottom"
        ] = `bg-gradient-to-b from-${theme.tertiary}-${variants["dark"]["medium"]} via-${theme.tertiary}-${variants["dark"]["medium"]} to-${theme.tertiary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-tertiary-gradient-bottom-right"
        ] = `bg-gradient-to-br from-${theme.tertiary}-${variants["dark"]["medium"]} via-${theme.tertiary}-${variants["dark"]["medium"]} to-${theme.tertiary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-tertiary-gradient-bottom-left"
        ] = `bg-gradient-to-bl from-${theme.tertiary}-${variants["dark"]["medium"]} via-${theme.tertiary}-${variants["dark"]["medium"]} to-${theme.tertiary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-tertiary-gradient-left"
        ] = `bg-gradient-to-l from-${theme.tertiary}-${variants["dark"]["medium"]} via-${theme.tertiary}-${variants["dark"]["medium"]} to-${theme.tertiary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-tertiary-gradient-top"
        ] = `bg-gradient-to-t from-${theme.tertiary}-${variants["dark"]["medium"]} via-${theme.tertiary}-${variants["dark"]["medium"]} to-${theme.tertiary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-tertiary-gradient-top-right"
        ] = `bg-gradient-to-tr from-${theme.tertiary}-${variants["dark"]["medium"]} via-${theme.tertiary}-${variants["dark"]["medium"]} to-${theme.tertiary}-${variants["dark"]["dark"]}`;
        theme["dark"][
            "bg-tertiary-gradient-top-left"
        ] = `bg-gradient-to-tl from-${theme.tertiary}-${variants["dark"]["medium"]} via-${theme.tertiary}-${variants["dark"]["medium"]} to-${theme.tertiary}-${variants["dark"]["dark"]}`;

        theme["light"][
            "bg-tertiary-gradient-right"
        ] = `bg-gradient-to-r from-${theme.tertiary}-${variants["light"]["medium"]} via-${theme.tertiary}-${variants["light"]["medium"]} to-${theme.tertiary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-tertiary-gradient-bottom"
        ] = `bg-gradient-to-b from-${theme.tertiary}-${variants["light"]["medium"]} via-${theme.tertiary}-${variants["light"]["medium"]} to-${theme.tertiary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-tertiary-gradient-left"
        ] = `bg-gradient-to-l from-${theme.tertiary}-${variants["light"]["medium"]} via-${theme.tertiary}-${variants["light"]["medium"]} to-${theme.tertiary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-tertiary-gradient-top"
        ] = `bg-gradient-to-t from-${theme.tertiary}-${variants["light"]["medium"]} via-${theme.tertiary}-${variants["light"]["medium"]} to-${theme.tertiary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-tertiary-gradient-top-right"
        ] = `bg-gradient-to-tr from-${theme.tertiary}-${variants["light"]["medium"]} via-${theme.tertiary}-${variants["light"]["medium"]} to-${theme.tertiary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-tertiary-gradient-bottom-right"
        ] = `bg-gradient-to-br from-${theme.tertiary}-${variants["light"]["medium"]} via-${theme.tertiary}-${variants["light"]["medium"]} to-${theme.tertiary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-tertiary-gradient-top-left"
        ] = `bg-gradient-to-tl from-${theme.tertiary}-${variants["light"]["medium"]} via-${theme.tertiary}-${variants["light"]["medium"]} to-${theme.tertiary}-${variants["light"]["dark"]}`;
        theme["light"][
            "bg-tertiary-gradient-bottom-left"
        ] = `bg-gradient-to-bl from-${theme.tertiary}-${variants["light"]["medium"]} via-${theme.tertiary}-${variants["light"]["medium"]} to-${theme.tertiary}-${variants["light"]["dark"]}`;

        // now for the overrides!
        if (overrideDark !== null) {
            Object.keys(overrideDark).forEach((key) => {
                theme["dark"][key] = overrideDark[key];
            });
        }

        if (overrideLight !== null) {
            Object.keys(overrideLight).forEach((key) => {
                theme["light"][key] = overrideLight[key];
            });
        }

        // Primary, secondary, etc..
        theme["light"]["name"] = theme.name;

        colorTypes.forEach((type) => {
            theme["light"][type] = theme[type];
        });

        colorTypes.forEach((type) => {
            theme["dark"][type] = theme[type];
        });

        theme["dark"]["name"] = theme.name;

        // transparent colors
        theme["dark"]["bg-none"] = "bg-transparent";
        theme["dark"]["border-none"] = "border-transparent";
        theme["dark"]["hover-border-none"] = "hover:border-transparent";
        theme["dark"]["hover-bg-none"] = "hover:bg-transparent";
        theme["dark"]["hover-text-none"] = "hover:text-transparent";

        theme["light"]["bg-none"] = "bg-transparent";
        theme["light"]["border-none"] = "border-transparent";
        theme["light"]["hover-border-none"] = "hover:border-transparent";
        theme["light"]["hover-bg-none"] = "hover:bg-transparent";
        theme["light"]["hover-text-none"] = "hover:text-transparent";

        return theme;
    } catch (e) {
        console.log("ThemeModel ", e.message);
        return {};
    }
};
