/**
 * Widget Registry & Loader Example
 *
 * This example demonstrates:
 * 1. Loading a local widget from your Widgets folder
 * 2. Discovering available widgets
 * 3. Simulating download and registration flow
 */

import { widgetRegistry } from "../src/utils/WidgetRegistry.js";
import { dynamicWidgetLoader } from "../src/utils/DynamicWidgetLoader.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function demonstrateWidgetSystem() {
    console.log("\n========== WIDGET REGISTRY DEMO ==========\n");

    // Example 1: Load widget from local Widgets folder
    console.log("--- Example 1: Loading Local Widget ---");
    const localWidgetPath = path.join(
        __dirname,
        "../src/Widgets/MyFirstWidget"
    );
    const discoveredWidgets =
        dynamicWidgetLoader.discoverWidgets(localWidgetPath);
    console.log("Discovered widgets:", discoveredWidgets);

    if (discoveredWidgets.length > 0) {
        const widgetName = discoveredWidgets[0];
        console.log(`\nLoading widget: ${widgetName}`);

        try {
            const loaded = await dynamicWidgetLoader.loadWidget(
                "MyFirstWidget",
                localWidgetPath,
                widgetName
            );
            console.log("✓ Widget loaded successfully!");
            console.log("Config name:", loaded.config.name);
            console.log("Component path:", loaded.component.path);
        } catch (error) {
            console.error("✗ Error loading widget:", error.message);
        }
    }

    // Example 2: Register local widget in registry
    console.log("\n--- Example 2: Registering Widget in Registry ---");
    try {
        const config = await dynamicWidgetLoader.loadConfigFile(
            path.join(localWidgetPath, "widgets/MyFirstWidgetWidget.dash.js")
        );
        widgetRegistry.registerWidget("MyFirstWidget", config, localWidgetPath);
        console.log("✓ Widget registered in registry");
    } catch (error) {
        console.error("✗ Error registering widget:", error.message);
    }

    // Example 3: List all registered widgets
    console.log("\n--- Example 3: Registered Widgets ---");
    const widgets = widgetRegistry.getWidgets();
    console.log(`Total registered: ${widgets.length}`);
    widgets.forEach((widget) => {
        console.log(`  - ${widget.name} (v${widget.version || "1.0.0"})`);
    });

    // Example 4: Simulate downloading a widget
    console.log("\n--- Example 4: Download Simulation ---");
    console.log("In a real scenario, you would:");
    console.log(
        '1. Call: widgetRegistry.downloadWidget("NewWidget", "https://example.com/widget.zip")'
    );
    console.log(
        "2. The widget would be extracted to:",
        widgetRegistry.getCachePath()
    );
    console.log(
        "3. Then dynamically load it with: dynamicWidgetLoader.loadWidget(...)"
    );

    console.log("\n========== END DEMO ==========\n");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateWidgetSystem().catch(console.error);
}

export { demonstrateWidgetSystem };
