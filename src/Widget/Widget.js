import React, { Component } from "react";
import { ProviderErrorBoundary } from "../Components/Provider";
import { getUUID } from "@trops/dash-react";
import { LayoutContainer } from "../Components/Layout";

class WidgetErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Widget Error:", error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });

        // If widgetId is provided, you could publish an error event here
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    render() {
        if (this.state.hasError) {
            // Custom error UI
            return (
                <div className="flex flex-col items-center justify-center p-4 bg-red-50 border border-red-300 rounded-lg h-full">
                    <div className="text-red-600 font-semibold text-lg mb-2">
                        Widget Error
                    </div>
                    <div className="text-red-500 text-sm mb-4">
                        {this.state.error?.message || "Something went wrong"}
                    </div>
                    {this.props.widgetId && (
                        <div className="text-gray-500 text-xs mb-2">
                            Widget ID: {this.props.widgetId}
                        </div>
                    )}
                    <button
                        onClick={() =>
                            this.setState({
                                hasError: false,
                                error: null,
                                errorInfo: null,
                            })
                        }
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export const Widget = ({
    uuid,
    children,
    version = 1,
    direction = "col",
    scrollable = false,
    className = "",
    width = "w-full",
    height = "",
    space = true,
    grow = true,
    publishEvent = {},
    api = {},
    requiredProviders = [],
    selectedProviders = {},
    onProviderSelect = null,
    ...props
}) => {
    const uuidString = getUUID(uuid);

    return (
        <LayoutContainer
            uuid={uuid}
            id={`WIDGET-${uuidString}`}
            version={version}
            key={`WIDGET'-${uuidString}`}
            direction={direction}
            height={height}
            width={width}
            className={`${className}`}
            grow={grow}
            space={space}
            scrollable={scrollable}
        >
            <ProviderErrorBoundary
                requiredProviders={requiredProviders}
                selectedProviders={selectedProviders}
                widgetId={uuidString}
                onProviderSelect={onProviderSelect}
            >
                <WidgetErrorBoundary widgetId={uuidString}>
                    {children}
                </WidgetErrorBoundary>
            </ProviderErrorBoundary>
        </LayoutContainer>
    );
};
