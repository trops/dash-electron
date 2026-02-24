import React, { useState, useContext, useEffect } from "react";
import {
    Sidebar,
    Switch,
    ThemeContext,
    getStylesForItem,
    themeObjects,
    FontAwesomeIcon,
} from "@trops/dash-react";
import { SectionLayout } from "../SectionLayout";
import { ThemeDetail } from "../details/ThemeDetail";
import { generateRandomTheme } from "../../../utils/themeGenerator";
import {
    ThemeQuickCreate,
    PresetGallery,
    ColorHarmonyPicker,
    GENERATE_MODES,
} from "../../Theme/Wizard";

// ─── Main Component ──────────────────────────────────────────────────────

export const ThemesSection = ({
    onOpenThemeEditor = null,
    dashApi = null,
    credentials = null,
    createRequested = false,
    onCreateAcknowledged = null,
}) => {
    const {
        themes,
        themeKey: currentThemeKey,
        themeVariant,
        changeCurrentTheme,
        changeThemeVariant,
        changeThemesForApplication,
        currentTheme,
    } = useContext(ThemeContext);

    const [selectedThemeKey, setSelectedThemeKey] = useState(currentThemeKey);
    const [generateMode, setGenerateMode] = useState(GENERATE_MODES.NONE);
    const [wizardName, setWizardName] = useState("");
    const [wizardMethod, setWizardMethod] = useState(null);
    const [wizardTheme, setWizardTheme] = useState(null);

    const themeEntries = themes ? Object.entries(themes) : [];
    const appId = credentials?.appId;

    // Handle create request from parent — enter wizard mode
    useEffect(() => {
        if (createRequested) {
            setGenerateMode(GENERATE_MODES.WIZARD);
            setWizardName("");
            setWizardMethod(null);
            setWizardTheme(null);
            setSelectedThemeKey(null);
            onCreateAcknowledged && onCreateAcknowledged();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createRequested]);

    function handleCreateFromPreset(preset) {
        if (!dashApi || !appId) return;
        const key = preset.id || `theme-${Date.now()}`;
        preset.id = key;
        saveAndSelectTheme(key, preset);
        setGenerateMode(GENERATE_MODES.NONE);
    }

    function handleCreateFromRandom() {
        if (!dashApi || !appId) return;
        const theme = generateRandomTheme();
        const key = theme.id;
        saveAndSelectTheme(key, theme);
    }

    function handleCreateFromHarmony(theme) {
        if (!dashApi || !appId) return;
        const key = theme.id;
        saveAndSelectTheme(key, theme);
        setGenerateMode(GENERATE_MODES.NONE);
    }

    function handleWizardComplete() {
        if (!wizardTheme || !wizardName.trim()) return;
        if (!dashApi || !appId) return;
        const key = wizardTheme.id || `theme-${Date.now()}`;
        const finalTheme = { ...wizardTheme, id: key, name: wizardName.trim() };
        saveAndSelectTheme(key, finalTheme);
    }

    function saveAndSelectTheme(key, rawTheme) {
        dashApi.saveTheme(
            appId,
            key,
            rawTheme,
            (e, message) => {
                if (message && message.themes) {
                    changeThemesForApplication(message.themes);
                }
                setSelectedThemeKey(key);
                setGenerateMode(GENERATE_MODES.NONE);
            },
            (e, err) => {
                console.error("Error saving theme:", err);
            }
        );
    }

    function handleDeleteTheme(key) {
        if (!dashApi || !appId) return;
        if (key === currentThemeKey) {
            const otherKey = themeEntries.find(([k]) => k !== key)?.[0];
            if (otherKey) {
                changeCurrentTheme(otherKey);
            } else {
                return;
            }
        }

        dashApi.deleteTheme(
            appId,
            key,
            (e, message) => {
                if (message && message.themes) {
                    changeThemesForApplication(message.themes);
                }
                if (selectedThemeKey === key) {
                    setSelectedThemeKey(null);
                }
            },
            (e, err) => {
                console.error("Error deleting theme:", err);
            }
        );
    }

    function handleToggleVariant(isDark) {
        changeThemeVariant(isDark ? "dark" : "light");
    }

    function handleActivate(key) {
        changeCurrentTheme(key);
    }

    function handleEdit() {
        if (onOpenThemeEditor) onOpenThemeEditor();
    }

    const rowStyles = getStylesForItem(
        themeObjects.PANEL_HEADER,
        currentTheme,
        { grow: false }
    );

    const listContent = (
        <div className="flex flex-col">
            {/* Variant toggle at top of list */}
            <div
                className={`flex flex-row items-center justify-between px-3 py-3 border-b ${
                    rowStyles.borderColor || ""
                }`}
            >
                <div className="flex flex-row items-center gap-2">
                    <FontAwesomeIcon
                        icon="sun"
                        className="h-3 w-3 opacity-50"
                    />
                    <Switch
                        checked={themeVariant === "dark"}
                        onChange={handleToggleVariant}
                    />
                    <FontAwesomeIcon
                        icon="moon"
                        className="h-3 w-3 opacity-50"
                    />
                </div>
                <span className="text-xs opacity-50">
                    {themeVariant === "dark" ? "Dark" : "Light"}
                </span>
            </div>

            {/* Generate options */}
            {dashApi && appId && (
                <div
                    className={`flex flex-col gap-1 px-2 py-3 border-b ${
                        rowStyles.borderColor || ""
                    }`}
                >
                    <span className="text-[10px] font-semibold opacity-30 uppercase tracking-wider px-2 pb-1">
                        Generate
                    </span>
                    <Sidebar.Item
                        icon={
                            <FontAwesomeIcon
                                icon="swatchbook"
                                className="h-3 w-3"
                            />
                        }
                        active={generateMode === GENERATE_MODES.PRESETS}
                        onClick={() => {
                            setGenerateMode(GENERATE_MODES.PRESETS);
                            setSelectedThemeKey(null);
                        }}
                        className={
                            generateMode === GENERATE_MODES.PRESETS
                                ? "bg-white/10 opacity-100"
                                : ""
                        }
                    >
                        From Presets
                    </Sidebar.Item>
                    <Sidebar.Item
                        icon={
                            <FontAwesomeIcon
                                icon="shuffle"
                                className="h-3 w-3"
                            />
                        }
                        onClick={handleCreateFromRandom}
                    >
                        Random
                    </Sidebar.Item>
                    <Sidebar.Item
                        icon={
                            <FontAwesomeIcon
                                icon="droplet"
                                className="h-3 w-3"
                            />
                        }
                        active={generateMode === GENERATE_MODES.COLOR}
                        onClick={() => {
                            setGenerateMode(GENERATE_MODES.COLOR);
                            setSelectedThemeKey(null);
                        }}
                        className={
                            generateMode === GENERATE_MODES.COLOR
                                ? "bg-white/10 opacity-100"
                                : ""
                        }
                    >
                        From Color
                    </Sidebar.Item>
                </div>
            )}

            {/* Theme list */}
            <Sidebar.Content>
                {themeEntries.map(([key, theme]) => {
                    const isActive = key === currentThemeKey;
                    const isSelected =
                        selectedThemeKey === key &&
                        generateMode === GENERATE_MODES.NONE;
                    return (
                        <Sidebar.Item
                            key={key}
                            icon={
                                isActive ? (
                                    <FontAwesomeIcon
                                        icon="check"
                                        className="h-3 w-3 text-green-500"
                                    />
                                ) : (
                                    <FontAwesomeIcon
                                        icon="palette"
                                        className="h-3.5 w-3.5"
                                    />
                                )
                            }
                            active={isSelected}
                            onClick={() => {
                                setSelectedThemeKey(key);
                                setGenerateMode(GENERATE_MODES.NONE);
                            }}
                            badge={isActive ? "active" : null}
                            className={
                                isSelected ? "bg-white/10 opacity-100" : ""
                            }
                        >
                            {theme.name || key}
                        </Sidebar.Item>
                    );
                })}
                {themeEntries.length === 0 && (
                    <span className="text-sm opacity-40 py-8 text-center">
                        No themes available
                    </span>
                )}
            </Sidebar.Content>
        </div>
    );

    // Determine detail content based on mode
    let detailContent = null;

    if (generateMode === GENERATE_MODES.WIZARD) {
        detailContent = (
            <ThemeQuickCreate
                wizardName={wizardName}
                setWizardName={setWizardName}
                wizardMethod={wizardMethod}
                setWizardMethod={setWizardMethod}
                wizardTheme={wizardTheme}
                setWizardTheme={setWizardTheme}
                onComplete={handleWizardComplete}
            />
        );
    } else if (generateMode === GENERATE_MODES.PRESETS) {
        detailContent = <PresetGallery onSelect={handleCreateFromPreset} />;
    } else if (generateMode === GENERATE_MODES.COLOR) {
        detailContent = (
            <ColorHarmonyPicker onGenerate={handleCreateFromHarmony} />
        );
    } else if (selectedThemeKey && themes && themes[selectedThemeKey]) {
        detailContent = (
            <ThemeDetail
                themeKey={selectedThemeKey}
                themes={themes}
                currentThemeKey={currentThemeKey}
                themeVariant={themeVariant}
                onActivate={handleActivate}
                onOpenThemeEditor={handleEdit}
                onDelete={handleDeleteTheme}
            />
        );
    }

    return (
        <SectionLayout
            listContent={listContent}
            detailContent={detailContent}
            emptyDetailMessage="Select a theme to view details"
        />
    );
};
