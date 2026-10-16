/**
 * The Widget Builder's prompt carries the Dash widget rules itself
 * (create-entry PRD, phase 2e) — the dash-widget-builder skill never
 * reached the AI on its own. Pins the prompt, the main-process read, and
 * the modal waiting for the rules before the chat starts.
 */
const fs = require("fs");
const path = require("path");
const { buildSystemPrompt } = require("./widgetBuilderPrompt");

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
const BRANCHES = {
    focused: { selectedProvider: { type: "gmail", providerClass: "mcp" } },
    none: { selectedProvider: { sentinel: "none" } },
    legacy: { selectedProvider: null },
};

describe("buildSystemPrompt — Dash widget rules", () => {
    test.each(Object.keys(BRANCHES))(
        "%s branch: the rules are appended when the skill text is given",
        (key) => {
            const p = buildSystemPrompt({ ...BRANCHES[key], skillText: SKILL });
            expect(p).toContain("# Dash widget rules");
            expect(p).toContain("## Color Rule");
            expect(p).toContain("### Widget .dash.js Configuration");
            expect(p).not.toContain("## Before You Start");
        }
    );

    test("without the skill text there's no rules section", () => {
        const p = buildSystemPrompt(BRANCHES.none);
        expect(p).not.toContain("# Dash widget rules");
    });

    test("the AI is told not to call the Skill tool", () => {
        const p = buildSystemPrompt({ ...BRANCHES.none, skillText: SKILL });
        expect(p).not.toMatch(/Skill tool is allowed/);
        expect(p).toMatch(/Do NOT call any tool — not Skill/);
        expect(p).not.toMatch(/auto-loaded from/);
        expect(p).not.toMatch(/Output Protocol/);
    });

    test("the output format spells out the export/import match", () => {
        const p = buildSystemPrompt(BRANCHES.none);
        expect(p).toMatch(
            /`export default function MyWidget` → `import MyWidget from "\.\/MyWidget";`/
        );
    });
});

describe("the builder gets the rules from the main process", () => {
    const main = fs.readFileSync(
        path.join(__dirname, "..", "..", "public", "electron.js"),
        "utf8"
    );
    const preload = fs.readFileSync(
        path.join(__dirname, "..", "..", "public", "preload.js"),
        "utf8"
    );
    const modal = fs.readFileSync(
        path.join(__dirname, "WidgetBuilderModal.js"),
        "utf8"
    );

    test("main reads SKILL.md from the app's folder", () => {
        expect(main).toMatch(
            /loggedHandle\("widget:builder-skill"[\s\S]{0,900}app\.getAppPath\(\),\s*"\.claude",\s*"skills",\s*"dash-widget-builder",\s*"SKILL\.md"/
        );
    });

    test("preload exposes widgetBuilder.getSkill", () => {
        expect(preload).toMatch(
            /getSkill: \(\) => ipcRenderer\.invoke\("widget:builder-skill"\)/
        );
    });

    test("the modal loads the rules, waits for them, and passes them to the prompt", () => {
        expect(modal).toMatch(/window\.mainApi\?\.widgetBuilder\?\.getSkill/);
        expect(modal).toMatch(
            /chatMode !== "compose" &&\s*builderSkillText !== undefined &&/
        );
        expect(modal).toMatch(/skillText:\s*builderSkillText,/);
    });
});

// The Checker after an install was replaced by checks while the code is
// written (WidgetBuilderModal.checkFirst.test.js).
