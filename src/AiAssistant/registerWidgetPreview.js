/**
 * registerWidgetPreview — gives dash-core's Widgets page (app-navigation
 * NAV-011) the Widget Builder's sandboxed preview: widget code runs in
 * PreviewIframe's separate React tree, so a broken widget can't affect
 * the app. dash-core can't import from here, so it exposes a slot
 * (setWidgetPreviewRenderer) that Dash.js fills at startup.
 *
 * The Widgets page renders inside the app's context tree, so the app
 * theme and providers come straight from context (the builder modal
 * renders outside it and bridges them through window broadcasts).
 */
import React, { useContext, useMemo } from "react";
import { ThemeContext } from "@trops/dash-react";
import { AppContext, setWidgetPreviewRenderer } from "@trops/dash-core";
import { PreviewIframe } from "./PreviewIframe";

export function LiveWidgetPreview({
    bundleSource,
    componentName,
    widgetData,
    declaredProviders,
    props,
    onMounted,
    onError,
}) {
    const themeContext = useContext(ThemeContext);
    const app = useContext(AppContext) || {};
    // Only plain provider data crosses into the sandbox (PreviewIframe
    // also filters it to the declared provider types).
    const appContext = useMemo(
        () => ({
            providers: app.providers || {},
            credentials: app.credentials || null,
        }),
        [app.providers, app.credentials]
    );
    return (
        <PreviewIframe
            bundleSource={bundleSource}
            componentName={componentName}
            props={props}
            themeContext={themeContext}
            appContext={appContext}
            widgetData={widgetData}
            declaredProviders={declaredProviders}
            onMounted={onMounted}
            onError={onError}
        />
    );
}

export function registerWidgetPreview() {
    // An older dash-core without the slot just has no live preview.
    if (typeof setWidgetPreviewRenderer === "function") {
        setWidgetPreviewRenderer(LiveWidgetPreview);
    }
}
