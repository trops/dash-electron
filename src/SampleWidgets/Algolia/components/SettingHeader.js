/**
 * SettingHeader
 *
 * Shared header for each setting section within a settings widget.
 * Shows a title, description blurb, and a doc link icon.
 */
import { useContext } from "react";
import { Caption2, ThemeContext } from "@trops/dash-react";

export function SettingHeader({ title, description, docUrl }) {
    const { currentTheme } = useContext(ThemeContext);
    // Title inherits the Panel text color; the docs link uses the
    // secondary channel as its accent.
    const linkClass = currentTheme?.["text-secondary-medium"] || "";
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{title}</span>
                {docUrl && (
                    <a
                        href={docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${linkClass} hover:underline text-xs`}
                        title="View Algolia documentation"
                    >
                        docs &rarr;
                    </a>
                )}
            </div>
            {description && (
                <Caption2 block className="leading-relaxed">
                    {description}
                </Caption2>
            )}
        </div>
    );
}
