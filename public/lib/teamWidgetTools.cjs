/**
 * teamWidgetTools.cjs — the widget hooks dash-core's Dash team calls
 * (create-entry PRD CRE-011, slice 3b-1), handed over in
 * botController.init({ widgetTools }):
 *
 *   build({ name, componentCode, configCode, description, provider, update,
 *           edit })
 *       code checks → compile → a draft, installed into @ai-built/
 *       (aiBuild.cjs) once the Checker passed it. An update only ever
 *       replaces an @ai-built/ widget; its old config is kept so check() can
 *       compare. During a change to one widget the user has (edit, from
 *       dash-core — consolidation Phase 3) the build is held to that widget:
 *       in place it keeps its name and is built inside a copy of its own
 *       package (installed with Update original); as new, it's built in a
 *       copy of that package and installed as a remix of it.
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
const { compilePreview, aiBuild, helperFiles } = require("./aiBuild.cjs");
const { prepareWidgetConfig } = require("./widgetImportFixes.cjs");
const checks = require("./widgetChecks.cjs");

const WIDGET_NAME = /^[A-Z][A-Za-z0-9]{1,48}$/;

/** "PASSED" / "FAILED" at the end of the Checker's answer, or null. */
function verdictOf(output) {
    const m = /VERDICT:\s*(PASSED|FAILED)/i.exec(String(output || ""));
    return m ? m[1].toUpperCase() : null;
}

/**
 * Problems in the helper files' code, named by each file's path. Tests and
 * stories are skipped unless includeTests (the install gate passes it for
 * the ones a widget imports).
 */
function helperProblems(helpers, { includeTests = false } = {}) {
    const problems = [];
    for (const h of helpers || []) {
        if (!/\.(?:js|jsx)$/.test(h.path)) continue;
        if (!includeTests && NOT_WIDGET_CODE.test(h.path)) continue;
        for (const p of codeProblems(String(h.content || ""), "")) {
            problems.push(`${h.path}: ${p}`);
        }
    }
    return problems;
}
// Tests and stories ship in some packages but aren't widget code.
const NOT_WIDGET_CODE = /(?:^|\/)__tests__\/|\.(?:test|spec|stories)\.[jt]sx?$/;
const AI_SCOPE = "@ai-built/";

/**
 * The team writes settings the documented way: userConfig as an object
 * keyed by setting name. Dash reads a list too (installed widgets keep
 * working), so this holds the team's builds only — not the install gate.
 */
function configProblems(configCode) {
    return /\buserConfig\s*:\s*\[/.test(String(configCode || ""))
        ? [
              'userConfig is a list — write it as an object keyed by setting name, e.g. userConfig: { title: { type: "text", displayName: "Title", defaultValue: "Counter" } }',
          ]
        : [];
}

/**
 * The Widget Builder's code checks on a widget's source → problems. With
 * its .dash.js config, a widget that has a connection is also checked for
 * asking the user for keys or calling the service itself. With the code of
 * the widget being changed (previousCode), only colors the change adds count
 * — an older widget's own colors don't block an edit to it.
 */
function codeProblems(
    componentCode,
    configCode = "",
    { previousCode = null } = {}
) {
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
    // Design guide: color comes from dash-react, never the call site.
    const colors = checks.validateNoHardcodedColors(componentCode);
    if (!colors.ok) {
        for (const e of colors.errors) {
            const raw = e.snippet.replace(/\(\)$/, "(");
            if (previousCode && previousCode.includes(raw)) continue;
            problems.push(
                `line ${e.line}: ${e.snippet} is a hard-coded color — ${e.suggestion}`
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
    // name → the component code before that update, so the checks only
    // count colors the update added.
    const previousComponents = new Map();
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
    // During a Checker run (reviewRun): the drafts it ran check_widget on,
    // each with its stamp at the check — the verdict counts only for those.
    let reviewing = null;

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
        previousCode = null,
    } = {}) {
        const name = String(widgetName || "").trim();
        const helpers = helperFiles(files, [name], [componentCode, configCode]);
        if (!WIDGET_NAME.test(name) || !componentCode) {
            return { success: false, error: "Which widget, with what code?" };
        }
        const path = require("path");
        const os = require("os");
        // Its own folder: two checks of one widget at once never share one.
        const dir = fs.mkdtempSync(
            path.join(os.tmpdir(), `dash-check-${name}-`)
        );
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
            // The same config fixes the install makes (type: "widget", the
            // export, the component import) — so the draft compiles and
            // previews as it will install.
            fs.writeFileSync(
                path.join(dir, "widgets", `${name}.dash.js`),
                prepareWidgetConfig(configCode || "", {
                    componentSource: componentCode,
                    componentName: name,
                }).source
            );
            for (const h of helpers) {
                const target = path.join(dir, h.path);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, h.content);
            }
            let compiled = { ok: true };
            let bundleSource = null;
            try {
                await compilePackage(dir);
                // Kept for the user's preview before install (cell builds,
                // consolidation Phase 2b) — the very code that was checked.
                const out = path.join(dir, "dist", "index.cjs.js");
                if (fs.existsSync(out)) {
                    bundleSource = fs.readFileSync(out, "utf8");
                }
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
                problems: [
                    ...codeProblems(componentCode, configCode || "", {
                        previousCode,
                    }),
                    ...helperProblems(helpers),
                ],
                scorecard: scorecardSummary(componentCode),
                componentCode,
                configCode: configCode || "",
                files: helpers,
                previousConfigCode: null,
            };
            Object.defineProperty(result, "stamp", { value: ++draftStamp });
            // Not part of what the Checker reads; only previewDraft hands it out.
            Object.defineProperty(result, "bundleSource", {
                value: bundleSource,
            });
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
        edit = null,
    } = {}) {
        if (edit) {
            return buildChange({
                name,
                componentCode,
                configCode,
                description,
                provider,
                update,
                edit,
            });
        }
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
        // The widget as it is, for an update: the Checker compares configs,
        // and only colors the update adds count.
        const before = update
            ? await deps.readWidgetSources({ widgetName: scoped })
            : null;
        const previousCode =
            before && before.success ? before.componentCode || "" : null;
        // The Widget Builder's checks first — a draft that fails them isn't kept.
        const problems = [
            ...codeProblems(componentCode, configCode, { previousCode }),
            ...configProblems(configCode),
        ];
        if (problems.length) {
            return {
                success: false,
                error: "The code didn't pass the widget checks; fix these and build again.",
                problems,
            };
        }
        // Written as a draft — nothing is installed until the Checker passes
        // it (consolidation Phase 1b). Built inside a copy of the widget's
        // package when it updates one, the same as the install's build.
        const draft = await checkDraft({
            widgetName: name,
            componentCode,
            configCode,
            sourcePackage: update ? scoped : null,
            previousCode,
        });
        if (!draft || !draft.success) {
            return {
                success: false,
                error: (draft && draft.error) || "The build failed.",
            };
        }
        if (!draft.compile.ok) {
            return {
                success: false,
                error: `It didn't build: ${draft.compile.error}`,
            };
        }
        if (before && before.success) {
            draft.previousConfigCode = before.configCode || "";
            // Kept off the tool result (the Checker gets the draft as JSON).
            Object.defineProperty(draft, "previousComponentCode", {
                value: previousCode,
            });
        }
        // What installing it takes, once it passes.
        Object.defineProperty(draft, "install", {
            value: {
                description,
                // { type, providerClass } snaps the config's providers to
                // what the user has; anything else leaves it as written.
                selectedProvider:
                    provider && provider.type && provider.providerClass
                        ? provider
                        : null,
                scoped,
            },
        });
        return { success: true, widgetName: draft.widgetName, package: scoped };
    }

    /**
     * A change to one widget the user has (consolidation Phase 3): the
     * Builder's build, held to edit = { package, componentName, mode,
     * aiBuilt } (worked out in dash-core from what's installed). In place,
     * it keeps the widget's name and compiles inside a copy of its package;
     * as new, a new @ai-built name, compiled in a copy of that package and
     * installed as a remix of it. The draft remembers the change, so only
     * that change's preview installs it.
     */
    async function buildChange({
        name,
        componentCode,
        configCode,
        description,
        provider,
        update,
        edit,
    }) {
        const inPlace = edit.mode === "update";
        const pkg = String(edit.package || "");
        const own = String(edit.componentName || "");
        if (!WIDGET_NAME.test(String(name || ""))) {
            return {
                success: false,
                error: "The widget name must be PascalCase letters and numbers, e.g. GmailUnreadCount.",
            };
        }
        if (inPlace && name !== own) {
            return {
                success: false,
                error: `This change goes into ${own} itself: build it with name "${own}" and update: true.`,
            };
        }
        if (!inPlace && update) {
            return {
                success: false,
                error: `This change is saved as a new widget — ${own} stays as it is. Build it under a new name, without update.`,
            };
        }
        if (!componentCode || !configCode) {
            return {
                success: false,
                error: "Both the component code and the .dash.js config are needed.",
            };
        }
        if (!deps.getRegistry().getWidget(pkg)) {
            return {
                success: false,
                error: `${pkg} isn't installed here any more.`,
            };
        }
        const scoped = inPlace ? pkg : `${AI_SCOPE}${name.toLowerCase()}`;
        if (
            inPlace &&
            edit.aiBuilt &&
            scoped !== `${AI_SCOPE}${own.toLowerCase()}`
        ) {
            return {
                success: false,
                error: `${own} shares its package with other widgets, so it can't be changed in place here — save the change as a new widget.`,
            };
        }
        if (!inPlace && deps.getRegistry().getWidget(scoped)) {
            return {
                success: false,
                error: `${scoped} already exists — pick another name for the new widget.`,
            };
        }
        // The widget being changed: in place, the Checker compares configs;
        // either way only colors the change adds count.
        const before = await deps.readWidgetSources({
            widgetName: pkg,
            componentName: own,
        });
        const previousCode =
            before && before.success ? before.componentCode || "" : null;
        const problems = [
            ...codeProblems(componentCode, configCode, { previousCode }),
            ...configProblems(configCode),
        ];
        if (problems.length) {
            return {
                success: false,
                error: "The code didn't pass the widget checks; fix these and build again.",
                problems,
            };
        }
        // Built inside a copy of the widget's package either way — its other
        // files come along, as they will when it's installed.
        const draft = await checkDraft({
            widgetName: name,
            componentCode,
            configCode,
            sourcePackage: pkg,
            previousCode,
        });
        if (!draft || !draft.success) {
            return {
                success: false,
                error: (draft && draft.error) || "The build failed.",
            };
        }
        if (!draft.compile.ok) {
            return {
                success: false,
                error: `It didn't build: ${draft.compile.error}`,
            };
        }
        if (previousCode != null) {
            Object.defineProperty(draft, "previousComponentCode", {
                value: previousCode,
            });
        }
        // In place, the Checker compares it with the widget as it was.
        if (inPlace && before && before.success) {
            draft.previousConfigCode = before.configCode || "";
        }
        const manifest = (before && before.manifest) || {};
        Object.defineProperty(draft, "install", {
            value: {
                description,
                selectedProvider:
                    provider && provider.type && provider.providerClass
                        ? provider
                        : null,
                scoped,
                // Which change this draft is: only its preview installs it.
                edit: { package: pkg, mode: edit.mode },
                // Update original on the user's own package (not @ai-built).
                updateOriginal: inPlace && !edit.aiBuilt ? pkg : null,
                remixMeta: inPlace
                    ? null
                    : {
                          remixedFrom: {
                              package: pkg,
                              component: own,
                              author: manifest.author || "Unknown",
                              version: manifest.version || "1.0.0",
                          },
                      },
            },
        });
        return { success: true, widgetName: draft.widgetName, package: scoped };
    }

    /**
     * Install a draft the Checker passed (a plan build's Install step;
     * place_widget with a draft) — exactly the code that was checked, as
     * @ai-built/<name>. Refused when it was never written, didn't pass its
     * code checks, or the Checker hasn't passed this exact version.
     */
    async function installDraft({ name, edit = null } = {}) {
        const key = String(name || "").trim();
        const draft = drafts.get(key);
        if (!draft) {
            return {
                success: false,
                error: `There's no ${key} to install — build_widget writes it first.`,
            };
        }
        if (!draft.install) {
            return {
                success: false,
                error: `${key} was changed in the Widget Builder since the Builder wrote it — build it again with build_widget.`,
            };
        }
        // A change's draft installs only from that change's preview, and a
        // change installs only its own draft (consolidation Phase 3).
        const made = draft.install.edit || null;
        if (
            (made || edit) &&
            !(
                made &&
                edit &&
                made.package === edit.package &&
                made.mode === edit.mode
            )
        ) {
            return {
                success: false,
                error: made
                    ? `${key} is a change to ${made.package} — it's installed from its preview in Create.`
                    : `${key} wasn't built as this change — build it again.`,
            };
        }
        // Installed already: it's that widget now (never installed twice —
        // a newer version would be overwritten with this one).
        if (draft.installedAs) {
            return {
                success: true,
                widgetName: draft.installedAs,
                already: true,
            };
        }
        if (!draft.compile.ok || draft.problems.length) {
            return {
                success: false,
                error: `${key} didn't pass its checks — fix them and build it again.`,
            };
        }
        if (!draft.review || draft.review.verdict !== "PASSED") {
            return {
                success: false,
                error: `${key} hasn't passed the Checker yet — ask the Checker to check ${key}.`,
            };
        }
        const result = await buildWidget(
            {
                widgetName: draft.componentName,
                componentCode: draft.componentCode,
                configCode: draft.configCode,
                description: draft.install.description,
                selectedProvider: draft.install.selectedProvider,
                // A change (Phase 3): in place on the user's own package, or
                // a new widget made from it.
                ...(draft.install.updateOriginal
                    ? { updateOriginal: draft.install.updateOriginal }
                    : {}),
                ...(draft.install.remixMeta
                    ? { remixMeta: draft.install.remixMeta }
                    : {}),
            },
            { windows: deps.getWindows() }
        );
        if (!result || !result.success) {
            return {
                success: false,
                error: (result && result.error) || "The install failed.",
            };
        }
        const widgetName = result.widgetName || draft.install.scoped;
        if (draft.previousConfigCode != null) {
            previousConfigs.set(widgetName, draft.previousConfigCode);
        }
        if (draft.previousComponentCode != null) {
            previousComponents.set(widgetName, draft.previousComponentCode);
        }
        Object.defineProperty(draft, "installedAs", { value: widgetName });
        return { success: true, widgetName };
    }

    async function check({ name } = {}) {
        const widgetName = String(name || "").trim();
        if (!widgetName) return { success: false, error: "Which widget?" };
        if (widgetName.startsWith("draft:")) {
            const draft = drafts.get(widgetName);
            if (draft && reviewing) reviewing.set(widgetName, draft.stamp);
            return (
                draft || {
                    success: false,
                    error: `${widgetName} hasn't been written or checked yet.`,
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
            problems: codeProblems(src.componentCode, src.configCode || "", {
                previousCode: previousComponents.get(widgetName) || null,
            }),
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
    /**
     * A Checker run: its verdict is recorded on the draft it ran check_widget
     * on — only when it checked exactly one, and that draft hasn't changed
     * since (a verdict never lands on a draft named in the request but not
     * checked, nor authorizes a rewrite). `prompt` is the request (kept for
     * the callers; the check itself decides which draft).
     */
    async function reviewRun(prompt, run) {
        const outer = reviewing;
        const seen = new Map();
        reviewing = seen;
        let record;
        try {
            record = await run();
        } finally {
            reviewing = outer;
        }
        if (seen.size === 1) {
            const [[key, stamp]] = [...seen];
            const now = drafts.get(key);
            if (now && now.stamp === stamp) {
                Object.defineProperty(now, "review", {
                    value: {
                        verdict: verdictOf(record && record.output),
                        status: (record && record.status) || null,
                    },
                    configurable: true,
                });
            }
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

    /**
     * A checked draft's compiled code, for the user's preview before it's
     * installed (cell builds, consolidation Phase 2b): { success,
     * bundleSource, componentName, configCode } or { success: false, error }.
     */
    function previewDraft({ name } = {}) {
        const key = String(name || "").trim();
        const draft = drafts.get(key);
        if (!draft) {
            return {
                success: false,
                error: `${
                    key || "That draft"
                } isn't here any more — build it again.`,
            };
        }
        if (!draft.bundleSource) {
            return { success: false, error: "That draft didn't compile." };
        }
        return {
            success: true,
            bundleSource: draft.bundleSource,
            componentName: draft.componentName,
            // Its code, for the preview's Code and What changed (Phase 3).
            componentCode: draft.componentCode || "",
            configCode: draft.configCode || "",
        };
    }

    return {
        build,
        check,
        checkDraft,
        previewDraft,
        installDraft,
        reviewRun,
        installAllowed,
        guide,
    };
}

module.exports = {
    createTeamWidgetTools,
    codeProblems,
    configProblems,
    helperProblems,
    NOT_WIDGET_CODE,
    scorecardSummary,
    AI_SCOPE,
};
