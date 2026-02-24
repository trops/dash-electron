import { deepCopy } from "@trops/dash-react";

export const SettingsModel = (settingsObject = {}) => {
    const obj = deepCopy(settingsObject);
    obj["debug"] = "debug" in obj ? obj["debug"] : false;
    obj["theme"] = "theme" in obj ? obj["theme"] : null;

    return obj;
};
