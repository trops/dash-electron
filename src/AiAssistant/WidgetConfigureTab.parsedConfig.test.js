/**
 * @jest-environment jsdom
 *
 * Pins the Configure tab to read its initial form state from the
 * `parsedConfig` prop (the resolved config object the modal already
 * has from evaluateBundle), NOT from re-parsing the .dash.js source
 * string. The string parser silently fails on real AI output because
 * the source includes `import …;` lines and a `component: <Identifier>`
 * reference that aren't valid as `new Function()` input. Reading from
 * the already-resolved config object is the same source the actual
 * widget renderer uses — no parser drift.
 */
// Mock @trops/dash-react — only ThemeContext + FontAwesomeIcon are
// used by WidgetConfigureTab. Pulling the real package through jest's
// transform pipeline triggers ESM-resolution errors against the
// prebuilt dist, and we don't need the actual icon glyphs in a
// behavior test. ThemeContext defaults to an empty theme; the
// component already optional-chains everything from currentTheme.
jest.mock("@trops/dash-react", () => {
    const React = require("react");
    return {
        ThemeContext: React.createContext({ currentTheme: {} }),
        FontAwesomeIcon: ({ icon }) =>
            React.createElement(
                "span",
                { "data-testid": `icon-${icon}` },
                icon
            ),
    };
});

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WidgetConfigureTab } from "./WidgetConfigureTab";

function renderTab(props) {
    return render(
        <WidgetConfigureTab
            componentName="HelloWorld"
            onSave={() => {}}
            borderColor="border-gray-700"
            {...props}
        />
    );
}

describe("WidgetConfigureTab — initial form state from parsedConfig", () => {
    test("renders userConfig field keys when parsedConfig is provided", () => {
        const parsedConfig = {
            component: "HelloWorld",
            name: "Hello World",
            type: "widget",
            canHaveChildren: false,
            workspace: "ai-built",
            userConfig: {
                greeting: {
                    type: "text",
                    defaultValue: "Hello, World!",
                    displayName: "Greeting",
                    instructions: "The greeting text to display",
                    required: false,
                },
                message: {
                    type: "text",
                    defaultValue: "Welcome to your new Dash widget!",
                    displayName: "Message",
                    instructions: "The main message",
                    required: false,
                },
                showTimestamp: {
                    type: "boolean",
                    defaultValue: false,
                    displayName: "Show Timestamp",
                    instructions: "Display the current date and time",
                    required: false,
                },
            },
        };
        renderTab({ parsedConfig });
        // Each userConfig key should surface as an input value (the
        // form binds the key to a "Field name" / "Key" input).
        expect(screen.getByDisplayValue("greeting")).toBeInTheDocument();
        expect(screen.getByDisplayValue("message")).toBeInTheDocument();
        expect(screen.getByDisplayValue("showTimestamp")).toBeInTheDocument();
    });

    test("renders displayName values for each userConfig field", () => {
        const parsedConfig = {
            component: "X",
            name: "X",
            workspace: "ai-built",
            userConfig: {
                greeting: {
                    type: "text",
                    defaultValue: "Hi",
                    displayName: "Greeting Label",
                    required: false,
                },
            },
        };
        renderTab({ parsedConfig });
        expect(screen.getByDisplayValue("Greeting Label")).toBeInTheDocument();
    });

    test("renders the widget display name from parsedConfig.name", () => {
        const parsedConfig = {
            component: "X",
            name: "My Cool Widget",
            workspace: "ai-built",
            userConfig: {},
        };
        renderTab({ parsedConfig });
        expect(screen.getByDisplayValue("My Cool Widget")).toBeInTheDocument();
    });

    test("falls back to source-string parsing when parsedConfig is absent", () => {
        // Backward compatibility: legacy callers (or callers before the
        // modal wires parsedConfig in) still pass configCode as a
        // string. The simple-shape (no imports, no identifier ref)
        // continues to parse correctly.
        const configCode = `export default {
            component: "Plain",
            name: "Plain Widget",
            workspace: "ai-built",
            userConfig: {
                onlyField: { type: "text", defaultValue: "x", displayName: "Only Field", required: false },
            },
        };`;
        renderTab({ configCode, componentName: "Plain" });
        expect(screen.getByDisplayValue("Plain Widget")).toBeInTheDocument();
        expect(screen.getByDisplayValue("onlyField")).toBeInTheDocument();
    });

    test("parsedConfig wins over configCode when both are provided", () => {
        // The modal will pass both — parsedConfig is more accurate
        // (it's the resolved JS object), so it should take precedence.
        const parsedConfig = {
            name: "From Parsed",
            workspace: "ai-built",
            userConfig: {
                fromParsed: { type: "text", displayName: "From Parsed Field" },
            },
        };
        const configCode = `export default {
            component: "X",
            name: "From Source",
            workspace: "ai-built",
            userConfig: { fromSource: { type: "text", displayName: "From Source Field" } },
        };`;
        renderTab({ parsedConfig, configCode });
        expect(screen.getByDisplayValue("From Parsed")).toBeInTheDocument();
        expect(screen.getByDisplayValue("fromParsed")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("From Source")).toBeNull();
    });
});
