import React, { useState, useEffect } from "react";
import { Button, Button2, FontAwesomeIcon, InputText } from "@trops/dash-react";
import {
    getThemePresets,
    generateRandomTheme,
    generateHarmonyTheme,
    generateCustomTheme,
    AVAILABLE_COLORS,
    HARMONY_STRATEGIES,
} from "../../../utils/themeGenerator";

// ─── Generate Mode Enum ──────────────────────────────────────────────────

export const GENERATE_MODES = {
    NONE: null,
    PRESETS: "presets",
    COLOR: "color",
    WIZARD: "wizard",
};

// ─── Preset Gallery ──────────────────────────────────────────────────────

const PresetCard = ({ preset, onSelect, selected = false }) => {
    const colors = [preset.primary, preset.secondary, preset.tertiary];
    const swatchClasses = colors.map((c) => `bg-${c}-500`);

    return (
        <div
            className={`flex flex-col gap-2 p-3 rounded-lg cursor-pointer transition-all bg-white/5 hover:bg-white/10 ${
                selected
                    ? "ring-2 ring-blue-500"
                    : "hover:ring-2 hover:ring-blue-500"
            }`}
            onClick={() => onSelect(preset)}
        >
            <div className="flex flex-row gap-1">
                {swatchClasses.map((cls, i) => (
                    <div key={i} className={`h-6 flex-1 rounded ${cls}`} />
                ))}
            </div>
            <span className="text-xs font-medium opacity-70 truncate">
                {preset.name}
            </span>
        </div>
    );
};

export const PresetGallery = ({
    onSelect,
    selectedPresetId = null,
    inline = false,
}) => {
    const presets = getThemePresets();

    return (
        <div
            className={
                inline
                    ? "flex flex-col gap-4"
                    : "flex flex-col gap-4 p-6 overflow-y-auto flex-1 min-h-0"
            }
        >
            <span className="text-sm font-semibold opacity-50">
                Choose a Preset
            </span>
            <div className="grid grid-cols-3 gap-3">
                {presets.map((preset, i) => (
                    <PresetCard
                        key={i}
                        preset={preset}
                        onSelect={onSelect}
                        selected={
                            selectedPresetId != null &&
                            preset.name === selectedPresetId
                        }
                    />
                ))}
            </div>
        </div>
    );
};

// ─── Color Harmony Picker ────────────────────────────────────────────────

const ColorSwatchGrid = ({ value, onChange, label }) => (
    <div className="flex flex-col gap-2">
        <span className="text-xs opacity-50">{label}</span>
        <div className="grid grid-cols-6 gap-2">
            {AVAILABLE_COLORS.map((color) => (
                <div
                    key={color}
                    className={`h-8 rounded cursor-pointer transition-all bg-${color}-500 ${
                        value === color
                            ? "ring-2 ring-white scale-110"
                            : "opacity-70 hover:opacity-100"
                    }`}
                    title={color}
                    onClick={() => onChange(color)}
                />
            ))}
        </div>
    </div>
);

const PreviewSwatch = ({ color, strategy, customColors }) => {
    let colors;
    if (strategy === "custom" && customColors) {
        colors = [
            customColors.primary,
            customColors.secondary,
            customColors.tertiary,
        ];
    } else {
        const theme = generateHarmonyTheme(color, strategy);
        colors = [theme.primary, theme.secondary, theme.tertiary];
    }

    return (
        <div className="flex flex-row gap-2">
            {colors.map((c, i) => (
                <div
                    key={i}
                    className="flex flex-col items-center gap-1 flex-1"
                >
                    <div className={`h-10 w-full rounded bg-${c}-500`} />
                    <span className="text-[10px] opacity-40">{c}</span>
                </div>
            ))}
        </div>
    );
};

export const ColorHarmonyPicker = ({ onGenerate, inline = false }) => {
    const [selectedColor, setSelectedColor] = useState("blue");
    const [secondaryColor, setSecondaryColor] = useState("rose");
    const [tertiaryColor, setTertiaryColor] = useState("amber");
    const [strategy, setStrategy] = useState("complementary");

    const isCustom = strategy === "custom";

    useEffect(() => {
        if (inline) {
            const theme = isCustom
                ? generateCustomTheme(
                      selectedColor,
                      secondaryColor,
                      tertiaryColor
                  )
                : generateHarmonyTheme(selectedColor, strategy);
            onGenerate(theme);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedColor, secondaryColor, tertiaryColor, strategy, inline]);

    function handleGenerate() {
        const theme = isCustom
            ? generateCustomTheme(selectedColor, secondaryColor, tertiaryColor)
            : generateHarmonyTheme(selectedColor, strategy);
        onGenerate(theme);
    }

    return (
        <div
            className={
                inline
                    ? "flex flex-col gap-4"
                    : "flex flex-col gap-4 p-6 overflow-y-auto flex-1 min-h-0"
            }
        >
            <span className="text-sm font-semibold opacity-50">
                Generate from Color
            </span>

            {/* Strategy selection first — determines how many grids appear */}
            <div className="flex flex-col gap-2">
                <span className="text-xs opacity-50">Harmony</span>
                <div className="flex flex-row gap-2 flex-wrap">
                    {HARMONY_STRATEGIES.map((s) => (
                        <button
                            key={s.value}
                            type="button"
                            className={`px-3 py-1.5 rounded text-xs transition-all ${
                                strategy === s.value
                                    ? "bg-blue-600 text-white"
                                    : "bg-white/10 opacity-70 hover:opacity-100"
                            }`}
                            onClick={() => setStrategy(s.value)}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Color grid(s) */}
            {isCustom ? (
                <>
                    <ColorSwatchGrid
                        value={selectedColor}
                        onChange={setSelectedColor}
                        label="Primary"
                    />
                    <ColorSwatchGrid
                        value={secondaryColor}
                        onChange={setSecondaryColor}
                        label="Secondary"
                    />
                    <ColorSwatchGrid
                        value={tertiaryColor}
                        onChange={setTertiaryColor}
                        label="Tertiary"
                    />
                </>
            ) : (
                <ColorSwatchGrid
                    value={selectedColor}
                    onChange={setSelectedColor}
                    label="Base Color"
                />
            )}

            {/* Preview */}
            <div className="flex flex-col gap-2">
                <span className="text-xs opacity-50">Preview</span>
                <PreviewSwatch
                    color={selectedColor}
                    strategy={strategy}
                    customColors={
                        isCustom
                            ? {
                                  primary: selectedColor,
                                  secondary: secondaryColor,
                                  tertiary: tertiaryColor,
                              }
                            : null
                    }
                />
            </div>

            {!inline && (
                <Button
                    title="Generate Theme"
                    onClick={handleGenerate}
                    size="sm"
                />
            )}
        </div>
    );
};

// ─── Wizard Components ──────────────────────────────────────────────────

const MethodCard = ({ icon, title, subtitle, selected, onClick }) => {
    return (
        <div
            className={`flex flex-col gap-1.5 p-3 rounded-lg cursor-pointer transition-all bg-white/5 hover:bg-white/10 ${
                selected
                    ? "ring-2 ring-blue-500 bg-white/10"
                    : "hover:ring-1 hover:ring-white/20"
            }`}
            onClick={onClick}
        >
            <div className="flex flex-row items-center gap-2">
                <FontAwesomeIcon
                    icon={icon}
                    className={`h-3.5 w-3.5 ${
                        selected ? "text-blue-400" : "opacity-50"
                    }`}
                />
                <span className="text-sm font-medium">{title}</span>
            </div>
            <span className="text-xs opacity-40">{subtitle}</span>
        </div>
    );
};

const RandomPreview = ({ theme, onRegenerate }) => {
    const colors = theme
        ? [theme.primary, theme.secondary, theme.tertiary]
        : [];

    return (
        <div className="flex flex-col gap-4">
            <span className="text-sm font-semibold opacity-50">Preview</span>
            {theme && (
                <div className="flex flex-row gap-2">
                    {colors.map((c, i) => (
                        <div
                            key={i}
                            className="flex flex-col items-center gap-1 flex-1"
                        >
                            <div
                                className={`h-10 w-full rounded bg-${c}-500`}
                            />
                            <span className="text-[10px] opacity-40">{c}</span>
                        </div>
                    ))}
                </div>
            )}
            <Button title="Regenerate" onClick={onRegenerate} size="sm" />
        </div>
    );
};

export const ThemeQuickCreate = ({
    wizardName,
    setWizardName,
    wizardMethod,
    setWizardMethod,
    wizardTheme,
    setWizardTheme,
    onComplete,
}) => {
    const canCreate = wizardName.trim().length > 0 && wizardTheme !== null;

    function handleMethodSelect(method) {
        setWizardMethod(method);
        setWizardTheme(null);
        if (method === "random") {
            setWizardTheme(generateRandomTheme());
        }
    }

    return (
        <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1 min-h-0">
            {/* Name */}
            <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold opacity-50">
                    Name Your Theme
                </span>
                <InputText
                    value={wizardName}
                    onChange={(val) => setWizardName(val)}
                    placeholder="Theme name..."
                />
            </div>

            {/* Method Selection */}
            <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold opacity-50">
                    Generation Method
                </span>
                <div className="grid grid-cols-2 gap-2">
                    <MethodCard
                        icon="swatchbook"
                        title="Presets"
                        subtitle="Choose from curated palettes"
                        selected={wizardMethod === "presets"}
                        onClick={() => handleMethodSelect("presets")}
                    />
                    <MethodCard
                        icon="shuffle"
                        title="Random"
                        subtitle="Generate a random palette"
                        selected={wizardMethod === "random"}
                        onClick={() => handleMethodSelect("random")}
                    />
                </div>
                <MethodCard
                    icon="droplet"
                    title="From Color"
                    subtitle="Build from a base color with harmony rules"
                    selected={wizardMethod === "color"}
                    onClick={() => handleMethodSelect("color")}
                />
            </div>

            {/* Conditional Options */}
            {wizardMethod === "presets" && (
                <PresetGallery
                    onSelect={(preset) => setWizardTheme(preset)}
                    selectedPresetId={wizardTheme?.name}
                    inline={true}
                />
            )}
            {wizardMethod === "random" && (
                <RandomPreview
                    theme={wizardTheme}
                    onRegenerate={() => setWizardTheme(generateRandomTheme())}
                />
            )}
            {wizardMethod === "color" && (
                <ColorHarmonyPicker
                    onGenerate={(theme) => setWizardTheme(theme)}
                    inline={true}
                />
            )}

            {/* Create Button */}
            <Button2
                title="Create Theme"
                onClick={onComplete}
                disabled={!canCreate}
                block={true}
            />
        </div>
    );
};
