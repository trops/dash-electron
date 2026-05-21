/**
 * promptValidation suite — score the AI's first-response widget code
 * for each of the 10 approved scenarios against the AcceptanceScorecard
 * rubric.
 *
 * Generation lives in `scripts/run-prompt-validation.js` (spawns the
 * real Claude CLI). This Jest suite reads the persisted fixtures from
 * `test/fixtures/widgets/@ai-built/prompt-validation/` and reports
 * per-scenario rubric outcomes.
 *
 * Why a separate process: the generator is a Node-CommonJS process
 * that needs to `require()` `buildSystemPrompt`, and Claude CLI calls
 * are slow (~30s each). Running the spawn loop inside Jest would make
 * the test suite take 5+ minutes per `npm run ci`, fail in CI environ-
 * ments without the `claude` binary, and burn API quota on every
 * unrelated test run. Splitting them lets `npm run ci` skip scoring
 * cleanly when fixtures are absent, and lets the user re-generate
 * fixtures on demand via the runner script.
 *
 * Skip behavior: if `manifest.json` doesn't exist, the suite emits a
 * single "skipped — fixtures not generated" test rather than failing.
 * The user runs `node scripts/run-prompt-validation.js` to populate
 * the fixtures, then re-runs this suite.
 *
 * This suite does NOT assert "every rule passes." The whole point of
 * the validation is to *measure* how good the AI's first-response
 * output is; rigid asserts would prevent us from seeing what the
 * baseline looks like. Each test logs the rubric breakdown so the
 * user can read it and decide what to tune in the system prompt.
 */

const fs = require("fs");
const path = require("path");

const { SCENARIOS } = require("./scenarios");
const { evaluateScorecard } = require("../composer/AcceptanceScorecard");

const FIXTURE_ROOT = path.resolve(
    __dirname,
    "../../../test/fixtures/widgets/@ai-built/prompt-validation"
);
const MANIFEST_PATH = path.join(FIXTURE_ROOT, "manifest.json");
const WIDGETS_DIR = path.join(FIXTURE_ROOT, "widgets");

function loadManifest() {
    if (!fs.existsSync(MANIFEST_PATH)) return null;
    try {
        return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch (err) {
        return { _parseError: err.message };
    }
}

function summarize(rows) {
    const total = rows.length;
    const passed = rows.filter((r) => r.pass === true).length;
    const failed = rows.filter((r) => r.pass === false).length;
    const na = rows.filter((r) => r.pass === null).length;
    return { total, passed, failed, na };
}

describe("promptValidation — first-response rubric outcomes", () => {
    const manifest = loadManifest();

    if (!manifest) {
        // Single skipped test makes the absence visible in the Jest
        // output without making `npm run ci` fail.
        test.skip("fixtures not generated yet — run `node scripts/run-prompt-validation.js`", () => {});
        return;
    }

    if (manifest._parseError) {
        test("manifest.json is parseable", () => {
            throw new Error(
                `manifest.json failed to parse: ${manifest._parseError}`
            );
        });
        return;
    }

    const runById = new Map((manifest.runs || []).map((r) => [r.id, r]));

    test.each(SCENARIOS.map((s) => [s.id, s]))(
        "%s — fixture is present and scored",
        (id, scenario) => {
            const run = runById.get(id);
            // No fixture for this scenario yet — the runner hasn't been
            // invoked for it or was killed mid-run. Don't fail; just
            // make the gap visible.
            if (!run) {
                console.log(
                    `[${id}] no fixture (re-run scripts/run-prompt-validation.js ${id})`
                );
                return;
            }

            console.log(
                `[${id}] parseStatus=${run.parseStatus} blocks=${
                    run.blockCount
                } duration=${(run.durationMs / 1000).toFixed(1)}s prompt="${
                    scenario.userPrompt
                }"`
            );

            if (run.parseStatus === "no-code") {
                // First-response style or genuine miss — surface it so
                // the user can read raw/<id>.md and decide if the
                // prompt needs tuning.
                console.log(
                    `  no code block extracted; assistantTextLength=${run.assistantTextLength}`
                );
                return;
            }

            const componentFile = (run.files || []).find(
                (f) => f.endsWith(".js") && !f.endsWith(".dash.js")
            );
            if (!componentFile) {
                console.log("  no component .js file persisted");
                return;
            }

            const componentPath = path.join(FIXTURE_ROOT, componentFile);
            expect(fs.existsSync(componentPath)).toBe(true);

            const code = fs.readFileSync(componentPath, "utf8");
            const rows = evaluateScorecard(code);
            const { total, passed, failed, na } = summarize(rows);
            console.log(
                `  rubric: ${passed}/${total} pass, ${failed} fail, ${na} n/a`
            );

            const failures = rows.filter((r) => r.pass === false);
            for (const f of failures) {
                const snippet = (f.matches || []).slice(0, 3).join(", ");
                console.log(
                    `    FAIL #${f.index + 1}: ${f.item.slice(0, 80)}${
                        f.item.length > 80 ? "..." : ""
                    }${snippet ? ` [matches: ${snippet}]` : ""}`
                );
            }
        }
    );

    test("manifest covers every scenario", () => {
        const missing = SCENARIOS.filter((s) => !runById.has(s.id)).map(
            (s) => s.id
        );
        if (missing.length > 0) {
            console.log(
                `Missing fixtures (re-run runner with no filter): ${missing.join(
                    ", "
                )}`
            );
        }
    });
});

// ─── AI install manifest coverage ─────────────────────────────────────
//
// The `widget:ai-build` IPC handler in `public/electron.js` calls
// `buildAiInstallPackageJson` to produce the `package.json` written at
// Install time. These tests exercise that helper against the AI's
// actual one-shot output from each scenario, simulating "if THIS
// widget went through the standalone single-widget AI install flow,
// here's what its manifest would look like."
//
// Pairs with the dash-core per-component scan check further down,
// which exercises the multi-widget package shape (closer to how the
// harness actually installs into the live cache).
//
// Why this matters: pre-fix, the handler only wrote a package.json
// when MCP usage was detected. Pure-UI widgets (Counter, Notepad) had
// no manifest at all on disk, breaking widgetPermissions identity
// pinning. The baseline test below is the regression guard.

const {
    buildAiInstallPackageJson,
} = require("../../../scripts/buildAiInstallPackageJson");
const { scanWidgetMcpUsage } = require("../../../scripts/scanWidgetMcpUsage");

// Expected MCP declarations per scenario, derived by hand from the
// fixture component sources. Variable-indirection callers
// (`callTool(name, …)` where name is a variable) don't appear here —
// the scanner intentionally skips them; the runtime gate is the
// safety net. Update this map only when re-generating fixtures
// changes the AI's call patterns.
const EXPECTED_MCP_PER_SCENARIO = {
    "01-slack-channels": {
        server: "slack",
        tool: "slack_search_channels",
    },
    "02-github-prs": {
        server: "github",
        tool: "list_pull_requests",
    },
    "08-filesystem-dir": {
        server: "filesystem",
        tool: "list_directory",
    },
    // The other scenarios call MCP tools but use variable indirection
    // (`callTool(toolName, …)` from a list returned by the provider),
    // which the static scanner correctly skips. They should produce
    // a baseline manifest with NO dash block.
};

const NO_MCP_SCENARIOS = new Set([
    "03-gmail-unread-stat", // callTool(toolName, …) — variable indirection
    "04-notion-search", // ditto
    "05-gdrive-recent", // ditto
    "06-gcal-today", // ditto
    "07-algolia-rules", // credential-class provider, no useMcpProvider
    "09-counter-noprovider", // pure UI
    "10-notepad-noprovider", // pure UI + userPrefs autosave
]);

describe("promptValidation — AI install manifest (per-widget)", () => {
    const manifest = loadManifest();
    if (!manifest) {
        test.skip("fixtures not generated yet", () => {});
        return;
    }
    const runById = new Map((manifest.runs || []).map((r) => [r.id, r]));

    test.each(SCENARIOS.map((s) => [s.id, s]))(
        "%s — AI install handler produces a valid package.json for the single-widget install case",
        (id, scenario) => {
            const run = runById.get(id);
            if (!run || !run.files || run.parseStatus === "no-code") {
                console.log(`[${id}] no fixture, skipping`);
                return;
            }
            const componentFile = run.files.find(
                (f) => f.endsWith(".js") && !f.endsWith(".dash.js")
            );
            if (!componentFile) return;
            const componentPath = path.join(FIXTURE_ROOT, componentFile);
            const componentCode = fs.readFileSync(componentPath, "utf8");

            // Mirror the handler: scan the component, then build the
            // manifest. The widget name is the file's basename
            // (handler derives it the same way from the IPC payload).
            const widgetName = path
                .basename(componentFile)
                .replace(/\.js$/, "");
            const mcpPermissions = scanWidgetMcpUsage(componentCode);
            const pkg = buildAiInstallPackageJson({
                widgetName,
                description: scenario.userPrompt,
                existingPkg: {},
                mcpPermissions,
            });

            // ── Baseline assertions: every scenario gets these
            //    regardless of MCP usage. This is the regression
            //    guard for "no package.json for non-MCP widgets".
            expect(pkg.name).toBe(`@ai-built/${widgetName.toLowerCase()}`);
            expect(pkg.version).toBe("1.0.0");
            expect(pkg.main).toBe("dist/index.cjs.js");
            expect(pkg.private).toBe(true);
            expect(typeof pkg.description).toBe("string");
            expect(pkg.description.length).toBeGreaterThan(0);

            // ── MCP block expectations
            const expectedMcp = EXPECTED_MCP_PER_SCENARIO[id];
            if (expectedMcp) {
                // This scenario's AI output literally calls a tool
                // — the manifest MUST declare it.
                expect(pkg.dash).toBeDefined();
                expect(pkg.dash.permissions).toBeDefined();
                expect(pkg.dash.permissions.mcp).toBeDefined();
                expect(
                    pkg.dash.permissions.mcp[expectedMcp.server]
                ).toBeDefined();
                expect(
                    pkg.dash.permissions.mcp[expectedMcp.server].tools
                ).toContain(expectedMcp.tool);
                console.log(
                    `[${id}] ${widgetName} declares ${expectedMcp.server}.${expectedMcp.tool}`
                );
            } else if (NO_MCP_SCENARIOS.has(id)) {
                // No statically-resolvable MCP usage → no dash block.
                // (Variable-indirection tool calls bypass the scanner
                // and rely on JIT consent; the gate gates them.)
                expect(pkg.dash).toBeUndefined();
                console.log(
                    `[${id}] ${widgetName} — baseline only (no MCP block)`
                );
            }
        }
    );

    test("every scenario falls into either EXPECTED_MCP_PER_SCENARIO or NO_MCP_SCENARIOS", () => {
        // Defensive: if someone adds a scenario without updating the
        // expectation maps, the per-scenario test above won't catch
        // it (the assertions just become weaker). This test makes
        // missing entries impossible to ignore.
        const missing = SCENARIOS.filter(
            (s) =>
                !EXPECTED_MCP_PER_SCENARIO[s.id] && !NO_MCP_SCENARIOS.has(s.id)
        ).map((s) => s.id);
        expect(missing).toEqual([]);
    });
});

// Note on test scope: the package-level per-component scan
// (`scanWidgetPackagePermissionsByComponent`) lives in dash-core and
// is verified by its own test suite there (`electron/utils/
// scanWidgetPackagePermissions.test.js` covers cross-pollination,
// orphan-helper, intra-file orchestration, etc.). The published
// dash-core npm package only ships `dist/`, so the source utils
// aren't require-able from this Jest run anyway. We rely on dash-core
// CI to keep that scanner correct and assert the AI handler's own
// manifest output here.
