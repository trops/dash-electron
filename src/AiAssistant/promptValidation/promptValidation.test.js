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
