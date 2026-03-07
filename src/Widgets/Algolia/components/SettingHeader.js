/**
 * SettingHeader
 *
 * Shared header for each setting section within a settings widget.
 * Shows a title, description blurb, and a doc link icon.
 */
export function SettingHeader({ title, description, docUrl }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-200">
                    {title}
                </span>
                {docUrl && (
                    <a
                        href={docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs"
                        title="View Algolia documentation"
                    >
                        docs &rarr;
                    </a>
                )}
            </div>
            {description && (
                <p className="text-xs text-gray-400 leading-relaxed">
                    {description}
                </p>
            )}
        </div>
    );
}
