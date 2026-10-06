/**
 * ThemeViewerWidget
 *
 * Reads ThemeContext from @trops/dash-react and the useDashboard() hook.
 * Displays current theme values and app info.
 *
 * @package DashSamples
 */
import { useContext } from "react";
import {
    Panel,
    SubHeading2,
    ThemeContext,
    SectionLabel,
    Caption2,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useDashboard } from "@trops/dash-core";

const THEME_KEYS = [
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

function ThemeViewerContent({ title }) {
    const { currentTheme, themeVariant } = useContext(ThemeContext);
    const { app } = useDashboard();
    const statusTokens = useStatusTokens();
    const valueClass = currentTheme?.["text-primary-medium"] || "";
    const swatchBorder = currentTheme?.["border-primary-medium"] || "";

    const themeKeyCount = currentTheme ? Object.keys(currentTheme).length : 0;

    return (
        <div className="flex flex-col gap-4 h-full">
            <SubHeading2 title={title} />

            {/* Theme Variant */}
            <div className="text-xs">
                <SectionLabel className="mb-1">Theme Variant</SectionLabel>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-block w-3 h-3 rounded-full border ${swatchBorder} ${
                            themeVariant === "dark"
                                ? currentTheme?.["bg-primary-dark"] || ""
                                : statusTokens.warning.solidBg
                        }`}
                    />
                    <span className={`${valueClass} font-mono`}>
                        {themeVariant || "unknown"}
                    </span>
                    <Caption2>({themeKeyCount} keys)</Caption2>
                </div>
            </div>

            {/* Theme Class Samples */}
            <div className="text-xs">
                <SectionLabel className="mb-1">Theme CSS Classes</SectionLabel>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {THEME_KEYS.map((key) => (
                        <div
                            key={key}
                            className="flex items-center gap-2 font-mono"
                        >
                            <span
                                className={`${
                                    currentTheme?.["text-secondary-medium"] ||
                                    ""
                                } w-40 truncate`}
                            >
                                {key}
                            </span>
                            <Caption2 className="font-mono truncate">
                                {currentTheme?.[key] || "—"}
                            </Caption2>
                            {currentTheme?.[key] && key.startsWith("bg-") && (
                                <span
                                    className={`inline-block w-4 h-4 rounded border ${swatchBorder} ${currentTheme[key]}`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* App Info from useDashboard */}
            <div className="text-xs">
                <SectionLabel className="mb-1">
                    App Info (useDashboard)
                </SectionLabel>
                <div className="space-y-1 font-mono">
                    <div>
                        <Caption2 className="font-mono">debug: </Caption2>
                        <span className={valueClass}>
                            {app?.debug !== undefined ? String(app.debug) : "—"}
                        </span>
                    </div>
                    <div>
                        <Caption2 className="font-mono">identifier: </Caption2>
                        <span className={valueClass}>
                            {app?.identifier || "—"}
                        </span>
                    </div>
                    <div>
                        <Caption2 className="font-mono">version: </Caption2>
                        <span className={valueClass}>
                            {app?.version || "—"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export const ThemeViewerWidget = ({ title = "Theme Viewer", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <ThemeViewerContent title={title} />
            </Panel>
        </Widget>
    );
};
