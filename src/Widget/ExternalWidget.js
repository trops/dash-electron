import React from "react";
import { Panel, Heading, FontAwesomeIcon } from "@trops/dash-react";

/**
 * ExternalWidget
 *
 * Placeholder component rendered for installed (external) widgets.
 * Since raw JSX cannot be loaded at runtime in the renderer
 * (contextIsolation: true, nodeIntegration: false), this component
 * is assigned as the `component` field when registering installed widgets
 * with ComponentManager.
 */
export const ExternalWidget = ({ title, description, icon, ...props }) => {
    return (
        <Panel>
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center opacity-70">
                <FontAwesomeIcon
                    icon={icon || "puzzle-piece"}
                    className="h-6 w-6 opacity-50"
                />
                <Heading title={title || "External Widget"} padding={false} />
                {description && (
                    <p className="text-sm text-gray-400 max-w-xs">
                        {description}
                    </p>
                )}
            </div>
        </Panel>
    );
};
