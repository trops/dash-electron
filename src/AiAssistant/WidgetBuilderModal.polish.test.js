/**
 * Widget Builder polish (static source checks, like the toolbar test):
 *
 *   - The builder is wrapped in the APP theme (it mounts outside the
 *     theme provider).
 *   - It builds by hand (consolidation Phase 3b): Compose for a new widget,
 *     the Code tab for an installed one, no AI chat or Discover.
 *   - The footer says why Install is greyed out (no category yet).
 */
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("WidgetBuilderModal — polish", () => {
    test("the whole builder renders inside the app theme", () => {
        expect(source).toMatch(/window\.__dashAppThemeContext/);
        expect(source).toMatch(
            /<ThemeContext\.Provider\s+value=\{chatThemeCtx\}>\s*<Frame/
        );
    });

    test("builds by hand: no chat, no Discover, no Build/Compose switch", () => {
        expect(source).not.toMatch(/ChatCore|ChatProviderGate|setChatMode/);
        expect(source).not.toMatch(/Discover existing|discoverResults/);
        expect(source).not.toMatch(/"How to make the widget"/);
        expect(source).toMatch(/glyph="wrench"/);
        expect(source).toMatch(/: "Build by hand"/);
        expect(source).toMatch(/· editing the code/);
    });

    test("Compose is for a new widget; an installed widget's code opens on Code", () => {
        expect(source).toMatch(
            /const showCompose = !effectiveEditContext\?\.componentCode && !codeOnly;/
        );
        expect(source).toMatch(
            /"Edit the code yourself" opens on the code[\s\S]{0,160}setActiveTab\("code"\);/
        );
        expect(source).toMatch(/\{showCompose && \(/);
    });

    test("an old chat draft is edited as code (no Compose layout, or saved from the chat)", () => {
        expect(source).toMatch(
            /const asCode =\s*!!restoredCode\.componentCode &&\s*\(!full\.composerGrid \|\|\s*\(!!full\.chatMode && full\.chatMode !== "compose"\)\);/
        );
    });

    test("a new widget needs a name of the user's before Install", () => {
        expect(source).toMatch(
            /\/\^ComposedWidget\\d\*\$\/\.test\(widgetName\)/
        );
        expect(source).toMatch(/Goes into your widgets as \$\{displayName\}/);
        expect(source).toMatch(/"Name the widget first"/);
    });

    test("Compose's Ask the Dash team closes the builder and opens a Dash Lead conversation about a widget (6c)", () => {
        expect(source).toMatch(
            /const askDashTeam = \(text\) => \{\s*setIsOpen\(false\);/
        );
        expect(source).toMatch(
            /"dash:open-workspace", \{\s*detail: \{\s*key: "role:dashlead",\s*making: \{ kind: "widget" \},\s*draft: text \|\| "",/
        );
        expect(source).not.toMatch(/dash:open-create/);
        expect(source).toMatch(/onAskDashTeam=\{askDashTeam\}/);
    });

    test("the missing-files hint only matches real import errors", () => {
        const hint = source.match(
            /\{(\/Could not resolve[^/]*\/i)\.test\(\s*previewError/
        );
        expect(hint).not.toBeNull();
        // "/body/i" from the source → a RegExp (body only, no eval).
        const re = new RegExp(hint[1].slice(1, -2), "i");
        expect(re.test('Could not resolve "./utils"')).toBe(true);
        expect(re.test("Cannot find module './x'")).toBe(true);
        expect(re.test("Could not resolve widget component from bundle.")).toBe(
            false
        );
    });

    test("a draft is named by its widget, else Untitled draft (no chat to name it from)", () => {
        expect(source).toMatch(
            /const draftName = componentName \|\| "Untitled draft";/
        );
    });

    test("Compose (V2) drafts save and restore their grid", () => {
        // Saved with the draft…
        expect(source).toMatch(/composerGrid: composerGridRef\.current/);
        // …and restored by the one resume path (drafts list and
        // resumeDraftId both go through resumeFromDraft).
        expect(
            source.match(/setComposerInitialGrid\(full\.composerGrid\)/g) || []
        ).toHaveLength(1);
        expect(source).toMatch(
            /onResume=\{\(draft\) =>\s*resumeFromDraft\(draft\.id, draft\)\s*\}/
        );
        // "Build new widget" starts from an empty grid.
        expect(source).toMatch(/setComposerInitialGrid\(null\)/);
    });
});

describe("WidgetBuilderModal — wording (consolidation Phase 4d)", () => {
    test("the tabs are Logs and Style checks, not Console and Scorecard", () => {
        expect(source).toMatch(/label="Logs"/);
        expect(source).toMatch(/label="Style checks"/);
        expect(source).not.toMatch(/label="Console"/);
        expect(source).not.toMatch(/label="Scorecard"/);
        expect(source).not.toMatch(/cohesion rule/i);
    });

    test("Category says what it's for", () => {
        expect(source).toMatch(
            /title="Where it's listed when you publish it\."/
        );
        expect(source).toMatch(
            /Pick\s+a\s+category\s+to\s+install\s+—\s+it's\s+where\s+the\s+widget\s+is\s+listed\s+when\s+you\s+publish\s+it/
        );
    });
});
