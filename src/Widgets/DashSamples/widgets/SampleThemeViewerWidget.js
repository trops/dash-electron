/**
 * SampleThemeViewerWidget
 *
 * Demonstrates reading ThemeContext from @trops/dash-react and the
 * useDashboard() hook. Displays current theme values and app info.
 *
 * @package DashSamples
 */
import { useContext } from "react";
import { Panel, SubHeading2, ThemeContext } from "@trops/dash-react";
import { Widget, useDashboard } from "@trops/dash-core";

const SAMPLE_THEME_KEYS = [
    "bg-primary-dark",
    "bg-primary-medium",
    "bg-primary-light",
    "text-primary-dark",
    "text-primary-medium",
    "text-primary-light",
    "border-primary-dark",
    "border-primary-medium",
    "border-primary-light",
    "bg-accent-primary",
    "text-accent-primary",
];

function SampleThemeViewerContent({ title }) {
    const { currentTheme, themeVariant } = useContext(ThemeContext);
    const { app } = useDashboard();

    const themeKeyCount = currentTheme ? Object.keys(currentTheme).length : 0;

    return (
        <div className="flex flex-col gap-4 h-full">
            <SubHeading2 title={title} />

            {/* Theme Variant */}
            <div className="text-xs">
                <div className="text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Theme Variant
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-block w-3 h-3 rounded-full border ${
                            themeVariant === "dark"
                                ? "bg-gray-800 border-gray-600"
                                : "bg-yellow-100 border-yellow-400"
                        }`}
                    />
                    <span className="text-gray-300 font-mono">
                        {themeVariant || "unknown"}
                    </span>
                    <span className="text-gray-600">
                        ({themeKeyCount} keys)
                    </span>
                </div>
            </div>

            {/* Theme Class Samples */}
            <div className="text-xs">
                <div className="text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Theme CSS Classes
                </div>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {SAMPLE_THEME_KEYS.map((key) => (
                        <div
                            key={key}
                            className="flex items-center gap-2 font-mono"
                        >
                            <span className="text-violet-400 w-40 truncate">
                                {key}
                            </span>
                            <span className="text-gray-400 truncate">
                                {currentTheme?.[key] || "—"}
                            </span>
                            {currentTheme?.[key] && key.startsWith("bg-") && (
                                <span
                                    className={`inline-block w-4 h-4 rounded border border-gray-600 ${currentTheme[key]}`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* App Info from useDashboard */}
            <div className="text-xs">
                <div className="text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    App Info (useDashboard)
                </div>
                <div className="space-y-1 font-mono">
                    <div>
                        <span className="text-gray-500">debug: </span>
                        <span className="text-gray-300">
                            {app?.debug !== undefined ? String(app.debug) : "—"}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">identifier: </span>
                        <span className="text-gray-300">
                            {app?.identifier || "—"}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">version: </span>
                        <span className="text-gray-300">
                            {app?.version || "—"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export const SampleThemeViewerWidget = ({
    title = "Theme Viewer",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SampleThemeViewerContent title={title} />
            </Panel>
        </Widget>
    );
};
