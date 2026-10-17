/**
 * aiBuild.cjs — the AI Widget Builder's compile and install, callable from
 * anywhere in the main process (create-entry PRD CRE-011, slice 3b-1): the
 * widget:ai-compile-preview / widget:ai-build IPC handlers and the Dash
 * team's Builder (teamWidgetTools.cjs) both use it. Moved verbatim from
 * public/electron.js.
 *
 *   compilePreview(message)            → { success, bundleSource, … } | { success: false, error, … }
 *   aiBuild(message, { windows })      → { success, widgetName } | { success: false, error }
 *
 * `windows` is the set of app windows told about a fresh install.
 */
"use strict";

// Config fix-ups before compiling: a missing export default, a component
// import that doesn't match its export, a missing type: "widget".
const {
    prepareWidgetConfig,
    claimConfigIdentity,
} = require("./widgetImportFixes.cjs");

// The primary widget component's source in a multi-file payload, else the
// legacy componentCode.
function primaryComponentOf(files, widgetName, componentCode) {
    const hit = (Array.isArray(files) ? files : []).find(
        (f) =>
            f &&
            typeof f.path === "string" &&
            (f.path === `widgets/${widgetName}.js` ||
                f.path === `widgets/${widgetName}.jsx` ||
                f.path.endsWith(`/${widgetName}.js`))
    );
    return (hit && hit.content) || componentCode || "";
}

// ── Multi-file payload helpers ──────────────────────────────
//
// The AI Widget Builder may emit a multi-file package (Phase 2):
// every code block is preceded by a `File: <relative-path>`
// marker, and the renderer ships a `files: [{path, content}]`
// array alongside the legacy componentCode + configCode strings.
//
// The AI is being trusted to write to disk — these helpers are
// the security gate. Anything that doesn't pass goes nowhere.
const ALLOWED_FILE_EXTENSIONS = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".md",
    ".css",
    ".txt",
]);
const FORBIDDEN_PATH_PREFIXES = ["dist/", "node_modules/", ".git/", ".github/"];

function validateAiFilePath(rawPath) {
    if (typeof rawPath !== "string" || rawPath.length === 0) {
        return { ok: false, error: "Empty path" };
    }
    // Disallow absolute paths and Windows drive letters.
    if (
        rawPath.startsWith("/") ||
        rawPath.startsWith("\\") ||
        /^[a-zA-Z]:[\\/]/.test(rawPath)
    ) {
        return {
            ok: false,
            error: `Absolute paths are not allowed: ${rawPath}`,
        };
    }
    // Normalize and reject any segment that climbs out.
    const segments = rawPath.split(/[\\/]/);
    if (segments.some((s) => s === "..")) {
        return {
            ok: false,
            error: `Path traversal blocked: ${rawPath}`,
        };
    }
    // Reject hidden dotfile / dotdir at any segment.
    if (segments.some((s) => s.length > 0 && s.startsWith("."))) {
        return {
            ok: false,
            error: `Hidden paths not allowed: ${rawPath}`,
        };
    }
    // Reject forbidden prefixes (dist/, node_modules/, .git/).
    const normalized = rawPath.replace(/\\/g, "/");
    for (const prefix of FORBIDDEN_PATH_PREFIXES) {
        if (
            normalized === prefix.slice(0, -1) ||
            normalized.startsWith(prefix)
        ) {
            return {
                ok: false,
                error: `Reserved path not allowed: ${rawPath}`,
            };
        }
    }
    // Extension allow-list. Files at the package root with no
    // extension (rare, e.g. LICENSE) are also rejected for safety.
    const dotIdx = rawPath.lastIndexOf(".");
    const ext = dotIdx >= 0 ? rawPath.slice(dotIdx) : "";
    // .dash.js counts as .js for this check.
    const effectiveExt = rawPath.endsWith(".dash.js") ? ".js" : ext;
    if (!ALLOWED_FILE_EXTENSIONS.has(effectiveExt)) {
        return {
            ok: false,
            error: `File extension not allowed: ${rawPath}`,
        };
    }
    return { ok: true, normalized };
}

/**
 * files[] without the widget's own component and config (by name, or by
 * content — an export the Builder renames keeps its old path), sorted:
 * the helper files the Widget Builder checks, compares and installs. Any
 * path writeAiFiles accepts (widgets/ subfolders and other package files
 * included — consolidation Phase 1a-2).
 */
function helperFiles(files, names, primaryContents = []) {
    const own = new Set(primaryContents.filter(Boolean));
    const primary = new Set();
    for (const n of names.filter(Boolean)) {
        for (const ext of [".js", ".jsx", ".dash.js"]) {
            primary.add(`widgets/${n}${ext}`);
        }
    }
    const helpers = [];
    for (const f of Array.isArray(files) ? files : []) {
        if (!f || typeof f.path !== "string") continue;
        const v = validateAiFilePath(f.path);
        if (!v.ok || primary.has(v.normalized) || own.has(f.content)) continue;
        helpers.push({ path: v.normalized, content: f.content });
    }
    return helpers.sort((a, b) =>
        a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    );
}

/**
 * Write each entry of files[] into stagingDir after path
 * validation. Returns the count written and the list of skipped
 * entries with reasons. Throws only on FS errors — invalid
 * paths are reported in the result so the caller can decide
 * whether to fail or continue.
 */
function writeAiFiles(stagingDir, files) {
    const path = require("path");
    const fs = require("fs");
    const result = { written: 0, skipped: [] };
    for (const entry of files || []) {
        const v = validateAiFilePath(entry?.path);
        if (!v.ok) {
            result.skipped.push({ path: entry?.path, error: v.error });
            continue;
        }
        const target = path.join(stagingDir, v.normalized);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            typeof entry.content === "string" ? entry.content : "",
            "utf8"
        );
        result.written++;
    }
    return result;
}

/**
 * Auto-correct safety net for the ChatProviderGate's type+class
 * selection. The user chose a provider TYPE in the gate UI; the
 * LLM may have generated
 * a config that declares a different `type` or `providerClass`
 * (training-data anchor, search_widgets imitation, etc.). Snap
 * the config's `providers: [...]` to match the picker so the
 * widget on disk always uses the user's chosen provider.
 *
 * Conservative regex rewrite: only touches the first
 * `providers: [...]` array literal. Other shapes (computed,
 * spread, multi-array) fall through unchanged — those are rare
 * enough that we accept the AI's output rather than risk
 * mangling code we don't understand. The widget will then
 * surface the mismatch via the existing missing-provider banner.
 *
 * @param {string} configCode - the .dash.js source
 * @param {object|null} selectedProvider - { type, providerClass }
 *   or { sentinel: "none" } or null
 * @returns {{ source: string, rewrote: boolean, reason?: string }}
 */
function snapProvidersToSelection(configCode, selectedProvider) {
    if (!configCode || !selectedProvider) {
        return { source: configCode, rewrote: false };
    }
    // "no external provider" → strip any providers array.
    if (selectedProvider.sentinel === "none") {
        if (!/providers\s*:\s*\[/.test(configCode)) {
            return { source: configCode, rewrote: false };
        }
        const stripped = configCode.replace(
            /providers\s*:\s*\[[^[\]]*?\]\s*,?\s*/,
            ""
        );
        return {
            source: stripped,
            rewrote: stripped !== configCode,
            reason: "user picked No external provider",
        };
    }
    const { type, providerClass } = selectedProvider;
    if (!type || !providerClass) {
        return { source: configCode, rewrote: false };
    }
    const desired = `providers: [{ type: "${type}", providerClass: "${providerClass}", required: true }]`;
    // Replace the existing providers array if present.
    if (/providers\s*:\s*\[[^[\]]*?\]/.test(configCode)) {
        const replaced = configCode.replace(
            /providers\s*:\s*\[[^[\]]*?\]/,
            desired
        );
        return {
            source: replaced,
            rewrote: replaced !== configCode,
            reason:
                replaced !== configCode
                    ? `snapped providers to picker: ${type}/${providerClass}`
                    : undefined,
        };
    }
    // No providers array — inject one before the closing brace.
    const injected = configCode.replace(
        /(export\s+default\s*\{)([\s\S]*?)(\s*\}\s*;?\s*)$/,
        (_m, head, body, tail) => {
            const cleaned = body.replace(/,\s*$/, "");
            const sep = cleaned.trim().length > 0 ? "," : "";
            return `${head}${cleaned}${sep} ${desired}${tail}`;
        }
    );
    return {
        source: injected,
        rewrote: injected !== configCode,
        reason:
            injected !== configCode
                ? `injected missing providers array: ${type}/${providerClass}`
                : undefined,
    };
}

// --- AI Widget Builder: Preview Compile ---
// Compiles widget code and returns the bundle source for live preview.
// Does NOT install — just compile and return.
async function compilePreview(message) {
    const {
        widgetName,
        componentCode,
        sourcePackage,
        files,
        selectedProvider,
    } = message;
    // Snap the config's providers array to the user's pick before
    // anything else uses it (compile uses configCode + files).
    const providerSnap = snapProvidersToSelection(
        message.configCode,
        selectedProvider
    );
    if (providerSnap.rewrote) {
        console.log(
            "[ai-compile-preview] Provider auto-correct:",
            providerSnap.reason
        );
    }
    // AI configs sometimes omit `type: "widget"`, never export the
    // config, or import the component the wrong way — fix those
    // slips before compiling (preview + install).
    const configPrep = prepareWidgetConfig(providerSnap.source, {
        componentSource: componentCode,
        componentName: widgetName,
    });
    if (configPrep.fixes.length) {
        console.log("[widget-config] Auto-fixed:", configPrep.fixes.join("; "));
    }
    const configCode = configPrep.source;
    const path = require("path");
    const fs = require("fs");
    const os = require("os");

    try {
        // ── Fast path: use the existing pre-built bundle ────────
        // If sourcePackage is provided AND the source code matches
        // the original on disk, skip recompilation entirely and
        // return the existing bundle. This is instant and avoids
        // all compilation issues with multi-file packages.
        if (sourcePackage) {
            const dashCore = require("@trops/dash-core/electron");
            const registry = dashCore.widgetRegistry.getWidgetRegistry();
            const widget = registry.getWidget(sourcePackage);
            if (widget?.path) {
                const existingBundle = path.join(widget.path, "index.cjs.js");
                if (fs.existsSync(existingBundle)) {
                    // Check if source code matches the original
                    // (user hasn't modified it yet via AI)
                    const { findWidgetsDir } =
                        require("@trops/dash-core/electron").widgetCompiler;
                    const widgetsDir = findWidgetsDir(widget.path);
                    let sourceUnmodified = false;
                    if (widgetsDir) {
                        const origPath = path.join(
                            widgetsDir,
                            `${widgetName}.js`
                        );
                        if (fs.existsSync(origPath)) {
                            const origCode = fs.readFileSync(origPath, "utf8");
                            sourceUnmodified =
                                origCode.trim() === componentCode.trim();
                        }
                    }

                    if (sourceUnmodified) {
                        console.log(
                            `[ai-compile-preview] Using existing bundle for ${sourcePackage}`
                        );
                        const bundleSource = fs.readFileSync(
                            existingBundle,
                            "utf8"
                        );
                        return {
                            success: true,
                            bundleSource,
                            widgetName,
                        };
                    }
                }
            }
        }

        // ── Slow path: recompile (AI modified the code) ─────────
        const buildDir = path.join(
            os.tmpdir(),
            `dash-ai-preview-${widgetName}-${Date.now()}`
        );

        let packageDir = null;
        if (sourcePackage) {
            const dashCore = require("@trops/dash-core/electron");
            const registry = dashCore.widgetRegistry.getWidgetRegistry();
            const widget = registry.getWidget(sourcePackage);
            if (widget?.path && fs.existsSync(widget.path)) {
                packageDir = widget.path;
            }
        }

        if (packageDir) {
            fs.cpSync(packageDir, buildDir, { recursive: true });
            const oldDist = path.join(buildDir, "dist");
            if (fs.existsSync(oldDist)) {
                fs.rmSync(oldDist, { recursive: true, force: true });
            }
            // Remove all OTHER widget .dash.js files so
            // compileWidget only builds the target widget.
            // Keeps shared files (utils, contexts, hooks) intact.
            const wDir = path.join(buildDir, "widgets");
            if (fs.existsSync(wDir)) {
                for (const f of fs.readdirSync(wDir)) {
                    if (
                        f.endsWith(".dash.js") &&
                        f !== `${widgetName}.dash.js`
                    ) {
                        fs.unlinkSync(path.join(wDir, f));
                    }
                }
            }
        } else {
            fs.mkdirSync(buildDir, { recursive: true });
        }

        const widgetsDir = path.join(buildDir, "widgets");
        fs.mkdirSync(widgetsDir, { recursive: true });

        // Multi-file payload: write every declared file. The
        // legacy componentCode/configCode are still written
        // explicitly below as a backstop, since validation may
        // skip something we still need for compile. Snap the
        // primary widget's .dash.js to the picker's selection
        // here too so the preview compile sees the corrected
        // providers array.
        let fileWriteSummary = null;
        const snappedPreviewFiles = Array.isArray(files)
            ? files.map((f) => {
                  if (
                      f &&
                      typeof f.path === "string" &&
                      f.path.endsWith(".dash.js") &&
                      (f.path === `widgets/${widgetName}.dash.js` ||
                          f.path.endsWith(`/${widgetName}.dash.js`))
                  ) {
                      const sn = snapProvidersToSelection(
                          f.content,
                          selectedProvider
                      );
                      return {
                          ...f,
                          content: prepareWidgetConfig(sn.source, {
                              componentSource: primaryComponentOf(
                                  files,
                                  widgetName,
                                  componentCode
                              ),
                              componentName: widgetName,
                          }).source,
                      };
                  }
                  return f;
              })
            : files;
        if (
            Array.isArray(snappedPreviewFiles) &&
            snappedPreviewFiles.length > 0
        ) {
            fileWriteSummary = writeAiFiles(buildDir, snappedPreviewFiles);
            if (fileWriteSummary.skipped.length > 0) {
                console.warn(
                    "[ai-compile-preview] Skipped files:",
                    fileWriteSummary.skipped
                );
            }
        }

        fs.writeFileSync(
            path.join(widgetsDir, `${widgetName}.js`),
            componentCode,
            "utf8"
        );
        fs.writeFileSync(
            path.join(widgetsDir, `${widgetName}.dash.js`),
            configCode,
            "utf8"
        );

        const dashCoreCompiler = require("@trops/dash-core/electron");
        await dashCoreCompiler.widgetCompiler.compileWidget(buildDir);

        const outputPath = path.join(buildDir, "dist", "index.cjs.js");
        if (!fs.existsSync(outputPath)) {
            return {
                success: false,
                error: "Compilation produced no output.",
            };
        }

        const bundleSource = fs.readFileSync(outputPath, "utf8");
        fs.rmSync(buildDir, { recursive: true, force: true });

        return {
            success: true,
            bundleSource,
            widgetName,
            skippedFiles: fileWriteSummary?.skipped || [],
            // Slice 17b: surface auto-correct so the renderer
            // can show "We adjusted the AI's provider config to
            // match your installed provider" instead of leaving
            // it as silent main-process magic.
            providerCorrection: providerSnap?.rewrote
                ? { reason: providerSnap.reason || null }
                : null,
        };
    } catch (err) {
        // Preserve structured fields from WidgetCompileError so the
        // renderer can show actionable diagnostics ("native helper
        // not found at <path>, arch=<arch>") instead of a raw
        // "spawn ENOENT". Also lift esbuild's `errors[]` array
        // (which carries `location: {file, line, column, lineText}`)
        // so the renderer can show "Line 12: Unexpected token"
        // instead of a bare SyntaxError. Slice 17b.
        const esbuildErrors = Array.isArray(err.errors)
            ? err.errors.slice(0, 5).map((e) => ({
                  text: e.text || "",
                  location: e.location
                      ? {
                            file: e.location.file || null,
                            line: e.location.line || null,
                            column: e.location.column || null,
                            lineText: e.location.lineText || null,
                        }
                      : null,
              }))
            : null;
        return {
            success: false,
            error: err.message,
            code: err.code || null,
            diagnostics:
                err.diagnostics ||
                (esbuildErrors ? { esbuild: esbuildErrors } : null),
        };
    }
}

// --- AI Widget Builder: Install ---
// Compiles AI-generated widget code and installs to @ai-built/ scope.
// Called from the Widget Builder modal UI — the LLM never touches the filesystem.
/**
 * Rebuild one of the user's own packages with an edited widget and
 * reinstall it in place (Widget Builder "Update original"). The whole
 * package is copied so its shared files and other widgets come along; npm
 * libraries come from the app's own (dash-core widgetCompiler). The
 * installed package is untouched until the new build compiled, and is put
 * back if installing it fails. → { success, widgetName, updated, version }
 */
async function updateOriginalPackage({
    packageName,
    widgetName,
    componentCode,
    configCode,
    files,
    cellContext,
    windows,
}) {
    const path = require("path");
    const fs = require("fs");
    const os = require("os");
    const {
        prepareUpdateBuild,
        installWithBackup,
    } = require("./packageUpdate.cjs");
    const core = require("@trops/dash-core/electron");
    const registry = core.widgetRegistry.getWidgetRegistry();
    const existing = registry.getWidget(packageName);
    if (!existing?.path || !fs.existsSync(existing.path)) {
        return {
            success: false,
            error: `${packageName} isn't installed here, so it can't be updated. Remix it as a new widget instead.`,
        };
    }
    const buildDir = path.join(
        os.tmpdir(),
        `dash-ai-update-${widgetName}-${Date.now()}`
    );
    try {
        // The edited config keeps naming this package (the AI may have
        // changed its id, scope or packageName).
        const scoped = /^@([^/]+)\/([^/]+)$/.exec(packageName);
        const ownConfig = scoped
            ? claimConfigIdentity(configCode, {
                  scope: scoped[1],
                  packageName: scoped[2],
                  componentName: widgetName,
              }).source
            : configCode;
        const { version } = prepareUpdateBuild({
            sourcePath: existing.path,
            buildDir,
            widgetName,
            componentCode,
            configCode: ownConfig,
        });
        // The helper files that were checked with the edit go in too.
        writeAiFiles(
            buildDir,
            helperFiles(files, [widgetName], [componentCode, configCode])
        );
        await core.widgetCompiler.compileWidget(buildDir);
        if (!fs.existsSync(path.join(buildDir, "dist", "index.cjs.js"))) {
            return {
                success: false,
                error: "Compilation produced no output. Check for syntax errors.",
            };
        }
        // That build only proved it compiles: the install gate builds the
        // checked code itself, so it's recorded as built by Dash.
        fs.rmSync(path.join(buildDir, "dist"), {
            recursive: true,
            force: true,
        });
        const manifest = path.join(buildDir, "dash.json");
        const config = await installWithBackup({
            packagePath: existing.path,
            backupRoot: path.join(os.tmpdir(), "dash-widget-update-backups"),
            install: () =>
                registry.installFromLocalPath(
                    packageName,
                    buildDir,
                    true,
                    fs.existsSync(manifest) ? manifest : null
                ),
        });
        if (!cellContext) {
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    win.webContents.send("widget:installed", {
                        widgetName: packageName,
                        config,
                    });
                }
            }
        }
        return {
            success: true,
            widgetName: packageName,
            updated: true,
            version,
        };
    } catch (err) {
        console.error("[widget:ai-build] Update original failed:", err);
        return { success: false, error: err.message };
    } finally {
        fs.rmSync(buildDir, { recursive: true, force: true });
    }
}

async function aiBuild(message, { windows = [] } = {}) {
    const {
        widgetName,
        componentCode,
        description,
        cellContext,
        remixMeta,
        files,
        selectedProvider,
    } = message;
    // Auto-correct the config's providers array against the
    // user's picker selection BEFORE writing files / compiling
    // / installing. This is the safety net for AI drift —
    // even if the LLM emitted the wrong providerClass the
    // installed widget will declare the right one.
    const providerSnap = snapProvidersToSelection(
        message.configCode,
        selectedProvider
    );
    if (providerSnap.rewrote) {
        console.log(
            "[widget:ai-build] Provider auto-correct:",
            providerSnap.reason
        );
    }
    // AI configs sometimes omit `type: "widget"`, never export the
    // config, or import the component the wrong way — fix those
    // slips before compiling (preview + install).
    const configPrep = prepareWidgetConfig(providerSnap.source, {
        componentSource: componentCode,
        componentName: widgetName,
    });
    if (configPrep.fixes.length) {
        console.log("[widget-config] Auto-fixed:", configPrep.fixes.join("; "));
    }
    let configCode = configPrep.source;
    // "Update original" on a widget from one of the user's own packages
    // (not @ai-built): rebuild that package with the edit and reinstall it
    // under its own name — never an @ai-built copy.
    const updateOriginal = String(message.updateOriginal || "").trim();
    if (updateOriginal && !updateOriginal.startsWith("@ai-built/")) {
        return updateOriginalPackage({
            packageName: updateOriginal,
            widgetName,
            componentCode,
            configCode,
            files,
            cellContext,
            windows,
        });
    }
    // The config names its own package: a copy of another package's
    // widget otherwise keeps the original's id and the app would treat
    // it as the original.
    const ownIdentity = {
        scope: "ai-built",
        packageName: widgetName.toLowerCase(),
        componentName: widgetName,
    };
    configCode = claimConfigIdentity(configCode, ownIdentity).source;
    // If the renderer also packaged the primary widget's
    // .dash.js into files[], snap that copy too so the on-disk
    // file matches.
    const snappedFiles = Array.isArray(files)
        ? files.map((f) => {
              if (
                  f &&
                  typeof f.path === "string" &&
                  f.path.endsWith(".dash.js") &&
                  (f.path === `widgets/${widgetName}.dash.js` ||
                      f.path.endsWith(`/${widgetName}.dash.js`))
              ) {
                  const sn = snapProvidersToSelection(
                      f.content,
                      selectedProvider
                  );
                  return {
                      ...f,
                      content: claimConfigIdentity(
                          prepareWidgetConfig(sn.source, {
                              componentSource: primaryComponentOf(
                                  files,
                                  widgetName,
                                  componentCode
                              ),
                              componentName: widgetName,
                          }).source,
                          ownIdentity
                      ).source,
                  };
              }
              return f;
          })
        : files;

    const path = require("path");
    const fs = require("fs");
    const os = require("os");

    const buildDir = path.join(
        os.tmpdir(),
        `dash-ai-build-${widgetName}-${Date.now()}`
    );

    try {
        // When installing a widget whose source code imports
        // local sibling files (e.g. `./pipelineBootstrap`),
        // the temp build dir must include those siblings so
        // esbuild can resolve them. Two cases need this:
        //
        //   1. REMIX — we're forking an existing multi-file
        //      package into a new @ai-built scope. Source =
        //      remixMeta.remixedFrom.package.
        //   2. UPDATE — we're editing an already-installed
        //      @ai-built widget in-place. The existing install
        //      has the sibling files we need; without copying
        //      them, the fresh temp dir has only the single
        //      widget file and imports fail. Source =
        //      @ai-built/<widgetName.toLowerCase()>, the same
        //      package we're about to overwrite.
        //
        // Priority: remix source wins when both are set.
        // Fresh net-new installs with no existing package and
        // no remix get an empty temp dir, which is fine — the
        // AI shouldn't be emitting local imports in that case.
        const targetScopedName = `@ai-built/${widgetName.toLowerCase()}`;
        let sourcePackageName = remixMeta?.remixedFrom?.package || null;
        let sourcePackageReason = sourcePackageName ? "remix" : null;
        const dashCoreRegistry =
            require("@trops/dash-core/electron").widgetRegistry;
        const registry = dashCoreRegistry.getWidgetRegistry();
        if (!sourcePackageName) {
            // Update-in-place: does a package with the same
            // scoped name already exist on disk?
            const existing = registry.getWidget(targetScopedName);
            if (existing?.path && fs.existsSync(existing.path)) {
                sourcePackageName = targetScopedName;
                sourcePackageReason = "update";
            }
        }

        if (sourcePackageName) {
            try {
                const sourceWidget = registry.getWidget(sourcePackageName);
                if (sourceWidget?.path && fs.existsSync(sourceWidget.path)) {
                    fs.cpSync(sourceWidget.path, buildDir, {
                        recursive: true,
                    });
                    // Purge stale dist so the compile produces a
                    // fresh bundle from our overwritten sources.
                    const staleDist = path.join(buildDir, "dist");
                    if (fs.existsSync(staleDist)) {
                        fs.rmSync(staleDist, {
                            recursive: true,
                            force: true,
                        });
                    }
                    // Strip other widgets' .dash.js files so
                    // compileWidget only emits the target one.
                    // Keep sibling .js utilities (imports resolve).
                    const wDir = path.join(buildDir, "widgets");
                    if (fs.existsSync(wDir)) {
                        for (const f of fs.readdirSync(wDir)) {
                            if (
                                f.endsWith(".dash.js") &&
                                f !== `${widgetName}.dash.js`
                            ) {
                                fs.unlinkSync(path.join(wDir, f));
                            }
                        }
                    }
                    console.log(
                        `[widget:ai-build] Copied source package ${sourcePackageName} into build dir (${sourcePackageReason})`
                    );
                }
            } catch (err) {
                console.warn(
                    `[widget:ai-build] Could not copy source package ${sourcePackageName}:`,
                    err?.message || err
                );
            }
        }

        // Create temp directory structure
        const widgetsDir = path.join(buildDir, "widgets");
        fs.mkdirSync(widgetsDir, { recursive: true });

        // Multi-file payload: write every declared file before
        // writing the legacy primary widget files. Path-validated
        // and sandboxed to the staging dir. Skipped entries are
        // logged but don't fail the install — the legacy
        // componentCode/configCode below ensures the primary
        // widget always lands.
        let installFileWriteSummary = null;
        if (Array.isArray(snappedFiles) && snappedFiles.length > 0) {
            installFileWriteSummary = writeAiFiles(buildDir, snappedFiles);
            if (installFileWriteSummary.skipped.length > 0) {
                console.warn(
                    "[widget:ai-build] Skipped files:",
                    installFileWriteSummary.skipped
                );
            }
        }

        // Write component file (overwrites the original if we
        // copied the source package above OR overrides whatever
        // was in files[] for the primary widget so post-modal
        // category injection / rename land at install time).
        fs.writeFileSync(
            path.join(widgetsDir, `${widgetName}.js`),
            componentCode,
            "utf8"
        );

        // Write config file
        fs.writeFileSync(
            path.join(widgetsDir, `${widgetName}.dash.js`),
            configCode,
            "utf8"
        );

        // Slice 7: statically scan the AI-generated component
        // code for `useMcpProvider("type")` and
        // `callTool("name", ...)` to pre-declare MCP
        // permissions in the manifest. The runtime gate's
        // `parseManifestPermissions` reads `package.json
        // .dash.permissions.mcp`, so we write the block to
        // BOTH dash.json (canonical metadata) and package.json
        // (where the parser looks). Empty result → no block
        // written → behavior unchanged from pre-slice.
        const {
            scanWidgetMcpUsage,
        } = require("../../scripts/scanWidgetMcpUsage");
        const detectedMcpPermissions = scanWidgetMcpUsage(componentCode);
        const hasDeclaredPermissions =
            detectedMcpPermissions &&
            Object.keys(detectedMcpPermissions).length > 0;
        const dashPermissionsBlock = hasDeclaredPermissions
            ? { permissions: { mcp: detectedMcpPermissions } }
            : null;

        // Write dash.json manifest
        fs.writeFileSync(
            path.join(buildDir, "dash.json"),
            JSON.stringify(
                {
                    name: `@ai-built/${widgetName.toLowerCase()}`,
                    displayName: widgetName.replace(/([A-Z])/g, " $1").trim(),
                    version: "1.0.0",
                    description:
                        description || `AI-generated widget: ${widgetName}`,
                    author: "AI Assistant",
                    widgets: [
                        {
                            name: widgetName,
                            displayName: widgetName
                                .replace(/([A-Z])/g, " $1")
                                .trim(),
                            description: description || "",
                        },
                    ],
                    createdAt: new Date().toISOString(),
                    ...(remixMeta?.remixedFrom
                        ? {
                              remixedFrom: remixMeta.remixedFrom,
                          }
                        : {}),
                    ...(dashPermissionsBlock
                        ? { dash: dashPermissionsBlock }
                        : {}),
                },
                null,
                2
            ),
            "utf8"
        );

        // Always write a baseline `package.json` regardless of
        // whether the AI's source uses MCP. Two downstream
        // surfaces depend on this file existing:
        //
        //   - `widgetPermissions.getWidgetMcpPermissions` reads
        //     it to answer "what does this widget declare?" —
        //     without the file the function returns null and
        //     the Permissions panel shows nothing for the
        //     widget.
        //   - `widgetPermissions.resolveWidgetPackagePath`
        //     anchors widget identity to the on-disk package.
        //     The path resolver still works without the file,
        //     but downstream call sites lose the ability to
        //     pin widget→package and fall through to weaker
        //     back-compat heuristics.
        //
        // The per-component `dash.permissions.mcpByComponent`
        // block is added AFTER this write by
        // `installFromLocalPath` → `applyScanToPackageJson`,
        // which re-scans the full widgets/ tree (the AI
        // handler operates on a single widget at a time so
        // it can't produce that block here).
        const pkgJsonPath = path.join(buildDir, "package.json");
        let existingPkg = {};
        if (fs.existsSync(pkgJsonPath)) {
            try {
                existingPkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
            } catch (_) {
                existingPkg = {};
            }
        }
        const {
            buildAiInstallPackageJson,
        } = require("../../scripts/buildAiInstallPackageJson");
        const baselinePkg = buildAiInstallPackageJson({
            widgetName,
            description,
            existingPkg,
            mcpPermissions: hasDeclaredPermissions
                ? detectedMcpPermissions
                : null,
        });
        fs.writeFileSync(
            pkgJsonPath,
            JSON.stringify(baselinePkg, null, 2),
            "utf8"
        );

        // Compile via widgetCompiler (from dash-core).
        // `dashCoreRegistry` was already required at the top of
        // this handler; reuse it here instead of re-requiring /
        // re-declaring `registry` (which would SyntaxError in
        // the same scope).
        const dashCoreCompiler =
            require("@trops/dash-core/electron").widgetCompiler;
        await dashCoreCompiler.compileWidget(buildDir);

        // Verify output
        const outputPath = path.join(buildDir, "dist", "index.cjs.js");
        if (!fs.existsSync(outputPath)) {
            return {
                success: false,
                error: "Compilation produced no output. Check for syntax errors.",
            };
        }
        // That build only proved it compiles: the install gate builds the
        // checked code itself, so it's recorded as built by Dash.
        fs.rmSync(path.join(buildDir, "dist"), {
            recursive: true,
            force: true,
        });

        // Install to @ai-built/ scope. No early delete: the install replaces
        // the old one only after the package passes its checks — a refusal
        // keeps the installed widget.
        const scopedName = `@ai-built/${widgetName.toLowerCase()}`;
        const config = await registry.installFromLocalPath(
            scopedName,
            buildDir,
            true,
            path.join(buildDir, "dash.json")
        );

        if (!cellContext) {
            // No cell context: broadcast normally for widget picker
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    win.webContents.send("widget:installed", {
                        widgetName: scopedName,
                        config,
                    });
                }
            }
        }
        // With cell context: NO broadcast, NO workspace save.
        // Everything deferred to modal close to prevent app reload.

        return {
            success: true,
            widgetName: scopedName,
        };
    } catch (err) {
        console.error("[widget:ai-build] Error:", err);
        return {
            success: false,
            error: err.message,
        };
    }
}

module.exports = {
    compilePreview,
    aiBuild,
    primaryComponentOf,
    validateAiFilePath,
    writeAiFiles,
    helperFiles,
    snapProvidersToSelection,
};
