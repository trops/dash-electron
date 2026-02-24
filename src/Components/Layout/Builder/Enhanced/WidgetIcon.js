import React from "react";
import { FontAwesomeIcon } from "@trops/dash-react";

const isFontAwesomeIcon = (icon) =>
    typeof icon === "string" && /^[a-z][a-z0-9-]*$/.test(icon);

export const WidgetIcon = ({ icon, className = "", fallback = "📦" }) => {
    const resolvedIcon = icon || fallback;

    if (isFontAwesomeIcon(resolvedIcon)) {
        return <FontAwesomeIcon icon={resolvedIcon} className={className} />;
    }

    return <span className={`leading-none ${className}`}>{resolvedIcon}</span>;
};
