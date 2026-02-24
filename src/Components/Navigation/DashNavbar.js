import React, { useContext } from "react";
import { Navbar, ButtonIcon, ThemeContext } from "@trops/dash-react";

export const DashNavbar = ({
    onOpenCommandPalette = null,
    onOpenThemeManager = null,
    onOpenSettings = null,
    onToggleThemeVariant = null,
    themeVariant = "dark",
}) => {
    const { currentTheme } = useContext(ThemeContext);

    return (
        <Navbar border={true} position="top" height="h-12" padding="px-3 py-1">
            <Navbar.Brand>
                <span className="font-bold text-lg tracking-tight opacity-80">
                    Dash.
                </span>
            </Navbar.Brand>

            <Navbar.Content align="center">
                <button
                    type="button"
                    onClick={onOpenCommandPalette}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border opacity-50 hover:opacity-80 transition-opacity cursor-pointer ${
                        currentTheme
                            ? `${
                                  currentTheme["border-primary-medium"] ||
                                  "border-gray-600"
                              } ${
                                  currentTheme["text-primary-light"] ||
                                  "text-gray-300"
                              }`
                            : "border-gray-600 text-gray-300"
                    }`}
                >
                    <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                    <span>Search commands...</span>
                    <kbd className="text-xs opacity-60 font-mono ml-4">⌘K</kbd>
                </button>
            </Navbar.Content>

            <Navbar.Actions>
                <ButtonIcon
                    icon={themeVariant === "dark" ? "sun" : "moon"}
                    onClick={onToggleThemeVariant}
                    size="sm"
                />
                <ButtonIcon
                    icon="palette"
                    onClick={onOpenThemeManager}
                    size="sm"
                />
                <ButtonIcon icon="cog" onClick={onOpenSettings} size="sm" />
            </Navbar.Actions>
        </Navbar>
    );
};
