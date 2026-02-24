/**
 * ProviderBadge
 *
 * Visual indicator of provider status for widgets.
 * Shows connection status and allows quick access to provider configuration.
 */

import React from "react";

export const ProviderBadge = ({
    providerType,
    providerId,
    providerName,
    isConfigured = false,
    isRequired = false,
    onClick,
    className = "",
}) => {
    // Status variants
    const getStatusStyle = () => {
        if (isConfigured) {
            return {
                bg: "bg-green-50 dark:bg-green-900/20",
                border: "border-green-300 dark:border-green-700",
                text: "text-green-700 dark:text-green-400",
                icon: "✓",
                label: providerName || "Connected",
            };
        }

        if (isRequired) {
            return {
                bg: "bg-yellow-50 dark:bg-yellow-900/20",
                border: "border-yellow-300 dark:border-yellow-700",
                text: "text-yellow-700 dark:text-yellow-400",
                icon: "⚠️",
                label: "Required",
            };
        }

        return {
            bg: "bg-gray-50 dark:bg-gray-900/20",
            border: "border-gray-300 dark:border-gray-700",
            text: "text-gray-600 dark:text-gray-400",
            icon: "○",
            label: "Optional",
        };
    };

    const status = getStatusStyle();

    return (
        <button
            onClick={onClick}
            className={`
                inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border
                ${status.bg} ${status.border} ${status.text}
                hover:opacity-80 transition-opacity
                ${className}
            `}
            title={`${providerType}: ${status.label}`}
        >
            <span>{status.icon}</span>
            <span className="capitalize">{providerType}</span>
            {isConfigured && providerName && (
                <>
                    <span className="text-gray-400">·</span>
                    <span className="max-w-[100px] truncate">
                        {providerName}
                    </span>
                </>
            )}
        </button>
    );
};

export default ProviderBadge;
