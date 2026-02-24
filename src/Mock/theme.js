import { ThemeModel } from "../Models";

export const themes = {
    "theme-1": {
        name: "Default 1",
        primary: "gray",
        secondary: "indigo",
        tertiary: "blue",
        shadeBackgroundFrom: 600,
        shadeBorderFrom: 600,
        shadeTextFrom: 100,
    },
    "theme-2": {
        name: "Default 2",
        primary: "gray",
        secondary: "slate",
        tertiary: "orange",
        shadeBackgroundFrom: 200,
        shadeBorderFrom: 300,
        shadeTextFrom: 700,
    },
};

// Generate proper theme object using ThemeModel
const generatedTheme = ThemeModel(themes["theme-1"]);

export const mockThemeContext = {
    key: Date.now(),
    currentTheme: generatedTheme["dark"],
    currentThemeKey: "theme-1",
    theme: generatedTheme["dark"],
    themeKey: "theme-1",
    themeVariant: "dark",
    changeCurrentTheme: function () {},
    changeThemeVariant: function () {},
    changeThemesForApplication: function () {},
    loadThemes: function () {},
    themes,
    rawThemes: themes,
    generatedThemes: {
        "theme-1": generatedTheme,
        "theme-2": ThemeModel(themes["theme-2"]),
    },
};
