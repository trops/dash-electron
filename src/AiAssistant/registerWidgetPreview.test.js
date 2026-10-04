/**
 * @jest-environment jsdom
 *
 * registerWidgetPreview — gives dash-core's Widgets page the Widget
 * Builder's sandboxed iframe preview (app-navigation NAV-011). The
 * wrapper reads the app's theme + providers and hands everything to
 * PreviewIframe; PreviewIframe itself is covered by its own tests.
 */
const mockSetRenderer = jest.fn();
jest.mock(
    "@trops/dash-react",
    () => {
        const React = require("react");
        return { ThemeContext: React.createContext(null) };
    },
    { virtual: true }
);
jest.mock(
    "@trops/dash-core",
    () => {
        const React = require("react");
        return {
            AppContext: React.createContext(null),
            setWidgetPreviewRenderer: (c) => mockSetRenderer(c),
        };
    },
    { virtual: true }
);
let mockIframeProps = null;
jest.mock("./PreviewIframe", () => ({
    PreviewIframe: (props) => {
        mockIframeProps = props;
        return null;
    },
}));

import React from "react";
import { render } from "@testing-library/react";
import { ThemeContext } from "@trops/dash-react";
import { AppContext } from "@trops/dash-core";
import {
    LiveWidgetPreview,
    registerWidgetPreview,
} from "./registerWidgetPreview";

describe("registerWidgetPreview", () => {
    it("registers the iframe preview with dash-core", () => {
        registerWidgetPreview();
        expect(mockSetRenderer).toHaveBeenCalledWith(LiveWidgetPreview);
    });

    it("passes the widget, the app theme and only plain provider data to the iframe", () => {
        const onError = jest.fn();
        const onMounted = jest.fn();
        const theme = {
            currentTheme: { "bg-primary-dark": "x" },
            themeVariant: "dark",
        };
        const app = {
            providers: { "Slack Work": { type: "slack" } },
            credentials: { appId: "app" },
            dashApi: { save: () => {} },
        };
        render(
            <ThemeContext.Provider value={theme}>
                <AppContext.Provider value={app}>
                    <LiveWidgetPreview
                        bundleSource="module.exports={}"
                        componentName="Channels"
                        widgetData={{
                            selectedProviders: { slack: "Slack Work" },
                        }}
                        declaredProviders={["slack"]}
                        props={{ title: "Hi" }}
                        onError={onError}
                        onMounted={onMounted}
                    />
                </AppContext.Provider>
            </ThemeContext.Provider>
        );
        expect(mockIframeProps).toMatchObject({
            bundleSource: "module.exports={}",
            componentName: "Channels",
            declaredProviders: ["slack"],
            props: { title: "Hi" },
            themeContext: theme,
            appContext: {
                providers: app.providers,
                credentials: app.credentials,
            },
            widgetData: { selectedProviders: { slack: "Slack Work" } },
            onError,
            onMounted,
        });
        // No dashApi or other functions cross into the sandbox.
        expect(mockIframeProps.appContext.dashApi).toBeUndefined();
    });
});
