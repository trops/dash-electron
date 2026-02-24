/**
 * Widget Compiler
 *
 * Compiles raw widget source files (.js + .dash.js) into a single CJS bundle
 * using esbuild. The output bundle is consumable by the existing
 * widgetBundleLoader.js eval pipeline (new Function() + require shim).
 *
 * Runs in the Electron main process at widget install time.
 */

const fs = require("fs");
const path = require("path");

/**
 * Find the widgets/ directory, handling nested ZIP extraction.
 *
 * ZIP extraction can create a nested structure like:
 *   Weather/weather-widget/widgets/  instead of  Weather/widgets/
 *
 * If widgets/ doesn't exist at root, check one level deeper for a
 * single subdirectory that contains widgets/.
 *
 * @param {string} widgetPath - Absolute path to the widget directory
 * @returns {string|null} Path to the widgets/ directory, or null
 */
function findWidgetsDir(widgetPath) {
    const direct = path.join(widgetPath, "widgets");
    if (fs.existsSync(direct)) {
        return direct;
    }

    // Check one level deeper for nested ZIP extraction
    try {
        const entries = fs.readdirSync(widgetPath, { withFileTypes: true });
        const subdirs = entries.filter(
            (e) =>
                e.isDirectory() &&
                !e.name.startsWith(".") &&
                e.name !== "dist" &&
                e.name !== "node_modules"
        );

        for (const subdir of subdirs) {
            const nested = path.join(widgetPath, subdir.name, "widgets");
            if (fs.existsSync(nested)) {
                console.log(
                    `[WidgetCompiler] Found nested widgets/ at ${nested}`
                );
                return nested;
            }
        }
    } catch (err) {
        // Non-fatal — fall through to null
    }

    return null;
}

/**
 * Compile widget source files into a CJS bundle at dist/index.cjs.js.
 *
 * For each {Name}.dash.js found in the widgets/ directory, a synthetic
 * entry point is generated that imports the component + config and
 * re-exports them as `{ ...config, component }` — matching what
 * extractWidgetConfigs() in widgetBundleLoader.js expects.
 *
 * @param {string} widgetPath - Absolute path to the widget directory
 * @returns {Promise<string|null>} Path to the compiled bundle, or null if nothing to compile
 */
async function compileWidget(widgetPath) {
    const widgetsDir = findWidgetsDir(widgetPath);

    if (!widgetsDir) {
        console.log(
            `[WidgetCompiler] No widgets/ directory in ${widgetPath}, skipping`
        );
        return null;
    }

    // Discover .dash.js config files
    const files = fs.readdirSync(widgetsDir);
    const dashFiles = files.filter((f) => f.endsWith(".dash.js"));

    if (dashFiles.length === 0) {
        console.log(
            `[WidgetCompiler] No .dash.js files found in ${widgetsDir}, skipping`
        );
        return null;
    }

    // Build a synthetic entry point that pairs each component with its config.
    // Compute relative path from the entry file (in widgetPath) to widgetsDir,
    // since widgetsDir may be nested (e.g., ./weather-widget/widgets/).
    const relWidgetsDir =
        "./" + path.relative(widgetPath, widgetsDir).split(path.sep).join("/");
    const imports = [];
    const exportParts = [];

    for (const dashFile of dashFiles) {
        const componentName = dashFile.replace(".dash.js", "");
        const componentFile = `${componentName}.js`;
        const componentFilePath = path.join(widgetsDir, componentFile);
        const hasComponent = fs.existsSync(componentFilePath);

        // Import the config (always)
        imports.push(
            `import ${componentName}Config from "${relWidgetsDir}/${dashFile}";`
        );

        if (hasComponent) {
            // Import the component and merge with config
            imports.push(
                `import ${componentName}Comp from "${relWidgetsDir}/${componentFile}";`
            );
            exportParts.push(
                `export const ${componentName} = { ...${componentName}Config, component: ${componentName}Comp };`
            );
        } else {
            // Config-only (no component source file)
            exportParts.push(
                `export const ${componentName} = ${componentName}Config;`
            );
        }
    }

    const entryContent = [...imports, "", ...exportParts, ""].join("\n");

    // Write temporary entry file in the widget root
    const entryPath = path.join(widgetPath, "__compile_entry.js");
    const distDir = path.join(widgetPath, "dist");
    const outPath = path.join(distDir, "index.cjs.js");

    try {
        // Ensure dist/ directory exists
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
        }

        fs.writeFileSync(entryPath, entryContent, "utf8");

        console.log(
            `[WidgetCompiler] Compiling ${dashFiles.length} component(s) from ${widgetPath}`
        );

        // Lazy-require esbuild so the module doesn't fail to load if
        // esbuild is not yet installed (e.g., during first npm install)
        const esbuild = require("esbuild");

        await esbuild.build({
            entryPoints: [entryPath],
            bundle: true,
            format: "cjs",
            outfile: outPath,
            // These modules are provided by the host app via MODULE_MAP
            // in widgetBundleLoader.js — do NOT bundle them
            external: [
                "react",
                "react-dom",
                "@trops/dash-react",
                "react/jsx-runtime",
                "prop-types",
            ],
            // Treat .js files as JSX (widget sources use JSX in .js files)
            loader: { ".js": "jsx" },
            logLevel: "warning",
        });

        console.log(`[WidgetCompiler] Compiled successfully → ${outPath}`);
        return outPath;
    } catch (error) {
        console.error(
            `[WidgetCompiler] Compilation failed for ${widgetPath}:`,
            error
        );
        throw error;
    } finally {
        // Clean up temporary entry file
        try {
            if (fs.existsSync(entryPath)) {
                fs.unlinkSync(entryPath);
            }
        } catch (cleanupError) {
            // Non-fatal
            console.warn(
                `[WidgetCompiler] Could not remove temp entry file:`,
                cleanupError
            );
        }
    }
}

module.exports = { compileWidget, findWidgetsDir };
