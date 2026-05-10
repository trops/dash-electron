/**
 * Tests for widgetCodeValidator — proves the validator catches
 * hallucinated provider methods and accepts real ones.
 */
import {
    validateProviderApiUsage,
    buildAiCorrectionMessage,
    validateNoModalUsage,
    buildNoModalCorrectionMessage,
    validateComponentReferences,
    buildComponentReferenceCorrectionMessage,
} from "./widgetCodeValidator";

describe("validateProviderApiUsage — accepts real methods", () => {
    test("returns ok for code with no provider calls", () => {
        const code = `function W() { return <div>hello</div>; }`;
        expect(validateProviderApiUsage(code)).toEqual({
            ok: true,
            errors: [],
        });
    });

    test("returns ok for empty / nullish input", () => {
        expect(validateProviderApiUsage("")).toEqual({ ok: true, errors: [] });
        expect(validateProviderApiUsage(null)).toEqual({
            ok: true,
            errors: [],
        });
        expect(validateProviderApiUsage(undefined)).toEqual({
            ok: true,
            errors: [],
        });
    });

    test("accepts every algolia method the registry knows about", () => {
        const code = `
            await window.mainApi.algolia.listIndices({ providerHash: pc.providerHash });
            await window.mainApi.algolia.search({ indexName: "x", query: "y" });
            await window.mainApi.algolia.browseObjectsToFile({ ... });
            await window.mainApi.algolia.partialUpdateObjectsFromDirectory({ ... });
            await window.mainApi.algolia.getSettings({ ... });
            await window.mainApi.algolia.setSettings({ ... });
            await window.mainApi.algolia.getAnalyticsForQuery({ ... });
        `;
        expect(validateProviderApiUsage(code)).toEqual({
            ok: true,
            errors: [],
        });
    });

    test("accepts the bare-mainApi style (no `window.` prefix)", () => {
        const code = `await mainApi.algolia.listIndices({});`;
        expect(validateProviderApiUsage(code)).toEqual({
            ok: true,
            errors: [],
        });
    });

    test("ignores services not in the registry (popout, widgetBuilder, …)", () => {
        const code = `await window.mainApi.popout.open(workspaceId);`;
        expect(validateProviderApiUsage(code)).toEqual({
            ok: true,
            errors: [],
        });
    });
});

describe("validateProviderApiUsage — rejects hallucinated methods", () => {
    test("flags getRules / createRule / updateRule (CRUD-style names that don't match the SDK)", () => {
        // Slice 17d.6 added saveRule (upsert) + deleteRule + searchRules
        // as real methods. Pre-17d.6 the AI used to hallucinate
        // CRUD-shaped names like getRules / createRule / updateRule.
        // saveRule and deleteRule are now real; getRules / createRule
        // / updateRule remain wrong (the SDK uses searchRules and
        // saveRule for upsert).
        const code = `
            await window.mainApi.algolia.getRules({ indexName });
            await window.mainApi.algolia.createRule({ rule });
            await window.mainApi.algolia.updateRule({ rule });
        `;
        const result = validateProviderApiUsage(code);
        expect(result.ok).toBe(false);
        const flagged = new Set(result.errors.map((e) => e.method));
        expect(flagged).toEqual(
            new Set(["getRules", "createRule", "updateRule"])
        );
    });

    test("dedupes when the same hallucination appears multiple times", () => {
        const code = `
            await window.mainApi.algolia.getRules({ indexName });
            await window.mainApi.algolia.getRules({ indexName: other });
            await window.mainApi.algolia.getRules({ indexName: third });
        `;
        const result = validateProviderApiUsage(code);
        expect(result.ok).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].method).toBe("getRules");
    });

    test("reports a useful suggestion when method name is close to a real one", () => {
        // "listIndex" isn't real, but "listIndices" is — the
        // suggestion should surface that.
        const code = `await window.mainApi.algolia.listIndex({});`;
        const result = validateProviderApiUsage(code);
        expect(result.ok).toBe(false);
        expect(result.errors[0].suggestion).toContain("listIndices");
    });

    test("falls back to listing all real methods when no close match", () => {
        const code = `await window.mainApi.algolia.totallyMadeUp({});`;
        const result = validateProviderApiUsage(code);
        expect(result.ok).toBe(false);
        // Suggestion contains every registered method (comma-separated).
        expect(result.errors[0].suggestion).toContain("listIndices");
        expect(result.errors[0].suggestion).toContain("search");
    });

    test("reports a 1-based line number", () => {
        const code = [
            "// header comment",
            "function W() {",
            "    await window.mainApi.algolia.bogus({});",
            "}",
        ].join("\n");
        const result = validateProviderApiUsage(code);
        expect(result.errors[0].line).toBe(3);
    });

    test("does not flag patterns that aren't actually a mainApi call", () => {
        // A local variable named `mainApi` shouldn't trip — but we
        // only filter for the actual member-access pattern, so a
        // local with the same shape is the user's responsibility.
        // The realistic noise we DO want to ignore: comments
        // mentioning the API by name, and string literals.
        // Comments and string literals aren't excluded by this
        // simple matcher; we accept that as the noise floor.
        // Confirm the matcher still flags strings.
        const code = `const note = "window.mainApi.algolia.fake(...)";`;
        const result = validateProviderApiUsage(code);
        // This IS a hallucination match by our matcher because
        // it's the literal pattern. Future iteration could parse,
        // but the prompt-side fix is "the AI shouldn't write this
        // pattern in strings either."
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].method).toBe("fake");
    });
});

describe("validateNoModalUsage — accepts Modal-free widgets", () => {
    test("returns ok for empty / nullish input", () => {
        expect(validateNoModalUsage("")).toEqual({ ok: true, errors: [] });
        expect(validateNoModalUsage(null)).toEqual({ ok: true, errors: [] });
        expect(validateNoModalUsage(undefined)).toEqual({
            ok: true,
            errors: [],
        });
    });

    test("returns ok for code with no popup chrome", () => {
        const code = `
            <Panel>
                <Heading title="Hello" />
                <Card>{showForm && <Card>{form}</Card>}</Card>
            </Panel>
        `;
        expect(validateNoModalUsage(code)).toEqual({ ok: true, errors: [] });
    });

    test("does not false-positive on identifiers like ModalContent / DialogTrigger", () => {
        // Pattern matches require a NON-identifier char (space, /, >)
        // immediately after the tag name. `<ModalContent>` and
        // `<DialogTrigger>` are different tags entirely and should
        // not trip the validator.
        const code = `
            <Panel>
                <ModalContent>this is a fictional sub-component</ModalContent>
                <DialogTrigger>nope</DialogTrigger>
                <DrawerHandle />
            </Panel>
        `;
        expect(validateNoModalUsage(code)).toEqual({ ok: true, errors: [] });
    });
});

describe("validateNoModalUsage — rejects popup chrome inside widgets", () => {
    test("flags <Modal> JSX", () => {
        const code = `
            <Panel>
                <Modal isOpen={open} setIsOpen={setOpen}>
                    <RuleForm />
                </Modal>
            </Panel>
        `;
        const result = validateNoModalUsage(code);
        expect(result.ok).toBe(false);
        expect(result.errors.map((e) => e.tag)).toEqual(["Modal"]);
        // Suggestion guides toward inline collapsible Card.
        expect(result.errors[0].suggestion).toMatch(/Card/);
    });

    test("flags <Dialog> JSX (the actual error from the screenshot)", () => {
        const code = `<Dialog open={undefined}>...</Dialog>`;
        const result = validateNoModalUsage(code);
        expect(result.ok).toBe(false);
        expect(result.errors[0].tag).toBe("Dialog");
    });

    test("flags <Drawer> JSX", () => {
        const code = `<Drawer side="right">...</Drawer>`;
        const result = validateNoModalUsage(code);
        expect(result.ok).toBe(false);
        expect(result.errors[0].tag).toBe("Drawer");
    });

    test("flags self-closing form <Modal/>", () => {
        const code = `<Modal/>`;
        const result = validateNoModalUsage(code);
        expect(result.ok).toBe(false);
        expect(result.errors[0].tag).toBe("Modal");
    });

    test("dedupes when the same tag appears multiple times", () => {
        const code = `
            <Modal>first</Modal>
            <Modal>second</Modal>
            <Modal>third</Modal>
        `;
        const result = validateNoModalUsage(code);
        expect(result.ok).toBe(false);
        expect(result.errors).toHaveLength(1);
    });

    test("flags multiple distinct tags in one widget", () => {
        const code = `
            <Modal>x</Modal>
            <Drawer>y</Drawer>
            <Dialog>z</Dialog>
        `;
        const result = validateNoModalUsage(code);
        expect(result.ok).toBe(false);
        expect(new Set(result.errors.map((e) => e.tag))).toEqual(
            new Set(["Modal", "Dialog", "Drawer"])
        );
    });

    test("reports a 1-based line number", () => {
        const code = [
            "// header",
            "<Panel>",
            "    <Modal>x</Modal>",
            "</Panel>",
        ].join("\n");
        const result = validateNoModalUsage(code);
        expect(result.errors[0].line).toBe(3);
    });
});

describe("buildNoModalCorrectionMessage", () => {
    test("returns empty string for no errors", () => {
        expect(buildNoModalCorrectionMessage([])).toBe("");
        expect(buildNoModalCorrectionMessage(null)).toBe("");
    });

    test("teaches the inline-Card alternative", () => {
        const errors = [
            { tag: "Modal", line: 5, suggestion: "Use a collapsible <Card>" },
        ];
        const msg = buildNoModalCorrectionMessage(errors);
        expect(msg).toContain("Modal");
        expect(msg).toContain("Card");
        expect(msg).toContain("INLINE");
    });

    test("teaches the multi-widget split via useWidgetEvents", () => {
        const msg = buildNoModalCorrectionMessage([
            { tag: "Modal", line: 1, suggestion: "" },
        ]);
        expect(msg).toContain("useWidgetEvents");
        expect(msg).toMatch(/split/i);
        expect(msg).toMatch(/File:/);
    });

    test("instructs the AI to re-emit both code blocks", () => {
        const msg = buildNoModalCorrectionMessage([
            { tag: "Modal", line: 1, suggestion: "" },
        ]);
        expect(msg).toMatch(/component \+ config/i);
    });
});

describe("buildAiCorrectionMessage", () => {
    test("returns empty string for no errors", () => {
        expect(buildAiCorrectionMessage([])).toBe("");
        expect(buildAiCorrectionMessage(null)).toBe("");
    });

    test("includes the offending method names", () => {
        const errors = [
            {
                service: "algolia",
                method: "getRules",
                suggestion: "listIndices",
            },
        ];
        const msg = buildAiCorrectionMessage(errors);
        expect(msg).toContain("getRules");
        expect(msg).toContain("methods that do not exist");
    });

    test("instructs the AI to re-emit both code blocks", () => {
        const errors = [
            { service: "algolia", method: "x", suggestion: "listIndices" },
        ];
        const msg = buildAiCorrectionMessage(errors);
        expect(msg).toMatch(/component \+ config/i);
        expect(msg).toMatch(/AVAILABLE METHODS/i);
    });

    test("teaches the providerHash + dashboardAppId + providerName pattern", () => {
        const msg = buildAiCorrectionMessage([
            { service: "algolia", method: "x", suggestion: "" },
        ]);
        expect(msg).toContain("providerHash");
        expect(msg).toContain("dashboardAppId");
        expect(msg).toContain("providerName");
        expect(msg).toContain("never the bare `pc`");
    });
});

describe("validateComponentReferences — accepts known + locally-defined components", () => {
    test("returns ok for empty / non-string input", () => {
        expect(validateComponentReferences("")).toEqual({
            ok: true,
            errors: [],
        });
        expect(validateComponentReferences(null)).toEqual({
            ok: true,
            errors: [],
        });
        expect(validateComponentReferences(undefined)).toEqual({
            ok: true,
            errors: [],
        });
    });

    test("accepts dash-react components imported via named import", () => {
        const code = `
            import { Panel, Heading, Button } from "@trops/dash-react";
            export default function W() {
                return <Panel><Heading title="x" /><Button title="ok" /></Panel>;
            }
        `;
        const result = validateComponentReferences(code);
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test("accepts dash-react components even without explicit import (registry covers them)", () => {
        // The widget runner / iframe shell injects dash-react globals
        // in some bundle configs, so a JSX tag without an import may
        // still be valid if it's a dash-react export. The registry
        // protects this case.
        const code = `
            export default function W() {
                return <Panel><Heading title="x" /></Panel>;
            }
        `;
        const result = validateComponentReferences(code);
        expect(result.ok).toBe(true);
    });

    test("accepts locally-declared function components", () => {
        const code = `
            function HelperRow({ children }) { return <div>{children}</div>; }
            export default function W() {
                return <HelperRow>hi</HelperRow>;
            }
        `;
        expect(validateComponentReferences(code).ok).toBe(true);
    });

    test("accepts locally-declared arrow components via const", () => {
        const code = `
            const HelperRow = ({ children }) => <div>{children}</div>;
            export default function W() {
                return <HelperRow>hi</HelperRow>;
            }
        `;
        expect(validateComponentReferences(code).ok).toBe(true);
    });

    test("accepts aliased imports (uses the local binding name)", () => {
        const code = `
            import { Heading as H } from "@trops/dash-react";
            export default function W() {
                return <H title="x" />;
            }
        `;
        expect(validateComponentReferences(code).ok).toBe(true);
    });

    test("accepts default + namespace imports", () => {
        const code = `
            import React from "react";
            import * as Icons from "./icons";
            export default function W() {
                return <React.Fragment><Icons.Foo /></React.Fragment>;
            }
        `;
        expect(validateComponentReferences(code).ok).toBe(true);
    });

    test("accepts ThemeContext.Provider style member-expression JSX", () => {
        const code = `
            import { ThemeContext } from "@trops/dash-react";
            export default function W() {
                return <ThemeContext.Provider value={null}>x</ThemeContext.Provider>;
            }
        `;
        expect(validateComponentReferences(code).ok).toBe(true);
    });
});

describe("validateComponentReferences — rejects unknown components", () => {
    test("flags a typo of a real component", () => {
        const code = `
            import { Heading } from "@trops/dash-react";
            export default function W() {
                return <Heding title="x" />;
            }
        `;
        const result = validateComponentReferences(code);
        expect(result.ok).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].name).toBe("Heding");
        expect(result.errors[0].suggestion).toMatch(/Heading/);
    });

    test("flags a hallucinated component (real-sounding but not exported)", () => {
        const code = `
            import { Panel } from "@trops/dash-react";
            export default function W() {
                return <Panel><TabPanel /></Panel>;
            }
        `;
        const result = validateComponentReferences(code);
        expect(result.ok).toBe(false);
        expect(result.errors[0].name).toBe("TabPanel");
    });

    test("flags forgotten imports (component used but never imported)", () => {
        const code = `
            export default function W() {
                return <SomeRandomThing />;
            }
        `;
        const result = validateComponentReferences(code);
        expect(result.ok).toBe(false);
        expect(result.errors[0].name).toBe("SomeRandomThing");
    });

    test("dedupes repeated unknown references — one entry per name", () => {
        const code = `
            export default function W() {
                return (
                    <>
                        <Bogus a="1" />
                        <Bogus a="2" />
                        <Bogus a="3" />
                    </>
                );
            }
        `;
        const result = validateComponentReferences(code);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].name).toBe("Bogus");
    });

    test("reports a 1-based line number", () => {
        const code = [
            "// line 1",
            "// line 2",
            "function W() {",
            "    return <Bogus />;",
            "}",
        ].join("\n");
        const result = validateComponentReferences(code);
        expect(result.errors[0].line).toBe(4);
    });

    test("does NOT flag JSX intrinsics (lowercase tags)", () => {
        const code = `
            export default function W() {
                return <div><span>hi</span><button /></div>;
            }
        `;
        expect(validateComponentReferences(code).ok).toBe(true);
    });
});

describe("buildComponentReferenceCorrectionMessage", () => {
    test("returns empty string when no errors", () => {
        expect(buildComponentReferenceCorrectionMessage([])).toBe("");
        expect(buildComponentReferenceCorrectionMessage(null)).toBe("");
    });

    test("includes each unknown component name", () => {
        const msg = buildComponentReferenceCorrectionMessage([
            { name: "Heding", line: 5, suggestion: "did you mean <Heading>?" },
            { name: "TabPanel", line: 8, suggestion: "not imported" },
        ]);
        expect(msg).toContain("Heding");
        expect(msg).toContain("TabPanel");
        expect(msg).toContain("don't exist");
    });

    test("instructs the AI to re-emit both code blocks", () => {
        const msg = buildComponentReferenceCorrectionMessage([
            { name: "Heding", line: 5, suggestion: "?" },
        ]);
        expect(msg).toMatch(/component \+ config/i);
        expect(msg).toMatch(/dash-react-components.md|@trops\/dash-react/);
    });
});
