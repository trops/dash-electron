/**
 * Pins the preview widgetData computation that PreviewContextWrapper
 * uses to populate the widget render context.
 *
 * Bug this guards: when the user is BUILDING a brand-new widget (no
 * editContext yet — editContext is the bag carried over from
 * Edit-with-AI for an existing dashboard widget), the wrapper used to
 * read provider declarations only from `editContext.configCode`. In
 * build mode that's empty, so `widgetData.providers` came out empty,
 * and `useWidgetProviders().hasProvider("algolia")` returned false
 * even after the user explicitly picked an Algolia provider in the
 * preview dropdown. The widget's `if (!hasProvider("algolia"))`
 * early return then fired and the preview just showed the empty
 * state instead of the actual UI.
 *
 * Fix: accept the AI-generated configCode (`previewConfigCode`) as a
 * fallback source for declarations. `editContext` still wins when
 * present so Edit-with-AI keeps using the saved widget's declared
 * providers. Both fall back to an empty array when neither source
 * exists.
 */
const {
    buildPreviewWidgetData,
    extractProviderDeclarations,
} = require("./widgetPreviewData");

describe("buildPreviewWidgetData", () => {
    test("extracts providers from previewConfigCode when editContext is null (build mode)", () => {
        const result = buildPreviewWidgetData({
            editContext: null,
            previewConfigCode: `export default {
                component: "AlgoliaRulesManager",
                providers: [{ type: "algolia", providerClass: "credential", required: true }],
            };`,
            previewProviderSelection: { algolia: "Algolia John G Demos" },
        });
        expect(result.providers).toHaveLength(1);
        expect(result.providers[0].type).toBe("algolia");
        expect(result.providers[0].providerClass).toBe("credential");
        expect(result.selectedProviders.algolia).toBe("Algolia John G Demos");
    });

    test("prefers editContext.configCode over previewConfigCode when both are present", () => {
        // Edit-with-AI: the saved widget's declared providers must
        // win over whatever the AI happens to have re-emitted in the
        // current chat draft.
        const result = buildPreviewWidgetData({
            editContext: {
                configCode: `export default {
                    providers: [{ type: "slack", providerClass: "credential" }],
                };`,
                selectedProviders: { slack: "Work Slack" },
            },
            previewConfigCode: `export default {
                providers: [{ type: "algolia", providerClass: "credential" }],
            };`,
            previewProviderSelection: {},
        });
        expect(result.providers).toHaveLength(1);
        expect(result.providers[0].type).toBe("slack");
    });

    test("returns empty providers when neither source declares any", () => {
        const result = buildPreviewWidgetData({
            editContext: null,
            previewConfigCode: null,
            previewProviderSelection: null,
        });
        expect(result.providers).toEqual([]);
        expect(result.selectedProviders).toEqual({});
    });

    test("preview picker selection overrides editContext.selectedProviders", () => {
        // Editing an existing widget: user starts with the saved
        // selection from the dashboard, then changes the picker.
        // The new pick must win.
        const result = buildPreviewWidgetData({
            editContext: {
                configCode: `export default {
                    providers: [{ type: "algolia", providerClass: "credential" }],
                };`,
                selectedProviders: { algolia: "Old Algolia" },
            },
            previewConfigCode: null,
            previewProviderSelection: { algolia: "New Algolia" },
        });
        expect(result.selectedProviders.algolia).toBe("New Algolia");
    });

    test("threads userPrefs from editContext", () => {
        const result = buildPreviewWidgetData({
            editContext: {
                configCode: "",
                userPrefs: { title: "Saved Title", indexName: "saved-index" },
            },
            previewConfigCode: null,
        });
        expect(result.userPrefs).toEqual({
            title: "Saved Title",
            indexName: "saved-index",
        });
    });

    test("uuidString is the stable preview-widget id", () => {
        const result = buildPreviewWidgetData({
            editContext: null,
            previewConfigCode: null,
        });
        expect(result.uuidString).toBe("preview-widget");
    });
});

describe("extractProviderDeclarations", () => {
    // Sanity-check the regex parser since the bug fix depends on it
    // running over previewConfigCode (a fresh AI-generated string)
    // rather than only over editContext.configCode.
    test("returns [] for empty / missing config", () => {
        expect(extractProviderDeclarations("")).toEqual([]);
        expect(extractProviderDeclarations(null)).toEqual([]);
        expect(extractProviderDeclarations(undefined)).toEqual([]);
    });

    test("parses a single provider declaration", () => {
        const code = `export default {
            providers: [{ type: "algolia", providerClass: "credential", required: true }],
        };`;
        const result = extractProviderDeclarations(code);
        expect(result).toEqual([
            { type: "algolia", providerClass: "credential" },
        ]);
    });

    test("parses multiple provider declarations", () => {
        const code = `export default {
            providers: [
                { type: "algolia", providerClass: "credential" },
                { type: "slack", providerClass: "credential" },
            ],
        };`;
        const result = extractProviderDeclarations(code);
        expect(result).toHaveLength(2);
        expect(result[0].type).toBe("algolia");
        expect(result[1].type).toBe("slack");
    });
});
