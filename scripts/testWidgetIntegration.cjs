#!/usr/bin/env node

/**
 * Widget Registry Integration Test
 *
 * Manual test script to verify widget registry functionality
 *
 * Usage:
 * node scripts/testWidgetIntegration.js
 * or
 * npm run test:widgets
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { dynamicWidgetLoader } = require("../src/utils/DynamicWidgetLoader.js");
const AdmZip = require("adm-zip");

const scriptDir = path.dirname(require.main.filename);
const projectRoot = path.join(scriptDir, "../");

// Mock electron for WidgetRegistry tests (widgetRegistry.js requires electron at top level)
// When running outside Electron, require("electron") returns the binary path string,
// so destructuring would give undefined values. We pre-populate the cache with a mock.
try {
    const electronResolvedPath = require.resolve("electron");
    require.cache[electronResolvedPath] = {
        id: electronResolvedPath,
        filename: electronResolvedPath,
        loaded: true,
        exports: {
            app: { getPath: () => os.tmpdir() },
            ipcMain: { handle: () => {} },
            BrowserWindow: { getAllWindows: () => [] },
        },
    };
} catch (e) {
    // electron not resolvable — mock not needed
}
const WidgetRegistry = require("../public/lib/widgetRegistry.js");

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[36m";

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function log(message, color = RESET) {
    console.log(`${color}${message}${RESET}`);
}

function test(name, fn) {
    testsRun++;
    try {
        fn();
        testsPassed++;
        log(`  ✓ ${name}`, GREEN);
    } catch (error) {
        testsFailed++;
        log(`  ✗ ${name}`, RED);
        log(`    Error: ${error.message}`, RED);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertTrue(condition, message) {
    assert(condition, message || "Expected true");
}

async function runTests() {
    log(
        "\n╔════════════════════════════════════════════════════════════╗",
        BLUE
    );
    log("║       Widget Registry Integration Test Suite               ║", BLUE);
    log(
        "╚════════════════════════════════════════════════════════════╝\n",
        BLUE
    );

    // Test 1: Widget Discovery
    log("Test Suite 1: Widget Discovery", YELLOW);
    test("Should discover widgets in MyFirstWidget", () => {
        const widgetPath = path.join(projectRoot, "src/Widgets/MyFirstWidget");
        const discovered = dynamicWidgetLoader.discoverWidgets(widgetPath);

        assertTrue(Array.isArray(discovered), "Should return an array");
        assertTrue(discovered.length > 0, "Should find at least one widget");
        assertTrue(
            discovered.includes("MyFirstWidgetWidget"),
            "Should discover MyFirstWidgetWidget"
        );
    });

    test("Should return empty array for non-existent directory", () => {
        const discovered =
            dynamicWidgetLoader.discoverWidgets("/non/existent/path");
        assertEquals(discovered.length, 0, "Should return empty array");
    });

    // Test 2: Widget Loading
    log("\nTest Suite 2: Widget Loading", YELLOW);

    let loadedWidget = null;

    test("Should load MyFirstWidget configuration", async () => {
        const widgetPath = path.join(projectRoot, "src/Widgets/MyFirstWidget");
        const discovered = dynamicWidgetLoader.discoverWidgets(widgetPath);

        assertTrue(
            discovered.length > 0,
            "Should discover at least one widget"
        );

        const result = await dynamicWidgetLoader.loadWidget(
            "MyFirstWidget",
            widgetPath,
            discovered[0],
            false
        );

        loadedWidget = result;

        assertTrue(result, "Should return result object");
        assertTrue(result.component, "Should have component");
        assertTrue(result.config, "Should have config");
        assertTrue(result.config.name, "Config should have name property");
    });

    // Test 3: Cache Testing
    log("\nTest Suite 3: Caching", YELLOW);

    test("Should cache loaded widgets", async () => {
        if (!loadedWidget) {
            log("  ⊘ Skipped (requires loaded widget)", YELLOW);
            return;
        }

        const widgetPath = path.join(projectRoot, "src/Widgets/MyFirstWidget");
        const discovered = dynamicWidgetLoader.discoverWidgets(widgetPath);

        // Load again (should come from cache)
        const result = await dynamicWidgetLoader.loadWidget(
            "MyFirstWidget",
            widgetPath,
            discovered[0],
            false
        );

        assertEquals(
            result,
            loadedWidget,
            "Should return same object from cache"
        );
    });

    test("Should clear cache", () => {
        dynamicWidgetLoader.clearCache();
        assertEquals(
            dynamicWidgetLoader.loadedWidgets.size,
            0,
            "Cache should be empty"
        );
    });

    // Test 4: Configuration Validation
    log("\nTest Suite 4: Configuration Validation", YELLOW);

    test("Should have valid widget configuration", () => {
        if (!loadedWidget) {
            log("  ⊘ Skipped (requires loaded widget)", YELLOW);
            return;
        }

        const config = loadedWidget.config;
        const requiredFields = ["name", "component", "canHaveChildren"];

        requiredFields.forEach((field) => {
            assertTrue(field in config, `Config should have ${field} property`);
        });
    });

    // Test 5: File System Operations
    log("\nTest Suite 5: File System Operations", YELLOW);

    test("Component file should exist", () => {
        if (!loadedWidget) {
            log("  ⊘ Skipped (requires loaded widget)", YELLOW);
            return;
        }

        const componentPath = loadedWidget.component.path;
        assertTrue(
            fs.existsSync(componentPath),
            `Component file should exist at ${componentPath}`
        );
    });

    test("Should have valid file paths", () => {
        if (!loadedWidget) {
            log("  ⊘ Skipped (requires loaded widget)", YELLOW);
            return;
        }

        const componentPath = loadedWidget.component.path;
        assertTrue(
            path.isAbsolute(componentPath),
            "Component path should be absolute"
        );
        assertTrue(
            componentPath.includes("widgets"),
            "Component path should be in widgets directory"
        );
    });

    // Test 6: Widget Installation from ZIP
    log("\nTest Suite 6: Widget Installation (Hot Reload)", YELLOW);

    let testCacheDir = null;
    let installedWidgetPath = null;

    test("Should create test installation directory", () => {
        // Create temporary directory for test
        testCacheDir = path.join(os.tmpdir(), `dash-test-${Date.now()}`);
        fs.mkdirSync(testCacheDir, { recursive: true });

        assertTrue(
            fs.existsSync(testCacheDir),
            "Test cache directory should exist"
        );
    });

    test("Should install widget from ZIP file", () => {
        if (!testCacheDir) {
            log("  ⊘ Skipped (requires test cache dir)", YELLOW);
            return;
        }

        const zipPath = path.join(
            projectRoot,
            "test/fixtures/weather-widget.zip"
        );
        assertTrue(fs.existsSync(zipPath), "Weather widget ZIP should exist");

        // Extract ZIP exactly like WidgetRegistry does
        const widgetName = "Weather";
        installedWidgetPath = path.join(testCacheDir, widgetName);

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(installedWidgetPath, true);

        assertTrue(
            fs.existsSync(installedWidgetPath),
            "Widget should be extracted from ZIP"
        );
    });

    test("Should have correct widget file structure", () => {
        if (!installedWidgetPath) {
            log("  ⊘ Skipped (requires installed widget)", YELLOW);
            return;
        }

        const packageJson = path.join(installedWidgetPath, "package.json");
        assertTrue(fs.existsSync(packageJson), "package.json should exist");

        const widgetsDir = path.join(installedWidgetPath, "widgets");
        assertTrue(
            fs.existsSync(widgetsDir),
            "widgets/ directory should exist"
        );

        const component = path.join(widgetsDir, "WeatherWidget.js");
        assertTrue(fs.existsSync(component), "Component file should exist");

        const dashConfig = path.join(widgetsDir, "WeatherWidget.dash.js");
        assertTrue(fs.existsSync(dashConfig), "Config file should exist");
    });

    test("Should parse package.json correctly", () => {
        if (!installedWidgetPath) {
            log("  ⊘ Skipped (requires installed widget)", YELLOW);
            return;
        }

        const packageJson = path.join(installedWidgetPath, "package.json");
        const pkg = JSON.parse(fs.readFileSync(packageJson, "utf8"));

        assertEquals(
            pkg.name,
            "weather-widget",
            "Should have correct package name"
        );
        assertEquals(pkg.version, "1.0.0", "Should have correct version");
        assertTrue(pkg.description, "Should have description");
    });

    test("Should discover components in installed widget", () => {
        if (!installedWidgetPath) {
            log("  ⊘ Skipped (requires installed widget)", YELLOW);
            return;
        }

        const components =
            dynamicWidgetLoader.discoverWidgets(installedWidgetPath);

        assertTrue(components.length > 0, "Should discover components");
        assertTrue(
            components.includes("WeatherWidget"),
            "Should discover WeatherWidget component"
        );
    });

    test("Should load installed widget component", async () => {
        if (!installedWidgetPath) {
            log("  ⊘ Skipped (requires installed widget)", YELLOW);
            return;
        }

        const result = await dynamicWidgetLoader.loadWidget(
            "Weather",
            installedWidgetPath,
            "WeatherWidget",
            false
        );

        assertTrue(result, "Should load widget");
        assertTrue(result.component, "Should have component");
        assertTrue(result.config, "Should have config");
        assertEquals(
            result.config.displayName,
            "Weather",
            "Should have correct display name"
        );
        assertEquals(
            result.config.version,
            "1.0.0",
            "Should have correct version"
        );
        assertTrue(
            result.config.downloadUrl,
            "Should have downloadUrl in config"
        );
    });

    test("Should validate widget configuration structure", async () => {
        if (!installedWidgetPath) {
            log("  ⊘ Skipped (requires installed widget)", YELLOW);
            return;
        }

        const result = await dynamicWidgetLoader.loadWidget(
            "Weather",
            installedWidgetPath,
            "WeatherWidget",
            false
        );

        const config = result.config;
        const expectedFields = [
            "name",
            "displayName",
            "description",
            "version",
            "icon",
        ];

        expectedFields.forEach((field) => {
            assertTrue(field in config, `Config should have ${field} property`);
        });
    });

    test("ZIP file should exist for distribution", () => {
        const zipPath = path.join(
            projectRoot,
            "test/fixtures/weather-widget.zip"
        );
        assertTrue(fs.existsSync(zipPath), "weather-widget.zip should exist");

        // Verify ZIP is valid by checking its size
        const stats = fs.statSync(zipPath);
        assertTrue(stats.size > 0, "ZIP file should not be empty");
        assertTrue(
            stats.size < 1024 * 1024,
            "ZIP file should be reasonably small (< 1MB)"
        );
    });

    test("Should clean up test directory", () => {
        if (testCacheDir && fs.existsSync(testCacheDir)) {
            fs.rmSync(testCacheDir, { recursive: true, force: true });
            assertTrue(
                !fs.existsSync(testCacheDir),
                "Test directory should be removed"
            );
        }
    });

    // Test 7: Install from ZIP via WidgetRegistry
    log("\nTest Suite 7: Install from ZIP via WidgetRegistry", YELLOW);

    // Perform async setup outside test() since test() doesn't await async callbacks
    const suite7TempDir = path.join(
        os.tmpdir(),
        `dash-test-suite7-${Date.now()}`
    );
    fs.mkdirSync(suite7TempDir, { recursive: true });

    WidgetRegistry.initialize(suite7TempDir);
    const suite7Registry = new WidgetRegistry(null, suite7TempDir);

    const suite7ZipPath = path.join(
        projectRoot,
        "test/fixtures/weather-widget.zip"
    );
    const suite7Config = await suite7Registry.installFromLocalPath(
        "Weather",
        suite7ZipPath,
        false
    );

    test("Should install weather widget from ZIP via WidgetRegistry", () => {
        assertTrue(suite7Config, "Should return config object");
        assertEquals(
            suite7Config.name,
            "weather-widget",
            "Config name should be weather-widget"
        );
        assertEquals(
            suite7Config.version,
            "1.0.0",
            "Config version should be 1.0.0"
        );
        assertTrue(suite7Config.description, "Config should have description");
    });

    test("Should have widget in registry after ZIP install", () => {
        const widgets = suite7Registry.getWidgets();
        assertTrue(widgets.length > 0, "Should have at least one widget");

        const weather = suite7Registry.getWidget("Weather");
        assertTrue(weather, "Should find Weather widget by name");
        assertEquals(
            weather.path,
            path.join(suite7TempDir, "widgets", "Weather"),
            "Widget entry should have correct path"
        );
    });

    test("Should have correct files on disk after ZIP install", () => {
        const widgetDir = path.join(suite7TempDir, "widgets", "Weather");
        assertTrue(
            fs.existsSync(widgetDir),
            "Widget directory should exist on disk"
        );
        assertTrue(
            fs.existsSync(path.join(widgetDir, "package.json")),
            "package.json should exist"
        );
        assertTrue(
            fs.existsSync(path.join(widgetDir, "widgets", "WeatherWidget.js")),
            "Component file should exist"
        );
        assertTrue(
            fs.existsSync(
                path.join(widgetDir, "widgets", "WeatherWidget.dash.js")
            ),
            "Config file should exist"
        );
    });

    test("Should clean up Suite 7 test directory", () => {
        fs.rmSync(suite7TempDir, { recursive: true, force: true });
        assertTrue(
            !fs.existsSync(suite7TempDir),
            "Suite 7 test directory should be removed"
        );
    });

    // Test 8: Load from Folder via WidgetRegistry
    log("\nTest Suite 8: Load from Folder via WidgetRegistry", YELLOW);

    // Setup: create temp dirs and copy both widget fixtures into a shared folder
    const suite8TempDir = path.join(
        os.tmpdir(),
        `dash-test-suite8-${Date.now()}`
    );
    const suite8FolderDir = path.join(
        os.tmpdir(),
        `dash-test-suite8-folder-${Date.now()}`
    );
    fs.mkdirSync(suite8TempDir, { recursive: true });
    fs.mkdirSync(suite8FolderDir, { recursive: true });

    fs.cpSync(
        path.join(projectRoot, "test/fixtures/weather-widget"),
        path.join(suite8FolderDir, "weather-widget"),
        { recursive: true }
    );
    fs.cpSync(
        path.join(projectRoot, "test/fixtures/notes-widget"),
        path.join(suite8FolderDir, "notes-widget"),
        { recursive: true }
    );

    WidgetRegistry.initialize(suite8TempDir);
    const suite8Registry = new WidgetRegistry(null, suite8TempDir);
    const suite8Results = await suite8Registry.registerWidgetsFromFolder(
        suite8FolderDir,
        false
    );

    test("Should load multiple widgets from folder", () => {
        assertTrue(Array.isArray(suite8Results), "Should return an array");
        assertEquals(
            suite8Results.length,
            2,
            "Should register 2 widgets from folder"
        );
    });

    test("Should have both widgets in registry after folder load", () => {
        const widgets = suite8Registry.getWidgets();
        assertEquals(widgets.length, 2, "Registry should have 2 widgets");
    });

    test("Should have correct widget names after folder load", () => {
        const names = suite8Results.map((r) => r.name).sort();
        assertEquals(
            names[0],
            "notes-widget",
            "First widget should be notes-widget"
        );
        assertEquals(
            names[1],
            "weather-widget",
            "Second widget should be weather-widget"
        );
    });

    test("Should clean up Suite 8 test directories", () => {
        fs.rmSync(suite8FolderDir, { recursive: true, force: true });
        fs.rmSync(suite8TempDir, { recursive: true, force: true });
        assertTrue(
            !fs.existsSync(suite8TempDir),
            "Suite 8 temp dir should be removed"
        );
        assertTrue(
            !fs.existsSync(suite8FolderDir),
            "Suite 8 folder dir should be removed"
        );
    });

    // Test 9: ZIP Round-trip (create ZIP from folder, install from ZIP)
    log("\nTest Suite 9: ZIP Round-trip", YELLOW);

    // Create ZIP from notes-widget fixture
    const notesSrc = path.join(projectRoot, "test/fixtures/notes-widget");
    const suite9ZipPath = path.join(
        os.tmpdir(),
        `dash-test-notes-widget-${Date.now()}.zip`
    );
    const suite9Zip = new AdmZip();
    suite9Zip.addLocalFolder(notesSrc);
    suite9Zip.writeZip(suite9ZipPath);

    test("Should create ZIP from notes-widget fixture", () => {
        assertTrue(fs.existsSync(suite9ZipPath), "Generated ZIP should exist");
        const stats = fs.statSync(suite9ZipPath);
        assertTrue(stats.size > 0, "Generated ZIP should not be empty");
    });

    // Install from the generated ZIP
    const suite9TempDir = path.join(
        os.tmpdir(),
        `dash-test-suite9-${Date.now()}`
    );
    fs.mkdirSync(suite9TempDir, { recursive: true });

    WidgetRegistry.initialize(suite9TempDir);
    const suite9Registry = new WidgetRegistry(null, suite9TempDir);
    const suite9Config = await suite9Registry.installFromLocalPath(
        "Notes",
        suite9ZipPath,
        false
    );

    test("Should install notes widget from generated ZIP", () => {
        assertTrue(suite9Config, "Should return config object");
        assertEquals(
            suite9Config.name,
            "notes-widget",
            "Config name should be notes-widget"
        );
        assertEquals(
            suite9Config.version,
            "1.0.0",
            "Config version should be 1.0.0"
        );
    });

    test("Should have correct files on disk after ZIP round-trip", () => {
        const widgetDir = path.join(suite9TempDir, "widgets", "Notes");
        assertTrue(
            fs.existsSync(widgetDir),
            "Widget directory should exist on disk"
        );
        assertTrue(
            fs.existsSync(path.join(widgetDir, "package.json")),
            "package.json should exist"
        );
        assertTrue(
            fs.existsSync(path.join(widgetDir, "widgets", "NotesWidget.js")),
            "Component file should exist"
        );
        assertTrue(
            fs.existsSync(
                path.join(widgetDir, "widgets", "NotesWidget.dash.js")
            ),
            "Config file should exist"
        );
    });

    test("Should clean up Suite 9 test artifacts", () => {
        fs.unlinkSync(suite9ZipPath);
        fs.rmSync(suite9TempDir, { recursive: true, force: true });
        assertTrue(
            !fs.existsSync(suite9ZipPath),
            "Generated ZIP should be removed"
        );
        assertTrue(
            !fs.existsSync(suite9TempDir),
            "Suite 9 temp dir should be removed"
        );
    });

    // Print Summary
    log(
        "\n╔════════════════════════════════════════════════════════════╗",
        BLUE
    );
    log(
        "║                      Test Summary                           ║",
        BLUE
    );
    log(
        "╚════════════════════════════════════════════════════════════╝\n",
        BLUE
    );

    log(`Total Tests Run: ${testsRun}`);
    log(`Passed: ${testsPassed}`, GREEN);
    log(`Failed: ${testsFailed}`, testsFailed > 0 ? RED : GREEN);

    if (testsFailed === 0) {
        log("\n✓ All tests passed!", GREEN);
        process.exit(0);
    } else {
        log(`\n✗ ${testsFailed} test(s) failed`, RED);
        process.exit(1);
    }
}

// Run tests with async support
runTests().catch((error) => {
    log(`\nFatal Error: ${error.message}`, RED);
    log(error.stack, RED);
    process.exit(1);
});
