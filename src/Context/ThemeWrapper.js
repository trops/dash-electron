import React, { useState, useEffect, useContext, useMemo } from "react";
import { AppContext } from "../Context";
import { ThemeContext } from "@trops/dash-react"; // Use ThemeContext from dash-react, not local
import { ThemeModel } from "../Models";

/**
 * themes
 *
 * This will move into the filesystem as a configuration file
 * The user may also "create new" theme by filling in the color details
 */
const themes = {
    "theme-1": {
        name: "Default 1",
        primary: "gray",
        secondary: "indigo",
        tertiary: "blue",
        shadeBackgroundFrom: 600,
        shadeBorderFrom: 600,
        shadeTextFrom: 100,
        dark: {
            "bg-primary-very-dark": "bg-black", // override test
        },
        light: {
            "bg-primary-very-light": "bg-white", // override test
            "bg-primary-very-dark": "bg-gray-600", // override test
        },
    },
    "theme-2": {
        name: "Default 2",
        primary: "gray",
        secondary: "slate",
        tertiary: "orange",
        shadeBackgroundFrom: 200,
        shadeBorderFrom: 300,
        shadeTextFrom: 700,
        dark: {
            "bg-primary-very-dark": "bg-black", // override test
        },
        light: {
            "bg-primary-very-light": "bg-white", // override test
            "bg-primary-very-dark": "bg-gray-600", // override test
        },
    },
};

export const ThemeWrapper = ({
    theme = null,
    dashApi,
    credentials,
    children,
}) => {
    // changeApplicationTheme will save this to the settings config
    const { changeApplicationTheme, settings } = useContext(AppContext);

    const [chosenTheme, setChosenTheme] = useState(theme);
    const [themeName, setThemeName] = useState(null);
    const [themeVariant, setThemeVariant] = useState("dark");
    const [themesForApplication, setThemesForApplication] = useState(null);
    const [rawThemes, setRawThemes] = useState({});

    const [splashDone, setSplashDone] = useState(false);

    // Minimum splash screen display time
    useEffect(() => {
        const timer = setTimeout(() => setSplashDone(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    // console.log("THEME WRAPPER ", chosenTheme, dashApi, credentials);

    useEffect(() => {
        // If the user has provided a theme as a override,
        // we can skip loading the themes...

        // console.log(
        //     "THEME WRAPPER ",
        //     chosenTheme,
        //     dashApi,
        //     credentials,
        //     themesForApplication
        // );

        if (chosenTheme === null) {
            if (theme !== null) {
                const defaultTheme = ThemeModel(theme);
                setThemeVariant(() => "dark");
                setChosenTheme(() => defaultTheme);
            } else {
                console.log("THEME IS NULL");
                // if the themes for application is null...
                // we have to load the themes...
                if (themesForApplication === null) {
                    // finally
                    console.log("load the themes");
                    loadThemes();
                } else {
                    console.log("THEME HERE");
                    const themeKeyDefault =
                        themesForApplication !== null
                            ? Object.keys(themesForApplication)[0]
                            : "theme-1";
                    const defaultTheme = ThemeModel(
                        themesForApplication !== null
                            ? themesForApplication[themeKeyDefault]
                            : themes[themeKeyDefault]
                    );
                    setThemeVariant(() => "dark");
                    setChosenTheme(() => defaultTheme);
                }
            }
        } else {
            // we have a theme chosen but need to load the application themes overall...
            if (themesForApplication === null) loadThemes();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chosenTheme]);

    // When settings loads (async) after themes are already set,
    // correct the active theme to match the user's saved preference.
    useEffect(() => {
        const savedThemeKey = settings?.theme;
        if (
            savedThemeKey &&
            savedThemeKey !== themeName &&
            themesForApplication &&
            savedThemeKey in themesForApplication
        ) {
            console.log(
                `[ThemeWrapper] Settings loaded with saved theme: ${savedThemeKey}, correcting from: ${themeName}`
            );
            const themeData = themesForApplication[savedThemeKey];
            setChosenTheme(() => themeData);
            setThemeName(() => savedThemeKey);
        }
    }, [settings?.theme, themesForApplication, themeName]);

    /**
     * loadThemes
     * Load in the themes for this application
     */
    function loadThemes() {
        console.log("load themes", dashApi, credentials);
        if (dashApi && credentials) {
            dashApi.listThemes(
                credentials.appId,
                handleLoadThemesComplete,
                handleLoadThemesError
            );
        }
    }

    /**
     * handleLoadThemesComplete
     * Load in the themes saved to the configuration, if no themes
     * exist, then use the default themes provided.
     * @param {*} e
     * @param {*} message
     */
    function handleLoadThemesComplete(e, message) {
        console.log("themes complete", e, message);
        if ("themes" in message) {
            console.log(
                "we have some themes in the message",
                message["themes"]
            );
            checkThemes(message["themes"]);
            // if (theme === null) {
            //     changeCurrentTheme(Object.keys(message["themes"])[0]);
            // }
        }
    }

    function checkThemes(themesToCheck) {
        try {
            let themesChecked = {};
            let rawThemes = {};

            console.log("themes to check ", themesToCheck);

            if (themesToCheck !== null) {
                if (Object.keys(themesToCheck).length === 0) {
                    console.log(
                        "[ThemeWrapper] No themes loaded, using defaults and saving them..."
                    );

                    // Use the default themes and process them with ThemeModel
                    Object.keys(themes).forEach((themeKey) => {
                        const themeObject = ThemeModel(themes[themeKey]);
                        rawThemes[themeKey] = themes[themeKey];
                        themesChecked[themeKey] = themeObject;

                        console.log(
                            `[ThemeWrapper] Generated default theme: ${themeKey}`,
                            {
                                hasLightVariant: "light" in themeObject,
                                hasDarkVariant: "dark" in themeObject,
                                sampleTextColors: themeObject["dark"]
                                    ? Object.keys(themeObject["dark"])
                                          .filter((k) => k.startsWith("text-"))
                                          .slice(0, 5)
                                    : [],
                            }
                        );
                    });

                    setThemesForApplication(() => themesChecked);
                    setRawThemes(() => rawThemes);

                    // Set the saved theme (or first theme) as active
                    if (!chosenTheme && Object.keys(themesChecked).length > 0) {
                        const savedThemeKey = settings?.theme;
                        const activeKey =
                            savedThemeKey && savedThemeKey in themesChecked
                                ? savedThemeKey
                                : Object.keys(themesChecked)[0];
                        const activeTheme = themesChecked[activeKey];
                        console.log(
                            `[ThemeWrapper] Setting default theme as active: ${activeKey}`
                        );
                        setChosenTheme(() => activeTheme);
                        setThemeName(() => activeKey);
                    }

                    // Save the default themes to the file system for next time
                    if (dashApi && credentials && credentials.appId) {
                        Object.keys(themes).forEach((themeKey) => {
                            dashApi.saveTheme(
                                credentials.appId,
                                themeKey,
                                themes[themeKey],
                                () =>
                                    console.log(
                                        `[ThemeWrapper] Saved default theme: ${themeKey}`
                                    ),
                                (error) =>
                                    console.error(
                                        `[ThemeWrapper] Error saving theme ${themeKey}:`,
                                        error
                                    )
                            );
                        });
                    }
                } else {
                    console.log(
                        `[ThemeWrapper] Loading ${
                            Object.keys(themesToCheck).length
                        } saved themes...`
                    );

                    // let's make sure all of the information is there!
                    Object.keys(themesToCheck).forEach((themeKey) => {
                        const themeObject = ThemeModel(themesToCheck[themeKey]);
                        rawThemes[themeKey] = themesToCheck[themeKey];
                        themesChecked[themeKey] = themeObject;

                        console.log(
                            `[ThemeWrapper] Loaded theme: ${themeKey}`,
                            {
                                hasLightVariant: "light" in themeObject,
                                hasDarkVariant: "dark" in themeObject,
                                sampleTextColors: themeObject["dark"]
                                    ? Object.keys(themeObject["dark"])
                                          .filter((k) => k.startsWith("text-"))
                                          .slice(0, 5)
                                    : [],
                            }
                        );
                    });

                    // console.log('themes to check AFTER had keys', themesChecked);

                    // now let's add our default themes as well
                    // if ('theme-1' in themesChecked === false) {
                    //     themesChecked['theme-1'] = ThemeModel(themes['theme-1']);
                    // }
                    // if ('theme-2' in themesChecked === false) {
                    //     themesChecked['theme-2'] = ThemeModel(themes['theme-2']);
                    // }

                    console.log(
                        "themes complete checked ",
                        themesChecked,
                        chosenTheme
                    );
                    setThemesForApplication(() => themesChecked);
                    setRawThemes(() => rawThemes);

                    // Set the saved theme (or first theme) as active
                    if (!chosenTheme && Object.keys(themesChecked).length > 0) {
                        const savedThemeKey = settings?.theme;
                        const activeKey =
                            savedThemeKey && savedThemeKey in themesChecked
                                ? savedThemeKey
                                : Object.keys(themesChecked)[0];
                        const activeTheme = themesChecked[activeKey];
                        console.log(
                            `[ThemeWrapper] Setting loaded theme as active: ${activeKey}`
                        );
                        setChosenTheme(() => activeTheme);
                        setThemeName(() => activeKey);
                    }
                }
            }
        } catch (e) {
            console.log("themes check error ", e);
        }
    }

    function handleLoadThemesError(e, message) {
        console.log("error loading themes ", e, message);
        setThemesForApplication(null);
    }

    const changeCurrentTheme = (themeKey) => {
        if (rawThemes !== null) {
            const themeData = ThemeModel(rawThemes[themeKey]);
            if (themeKey !== null) {
                setChosenTheme(() => themeData);
                setThemeName(() => themeKey);
                changeApplicationTheme(themeKey);
            }
        }
    };

    const changeThemesForApplication = (themes) => {
        checkThemes(themes);
    };

    const changeThemeVariant = (variant) => {
        setThemeVariant(() => variant);
    };

    // Memoize the context value to prevent unnecessary re-renders
    // and ensure consistent state across all consumers
    const contextValue = useMemo(() => {
        try {
            const themeValue =
                chosenTheme !== null
                    ? themeVariant in chosenTheme
                        ? chosenTheme[themeVariant]
                        : null
                    : null;

            return {
                currentTheme: themeValue,
                currentThemeKey: themeName,
                theme: themeValue,
                themeKey: themeName,
                themeVariant,
                changeCurrentTheme,
                changeThemeVariant,
                changeThemesForApplication,
                loadThemes,
                themes: themesForApplication,
                rawThemes,
            };
        } catch (e) {
            console.log(e);
            return {
                currentTheme: null,
                currentThemeKey: null,
                theme: null,
                themeKey: null,
                themeVariant: "dark",
                changeCurrentTheme,
                changeThemeVariant,
                changeThemesForApplication,
                loadThemes,
                themes: null,
                rawThemes: {},
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chosenTheme, themeVariant, themeName, themesForApplication, rawThemes]);

    // Don't render children until theme is loaded AND splash screen minimum time has passed
    if (!chosenTheme || !splashDone) {
        return (
            <div className="flex items-center justify-center w-screen h-screen bg-gray-950">
                <div className="flex flex-col items-center gap-4">
                    <span className="text-white text-2xl font-bold tracking-tight opacity-80">
                        Dash.
                    </span>
                    <div className="w-16 h-0.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gray-500 rounded-full"
                            style={{
                                width: "100%",
                                transform: "scaleX(0)",
                                transformOrigin: "left",
                                animation:
                                    "splashProgress 1.5s ease-out forwards",
                            }}
                        />
                    </div>
                    <style>{`
                        @keyframes splashProgress {
                            0% { transform: scaleX(0); }
                            100% { transform: scaleX(1); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};
