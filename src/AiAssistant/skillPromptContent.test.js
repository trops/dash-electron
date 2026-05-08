/**
 * Pins the curated SKILL.md guidance inlined into the modal prompt:
 *   - kept sections are present (Ecosystem Overview, How Widgets Work,
 *     Quick Reference, Minimal Widget, Widget .dash.js Configuration)
 *   - stripped sections are absent (no Bash workflow, no shell phases,
 *     no Read-tool references)
 *   - Heading / SubHeading examples use `title=`, not `text=`
 *     (deliberate divergence from the upstream SKILL.md, documented
 *     in skillPromptContent.js's header comment)
 */
import { WIDGET_BUILDER_GUIDANCE } from "./skillPromptContent";

describe("WIDGET_BUILDER_GUIDANCE — kept sections", () => {
    test("contains the section header", () => {
        expect(WIDGET_BUILDER_GUIDANCE).toContain("Widget Builder Guidance");
    });

    test("contains Ecosystem Overview with the four-repo table", () => {
        expect(WIDGET_BUILDER_GUIDANCE).toContain("Ecosystem Overview");
        expect(WIDGET_BUILDER_GUIDANCE).toContain("dash-electron");
        expect(WIDGET_BUILDER_GUIDANCE).toContain("dash-core");
        expect(WIDGET_BUILDER_GUIDANCE).toContain("dash-react");
        expect(WIDGET_BUILDER_GUIDANCE).toContain("dash-registry");
    });

    test("contains How Widgets Work — The Big Picture", () => {
        expect(WIDGET_BUILDER_GUIDANCE).toContain("How Widgets Work");
        expect(WIDGET_BUILDER_GUIDANCE).toMatch(/Providers are app-level/);
    });

    test("contains the Quick Reference common patterns", () => {
        expect(WIDGET_BUILDER_GUIDANCE).toContain("Quick Reference");
        expect(WIDGET_BUILDER_GUIDANCE).toContain("Minimal Widget");
        expect(WIDGET_BUILDER_GUIDANCE).toContain("Widget with MCP Data");
        expect(WIDGET_BUILDER_GUIDANCE).toContain(
            "Widget .dash.js Configuration"
        );
        expect(WIDGET_BUILDER_GUIDANCE).toContain("dash.json Package Manifest");
    });
});

describe("WIDGET_BUILDER_GUIDANCE — stripped sections", () => {
    test("does NOT contain shell-driven phases", () => {
        // The "Workflow — Building a Widget" Phase 1-5 sequence
        // assumes the AI can run `node ./scripts/widgetize`,
        // `npm run dev`, `npm run package-widgets`, etc. The modal
        // has no shell tools — these instructions would mislead.
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(/Phase 1: Scaffold/);
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(/Phase 2: MCP Research/);
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(/Phase 5: Package/);
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(
            /Workflow — Building a Widget/
        );
    });

    test("does NOT contain Bash / shell scan instructions", () => {
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(
            /Before You Start — Scan This Project/
        );
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(/```bash/);
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(
            /ls "\$HOME\/Library\/Application Support/
        );
    });

    test("does NOT direct the AI at references/ files (no Read tool in modal)", () => {
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(
            /references\/widget-development\.md/
        );
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(
            /references\/mcp-integration\.md/
        );
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(
            /references\/packaging\.md/
        );
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(/Reference Documents/);
    });
});

describe("WIDGET_BUILDER_GUIDANCE — prop-name corrections vs upstream SKILL.md", () => {
    test("Heading example uses `title=`, not `text=`", () => {
        expect(WIDGET_BUILDER_GUIDANCE).toMatch(/<Heading title=/);
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(/<Heading text=/);
    });

    test("SubHeading example uses `title=`, not `text=`", () => {
        expect(WIDGET_BUILDER_GUIDANCE).toMatch(/<SubHeading title=/);
        expect(WIDGET_BUILDER_GUIDANCE).not.toMatch(/<SubHeading text=/);
    });
});
