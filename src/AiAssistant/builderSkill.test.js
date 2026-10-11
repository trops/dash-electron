/**
 * builderSkill — the dash-widget-builder skill sections that go into the
 * Widget Builder's system prompt (phase 2e). Checked against the real skill
 * so the rules the AI needs can't silently drop out.
 */
const fs = require("fs");
const path = require("path");
const { builderSkillSections } = require("./builderSkill");

const SKILL = fs.readFileSync(
    path.join(
        __dirname,
        "..",
        "..",
        ".claude",
        "skills",
        "dash-widget-builder",
        "SKILL.md"
    ),
    "utf8"
);
const rules = builderSkillSections(SKILL);

describe("builderSkillSections — the real skill", () => {
    test.each([
        "## Single-Purpose Widget Rule",
        "## Primitive Palette",
        "## Color Rule",
        "## Quick Reference",
        "### Minimal Widget",
        "### Widget .dash.js Configuration",
        "#### Provider classes: credential vs MCP",
        "## Available IPC Methods",
        "## Cross-Widget Events",
        "## Scheduled Tasks",
        "## Defensive Coding Rules",
        "## Install-Time Permission Gate",
    ])("keeps %s", (heading) => {
        expect(rules).toContain(heading);
    });

    test.each([
        "## Before You Start",
        "## Reference Documents",
        "### Phase 1: Scaffold",
        "### Phase 4: Test",
        "### Phase 5: Package",
    ])("drops the terminal-only %s", (heading) => {
        expect(rules).not.toContain(heading);
    });

    test("keeps provider research and building, drops no front matter guidance", () => {
        expect(rules).toContain("### Phase 2: Provider Research");
        expect(rules).toContain("### Phase 3: Build the Widget");
        expect(rules.startsWith("---")).toBe(false);
    });

    test("the config example imports the component the way the component exports it", () => {
        // Minimal Widget: export default function MyWidget → default import.
        expect(rules).toMatch(/export default function MyWidget/);
        expect(rules).toMatch(/import MyWidget from "\.\/MyWidget";/);
        const cfg = rules.slice(
            rules.indexOf("### Widget .dash.js Configuration")
        );
        const block = /```javascript\n([\s\S]*?)```/.exec(cfg)[1];
        expect(block.split("\n")[0]).toBe('import MyWidget from "./MyWidget";');
    });

    test("is a good deal smaller than the whole skill", () => {
        expect(rules.length).toBeLessThan(SKILL.length * 0.9);
        expect(rules.length).toBeGreaterThan(20000);
    });
});

describe("builderSkillSections — parsing", () => {
    test("no skill → empty", () => {
        expect(builderSkillSections(null)).toBe("");
        expect(builderSkillSections("")).toBe("");
    });

    test("# lines inside code blocks aren't headings", () => {
        const text = [
            "## Keep",
            "a",
            "## Before You Start",
            "```bash",
            "## not a heading",
            "```",
            "b",
            "## Also keep",
            "c",
        ].join("\n");
        const out = builderSkillSections(text);
        expect(out).toContain("## Keep\na");
        expect(out).toContain("## Also keep\nc");
        expect(out).not.toContain("not a heading");
        expect(out).not.toContain("\nb\n");
    });
});
