const widgetRegistry = null;

function setupWidgetRegistryHandlers() {
    throw new Error(
        "WidgetRegistry is Electron-only and must be used from the main process."
    );
}

module.exports = {};
module.exports.widgetRegistry = widgetRegistry;
module.exports.setupWidgetRegistryHandlers = setupWidgetRegistryHandlers;
