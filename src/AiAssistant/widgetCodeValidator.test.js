/**
 * Tests for widgetCodeValidator — proves the validator catches
 * hallucinated provider methods and accepts real ones.
 */
import {
    validateProviderApiUsage,
    buildAiCorrectionMessage,
    validateNoModalUsage,
    validateNoBotCalls,
    buildNoBotCallsCorrectionMessage,
    validateEventPublishing,
    buildEventPublishingCorrectionMessage,
    buildNoModalCorrectionMessage,
    validateComponentReferences,
    buildComponentReferenceCorrectionMessage,
    validateProviderCredentials,
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
        // Comments and string literals are skipped (codeOnly, install
        // gate 2026-10-16): a string that only names a method isn't a call.
        const code = `const note = "window.mainApi.algolia.fake(...)";`;
        const result = validateProviderApiUsage(code);
        expect(result.errors).toHaveLength(0);
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

describe("validateNoBotCalls (team-dashboards TD-005)", () => {
    test("catches every way of reaching mainApi.bots", () => {
        const code = [
            "const a = () => window.mainApi.bots.run(id);",
            "const b = () => window.mainApi?.bots?.askLead(id, q);",
            'const c = mainApi["bots"];',
            "const { bots } = window.mainApi;",
        ].join("\n");
        const res = validateNoBotCalls(code);
        expect(res.ok).toBe(false);
        expect(res.errors.map((e) => e.line)).toEqual([1, 2, 3, 4]);
    });

    test("publishing events, or the word bots in text, is fine", () => {
        const code =
            'publishEvent("checkEmail", {}); const t = "Your bots run on events"; window.mainApi.widgets.list();';
        expect(validateNoBotCalls(code)).toEqual({ ok: true, errors: [] });
    });

    test("the correction turns it into an action widget", () => {
        const msg = buildNoBotCallsCorrectionMessage(
            validateNoBotCalls("window.mainApi.bots.run(1)").errors
        );
        expect(msg).toMatch(/starts a bot directly/);
        expect(msg).toMatch(/publishEvent/);
        expect(msg).toMatch(/Run on events/);
        expect(msg).toMatch(/BOTH code blocks/);
    });
});

describe("validateEventPublishing — api.publishEvent isn't heard (4d-2)", () => {
    test("rejects api.publishEvent in any spelling", () => {
        const code = [
            "export default function Ask(props) {",
            '  const go = () => props.api.publishEvent("askClicked", {});',
            "  const { api } = props;",
            "  api?.publishEvent('x');",
            "}",
        ].join("\n");
        const res = validateEventPublishing(code);
        expect(res.ok).toBe(false);
        expect(res.errors.map((e) => e.line)).toEqual([2, 4]);
        expect(res.errors[0].snippet).toBe("api.publishEvent");
        expect(res.errors[0].suggestion).toMatch(/useWidgetEvents/);
    });
    test("accepts useWidgetEvents' publishEvent and the publishEvent prop", () => {
        expect(
            validateEventPublishing(
                'const { publishEvent } = useWidgetEvents(); publishEvent("askClicked", {}); props.publishEvent("x");'
            ).ok
        ).toBe(true);
        expect(validateEventPublishing("").ok).toBe(true);
    });
    test("the correction asks for useWidgetEvents and both blocks", () => {
        const msg = buildEventPublishingCorrectionMessage(
            validateEventPublishing('props.api.publishEvent("a")').errors
        );
        expect(msg).toMatch(/Re-emit BOTH code blocks/);
        expect(msg).toMatch(/const \{ publishEvent \} = useWidgetEvents\(\);/);
        expect(msg).toMatch(/Never call `api\.publishEvent`/);
    });
});

// A widget that declares a connection but asks the user for keys and calls
// the service itself (Create build fixes 3 — the user's Attribute Boost).
const KEYS_CONFIG = `export default {
  component: "AttributeBoost",
  type: "widget",
  providers: [{ type: "algolia", providerClass: "mcp", required: true }],
  userConfig: {
    appId: { type: "text", defaultValue: "", displayName: "Algolia App ID" },
    adminApiKey: { type: "text", defaultValue: "", displayName: "Admin API Key" },
    searchApiKey: { type: "text", defaultValue: "", displayName: "Search API Key" },
    workingIndexName: { type: "text", defaultValue: "", displayName: "Working Index Name" },
    sortKey: { type: "text", defaultValue: "", displayName: "Sort key" },
    tokenLimit: { type: "number", defaultValue: 10, displayName: "Token limit" },
  },
};`;
const KEYS_COMPONENT = `export default function AttributeBoost({ appId, searchApiKey, workingIndexName }) {
  const run = async () => {
    const res = await fetch(
      \`https://\${appId}-dsn.algolia.net/1/indexes/\${workingIndexName}/query\`,
      { headers: { "X-Algolia-API-Key": searchApiKey } }
    );
    return res.json();
  };
  return null;
}`;

describe("validateProviderCredentials — a connection's widget never asks for keys", () => {
    test("flags key settings and a direct fetch to the connected service", () => {
        const res = validateProviderCredentials(KEYS_COMPONENT, KEYS_CONFIG);
        expect(res.ok).toBe(false);
        const settings = res.errors
            .filter((e) => e.kind === "setting")
            .map((e) => e.name);
        expect(settings).toEqual(
            expect.arrayContaining(["adminApiKey", "searchApiKey", "appId"])
        );
        // Names that only look like keys are left alone.
        expect(settings).not.toContain("sortKey");
        expect(settings).not.toContain("tokenLimit");
        expect(settings).not.toContain("workingIndexName");
        const direct = res.errors.find((e) => e.kind === "fetch");
        expect(direct).toBeTruthy();
        expect(direct.provider).toBe("algolia");
        expect(direct.line).toBe(3);
        for (const e of res.errors) expect(e.suggestion).toMatch(/connection/);
    });

    test("an App ID alone isn't flagged when the widget goes through the connection", () => {
        const config = KEYS_CONFIG.replace(/\s+adminApiKey:.*\n/, "\n").replace(
            /\s+searchApiKey:.*\n/,
            "\n"
        );
        const component = `export default function W() { window.mainApi.algolia.search({}); return null; }`;
        expect(validateProviderCredentials(component, config)).toEqual({
            ok: true,
            errors: [],
        });
    });

    test("a widget with no connection may ask for its own key", () => {
        const config = `export default {
  component: "Weather",
  userConfig: { apiKey: { type: "text", defaultValue: "" } },
};`;
        const component = `export default function Weather({ apiKey }) { fetch(\`https://api.openweathermap.org/data?appid=\${apiKey}\`); return null; }`;
        expect(validateProviderCredentials(component, config).ok).toBe(true);
    });

    test("empty or missing code is ok", () => {
        expect(validateProviderCredentials("", "")).toEqual({
            ok: true,
            errors: [],
        });
        expect(validateProviderCredentials(null, undefined)).toEqual({
            ok: true,
            errors: [],
        });
    });
});

// The checks read code, not comments or text (install gate, 2026-10-16:
// three installed packages were flagged for words in a doc comment, a
// template string and a comment).
describe("checks ignore comments and strings", () => {
    test("a component named in a comment or a template string isn't flagged", () => {
        const code = `/**
 * Wraps everything inside a single <InstantSearch> instance.
 */
import { Panel } from "@trops/dash-react";
const block = (id) => \`<MERMAID_BLOCK id="\${id}"/>\`;
export default function W() { return <Panel>{block(1)}</Panel>; }
`;
        expect(validateComponentReferences(code)).toEqual({
            ok: true,
            errors: [],
        });
    });
    test("a provider method named in a comment isn't flagged; a real call still is", () => {
        const comment = `// Uses window.mainApi.algolia.notARealMethod() later.
export default function W() { return null; }`;
        expect(validateProviderApiUsage(comment).ok).toBe(true);
        const real = `export default function W() { window.mainApi.algolia.notARealMethod(); return null; }`;
        expect(validateProviderApiUsage(real).ok).toBe(false);
    });
    test("an apostrophe in JSX text doesn't hide a later line", () => {
        const code = `export default function W() {
    return (
        <div>
            <p>Don't panic</p>
            <Bogus />
        </div>
    );
}`;
        const res = validateComponentReferences(code);
        expect(res.errors.map((e) => [e.name, e.line])).toEqual([["Bogus", 5]]);
    });
    test("a Modal or a bot call in a comment isn't flagged", () => {
        const code = `// Don't use <Modal> or window.mainApi.bots.run() here.
export default function W() { return null; }`;
        expect(validateNoModalUsage(code).ok).toBe(true);
        expect(validateNoBotCalls(code).ok).toBe(true);
    });
});

// An apostrophe in JSX text isn't a string: the rest of the line is still
// checked (consolidation Phase 1a-2).
describe("codeOnly — apostrophes in JSX text", () => {
    test("a Modal after an apostrophe on the same line is still found", () => {
        const code = `<Panel><p>Don't worry</p><Modal isOpen={true} setIsOpen={() => {}}>x</Modal></Panel>`;
        expect(validateNoModalUsage(code).ok).toBe(false);
    });
    test("a real string on one line is still skipped", () => {
        const code = `const note = 'use <Modal> sparingly';`;
        expect(validateNoModalUsage(code).ok).toBe(true);
    });
});
