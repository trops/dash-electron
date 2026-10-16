/**
 * teamWidgetTools.cjs — the widget hooks dash-core's Dash team calls
 * (create-entry PRD CRE-011, slice 3b-1), handed over in
 * botController.init({ widgetTools }):
 *
 *   build({ name, componentCode, configCode, description, provider, update })
 *       code checks → compile → install into @ai-built/ (aiBuild.cjs).
 *       An update only ever replaces an @ai-built/ widget; its old config is
 *       kept so check() can compare.
 *   checkDraft({ widgetName, componentCode, configCode, sourcePackage, files })
 *       the Widget Builder's unsaved code (and its helper files): compiled
 *       inside a copy of its package, code checks + scorecard; kept as
 *       "draft:<Name>".
 *   reviewRun(prompt, run) / installAllowed({ checkName, installName,
 *       componentCode, files, checkerUnavailable })
 *       the Checker's verdict on a draft, read from its own run; and whether
 *       the Widget Builder may install — only the exact code that passed
 *       (consolidation Phase 1a).
 *   check({ name })
 *       compile + code checks (incl. a connection's widget asking for keys)
 *       + scorecard (must-fix misses marked) for an installed widget, plus the
 *       config from before its last update (dash-core compares the two).
 *   guide({ providers })
 *       the Widget Builder's rules (SKILL.md) and the known tool names for
 *       those provider types.
 *
 * The checks are the Widget Builder's own (widgetChecks.cjs is generated
 * from src/AiAssistant). Result shapes are plain data; dash-core words them.
 */
"use strict";

const fs = require("fs");
const { compilePreview, aiBuild } = require("./aiBuild.cjs");
const checks = require("./widgetChecks.cjs");

const WIDGET_NAME = /^[A-Z][A-Za-z0-9]{1,48}$/;
// A helper file the Widget Builder wrote beside the widget: widgets/<file>.
const HELPER_PATH =
    /^widgets\/[A-Za-z0-9_][A-Za-z0-9_.-]*\.(?:js|jsx|json|css)$/;

/** "PASSED" / "FAILED" at the end of the Checker's answer, or null. */
function verdictOf(output) {
    const m = /VERDICT:\s*(PASSED|FAILED)/i.exec(String(output || ""));
    return m ? m[1].toUpperCase() : null;
}

/**
 * files[] without the widget's own component and config (by name, or by
 * content — an export the Builder renames keeps its old path), sorted.
 */
function helperFiles(files, names, primaryContents = []) {
    const own = new Set(primaryContents.filter(Boolean));
    const primary = new Set();
    for (const n of names.filter(Boolean)) {
        for (const ext of [".js", ".jsx", ".dash.js"]) {
            primary.add(`widgets/${n}${ext}`);
        }
    }
    return (Array.isArray(files) ? files : [])
        .filter(
            (f) =>
                f &&
                typeof f.path === "string" &&
                typeof f.content === "string" &&
                HELPER_PATH.test(f.path) &&
                !primary.has(f.path) &&
                !own.has(f.content)
        )
        .map((f) => ({ path: f.path, content: f.content }))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
const AI_SCOPE = "@ai-built/";

/**
 * The Widget Builder's code checks on a widget's source → problems. With
 * its .dash.js config, a widget that has a connection is also checked for
 * asking the user for keys or calling the service itself.
 */
function codeProblems(componentCode, configCode = "") {
    const problems = [];
    const api = checks.validateProviderApiUsage(componentCode);
    if (!api.ok) {
        for (const e of api.errors) {
            problems.push(
                `line ${e.line}: ${e.service}.${e.method} isn't a provider API${
                    e.suggestion ? ` — ${e.suggestion}` : ""
                }`
            );
        }
    }
    const botCalls = checks.validateNoBotCalls(componentCode);
    if (!botCalls.ok) {
        for (const e of botCalls.errors) {
            problems.push(
                `line ${e.line}: ${e.snippet} — widgets may not start bots; publish an event the user wires a bot to`
            );
        }
    }
    const publishing = checks.validateEventPublishing(componentCode);
    if (!publishing.ok) {
        for (const e of publishing.errors) {
            problems.push(
                `line ${e.line}: ${e.snippet} sends the bare event name, so no bot or widget hears it — ${e.suggestion}`
            );
        }
    }
    const modal = checks.validateNoModalUsage(componentCode);
    if (!modal.ok) {
        for (const e of modal.errors) {
            problems.push(
                `line ${e.line}: <${e.tag}> isn't allowed in a widget${
                    e.suggestion ? ` — ${e.suggestion}` : ""
                }`
            );
        }
    }
    const refs = checks.validateComponentReferences(componentCode);
    if (!refs.ok) {
        for (const e of refs.errors) {
            problems.push(
                `line ${e.line}: ${e.name} isn't a dash-react component${
                    e.suggestion ? ` — ${e.suggestion}` : ""
                }`
            );
        }
    }
    const creds = checks.validateProviderCredentials(componentCode, configCode);
    if (!creds.ok) {
        for (const e of creds.errors) {
            problems.push(
                e.kind === "setting"
                    ? `setting "${e.name}" asks for a key the ${e.provider} connection already provides — ${e.suggestion}`
                    : `line ${e.line}: calls ${e.provider} directly with fetch — ${e.suggestion}`
            );
        }
    }
    return problems;
}

// Checklist items a data widget must get right — the Checker fails it
// without them. The rest (titles, spacing, primitives) are things to improve.
const MUST_FIX = [/^Loading state/, /^Error state/];

/**
 * Scorecard rows → { failed: [{ item, matches, mustFix }], passed: n,
 * notCheckable: n }.
 */
function scorecardSummary(componentCode) {
    const rows = checks.evaluateScorecard(componentCode);
    return {
        failed: rows
            .filter((r) => r.pass === false)
            .map((r) => ({
                item: r.item,
                matches: r.matches.slice(0, 3),
                mustFix: MUST_FIX.some((re) => re.test(r.item)),
            })),
        passed: rows.filter((r) => r.pass === true).length,
        notCheckable: rows.filter((r) => r.pass === null).length,
    };
}

/**
 * @param {object} deps
 *   getRegistry(): the dash-core widget registry (getWidget)
 *   readWidgetSources({ widgetName, componentName }): dash-core's reader
 *   getWindows(): app windows told about a fresh install
 *   skillPath: the Widget Builder's SKILL.md — a path, or paths to try in
 *     order (the app folder differs between dev, packaged and test runs)
 *   aiBuild / compilePreview: optional overrides (tests)
 *   compileWidget(dir) / getPackagePath(name): the whole-package compile
 *     and an installed package's folder — dash-core's by default
 */
function createTeamWidgetTools(deps) {
    // name → the config before the Builder's last update of it (this run of
    // the app); check() hands it back so the Checker can compare.
    const previousConfigs = new Map();
    const buildWidget = deps.aiBuild || aiBuild;
    const compile = deps.compilePreview || compilePreview;
    const compilePackage =
        deps.compileWidget ||
        ((dir) =>
            require("@trops/dash-core/electron").widgetCompiler.compileWidget(
                dir
            ));
    const packagePath =
        deps.getPackagePath ||
        ((name) => {
            const w = deps.getRegistry().getWidget(name);
            return w && w.path && fs.existsSync(w.path) ? w.path : null;
        });
    // "draft:<Name>" → the Widget Builder's last check of its unsaved code,
    // for the Checker's check_widget.
    const drafts = new Map();
    let draftStamp = 0;

    /**
     * The Widget Builder's unsaved code, checked before anything is saved:
     * compiled inside a copy of its package (shared files and all — the
     * install's own build), then the code checks and the checklist. Kept as
     * "draft:<Name>" for the Checker. The installed package isn't touched.
     */
    async function checkDraft({
        widgetName,
        componentCode,
        configCode,
        sourcePackage = null,
        files = [],
    } = {}) {
        const name = String(widgetName || "").trim();
        const helpers = helperFiles(files, [name], [componentCode, configCode]);
        if (!WIDGET_NAME.test(name) || !componentCode) {
            return { success: false, error: "Which widget, with what code?" };
        }
        const path = require("path");
        const os = require("os");
        const dir = path.join(os.tmpdir(), `dash-check-${name}-${Date.now()}`);
        try {
            const from = sourcePackage ? packagePath(sourcePackage) : null;
            if (from) {
                fs.cpSync(from, dir, { recursive: true });
                for (const stale of ["dist", "index.cjs.js", "index.cjs.css"]) {
                    fs.rmSync(path.join(dir, stale), {
                        recursive: true,
                        force: true,
                    });
                }
            }
            fs.mkdirSync(path.join(dir, "widgets"), { recursive: true });
            fs.writeFileSync(
                path.join(dir, "widgets", `${name}.js`),
                componentCode
            );
            fs.writeFileSync(
                path.join(dir, "widgets", `${name}.dash.js`),
                configCode || ""
            );
            for (const h of helpers) {
                fs.writeFileSync(path.join(dir, h.path), h.content);
            }
            let compiled = { ok: true };
            try {
                await compilePackage(dir);
            } catch (err) {
                compiled = {
                    ok: false,
                    error: (err && err.message) || "didn't compile",
                };
            }
            const result = {
                success: true,
                widgetName: `draft:${name}`,
                componentName: name,
                compile: compiled,
                problems: codeProblems(componentCode, configCode || ""),
                scorecard: scorecardSummary(componentCode),
                componentCode,
                configCode: configCode || "",
                files: helpers,
                previousConfigCode: null,
            };
            Object.defineProperty(result, "stamp", { value: ++draftStamp });
            drafts.set(result.widgetName, result);
            return result;
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    async function build({
        name,
        componentCode,
        configCode,
        description = "",
        provider = null,
        update = false,
    } = {}) {
        if (!WIDGET_NAME.test(String(name || ""))) {
            return {
                success: false,
                error: "The widget name must be PascalCase letters and numbers, e.g. GmailUnreadCount.",
            };
        }
        if (!componentCode || !configCode) {
            return {
                success: false,
                error: "Both the component code and the .dash.js config are needed.",
            };
        }
        const scoped = `${AI_SCOPE}${name.toLowerCase()}`;
        const existing = deps.getRegistry().getWidget(scoped);
        if (existing && !update) {
            return {
                success: false,
                error: `${scoped} already exists. Pass update: true to change it, or pick another name.`,
            };
        }
        if (update && !existing) {
            return {
                success: false,
                error: `There's no ${scoped} to update — only widgets the AI built can be updated.`,
            };
        }
        // The Widget Builder's checks first — never install code that fails them.
        const problems = codeProblems(componentCode, configCode);
        if (problems.length) {
            return {
                success: false,
                error: "The code didn't pass the widget checks; fix these and build again.",
                problems,
            };
        }
        if (update) {
            const before = await deps.readWidgetSources({ widgetName: scoped });
            if (before && before.success) {
                previousConfigs.set(scoped, before.configCode || "");
            }
        }
        const result = await buildWidget(
            {
                widgetName: name,
                componentCode,
                configCode,
                description,
                // { type, providerClass } snaps the config's providers to
                // what the user has; anything else leaves it as written.
                selectedProvider:
                    provider && provider.type && provider.providerClass
                        ? provider
                        : null,
            },
            { windows: deps.getWindows() }
        );
        if (!result || !result.success) {
            if (update) previousConfigs.delete(scoped);
            return {
                success: false,
                error: (result && result.error) || "The build failed.",
            };
        }
        return { success: true, widgetName: result.widgetName || scoped };
    }

    async function check({ name } = {}) {
        const widgetName = String(name || "").trim();
        if (!widgetName) return { success: false, error: "Which widget?" };
        if (widgetName.startsWith("draft:")) {
            return (
                drafts.get(widgetName) || {
                    success: false,
                    error: `${widgetName} hasn't been checked yet — check it again from the Widget Builder.`,
                }
            );
        }
        const src = await deps.readWidgetSources({ widgetName });
        if (!src || !src.success) {
            return {
                success: false,
                error: (src && src.error) || `Couldn't read ${widgetName}.`,
            };
        }
        const compiled = await compile({
            widgetName: src.componentName,
            componentCode: src.componentCode,
            configCode: src.configCode,
        });
        return {
            success: true,
            widgetName,
            componentName: src.componentName,
            compile:
                compiled && compiled.success
                    ? { ok: true }
                    : {
                          ok: false,
                          error:
                              (compiled && compiled.error) || "didn't compile",
                      },
            problems: codeProblems(src.componentCode, src.configCode || ""),
            scorecard: scorecardSummary(src.componentCode),
            configCode: src.configCode || "",
            previousConfigCode: previousConfigs.has(widgetName)
                ? previousConfigs.get(widgetName)
                : null,
        };
    }

    /**
     * A Dash team Checker run (botController.run): when it reviews a draft
     * ("draft:<Name>" in its request), its verdict is kept with that draft —
     * unless the draft was checked again while it ran.
     */
    async function reviewRun(prompt, run) {
        const m = /\bdraft:([A-Z][A-Za-z0-9]{1,48})\b/.exec(
            String(prompt || "")
        );
        const key = m ? `draft:${m[1]}` : null;
        const before = key ? drafts.get(key) : null;
        const record = await run();
        const now = key ? drafts.get(key) : null;
        if (before && now && now.stamp === before.stamp) {
            Object.defineProperty(now, "review", {
                value: {
                    verdict: verdictOf(record && record.output),
                    status: (record && record.status) || null,
                },
                configurable: true,
            });
        }
        return record;
    }

    /**
     * May the Widget Builder install this? Only the exact code (and helper
     * files) that passed the code checks and the Checker — a remix's export
     * rename aside. checkerUnavailable: why the Checker couldn't review
     * (paused, not set up) — checked code then goes through, saying so.
     */
    function installAllowed({
        checkName,
        installName,
        componentCode,
        files = [],
        checkerUnavailable = null,
    } = {}) {
        const draft = drafts.get(`draft:${String(checkName || "")}`);
        if (!draft) {
            return {
                ok: false,
                error: "This widget hasn't been checked yet — wait for the check to finish.",
            };
        }
        if (!draft.compile.ok || draft.problems.length) {
            return {
                ok: false,
                error: "It didn't pass its checks — fix them first.",
            };
        }
        // The Builder may rename the default export (remix name; the
        // widget's own name over ComposedWidget) — every other byte must match.
        const unnamed = (code) =>
            String(code || "").replace(
                /(export\s+default\s+function\s+)[A-Za-z_$][\w$]*/,
                "$1__Widget__"
            );
        const sameCode =
            unnamed(componentCode) === unnamed(draft.componentCode);
        const sameHelpers =
            JSON.stringify(
                helperFiles(files, [checkName, installName], [componentCode])
            ) === JSON.stringify(draft.files);
        if (!sameCode || !sameHelpers) {
            return {
                ok: false,
                error: "The code changed after it was checked — wait for it to be checked again.",
            };
        }
        const verdict = draft.review && draft.review.verdict;
        if (verdict === "PASSED") return { ok: true, reviewSkipped: null };
        if (verdict !== "FAILED" && checkerUnavailable) {
            return { ok: true, reviewSkipped: String(checkerUnavailable) };
        }
        return {
            ok: false,
            error: "The Checker hasn't passed it yet — wait for its review, or use Check again.",
        };
    }

    function guide({ providers = [] } = {}) {
        let rules = null;
        const candidates = Array.isArray(deps.skillPath)
            ? deps.skillPath
            : [deps.skillPath];
        for (const p of candidates) {
            try {
                rules = fs.readFileSync(p, "utf8");
                break;
            } catch (_e) {
                rules = null;
            }
        }
        const tools = {};
        for (const type of Array.isArray(providers) ? providers : []) {
            const known = checks.getKnownToolsForType(String(type));
            tools[type] = (known || []).map((t) => ({
                name: t.name,
                description: t.description || "",
                args: t.args || [],
            }));
        }
        return { rules, tools };
    }

    return { build, check, checkDraft, reviewRun, installAllowed, guide };
}

module.exports = {
    createTeamWidgetTools,
    codeProblems,
    scorecardSummary,
    AI_SCOPE,
};
