function dynamicWidgetLoaderStub() {
    throw new Error(
        "DynamicWidgetLoader is Electron-only and must be used from the main process."
    );
}

class DynamicWidgetLoader {
    constructor() {
        dynamicWidgetLoaderStub();
    }
}

module.exports = DynamicWidgetLoader;
module.exports.dynamicWidgetLoader = null;
