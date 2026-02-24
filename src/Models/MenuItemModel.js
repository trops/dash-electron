import { deepCopy } from "@trops/dash-react";

export const MenuItemModel = (menuItem = {}) => {
    const obj =
        menuItem !== null && menuItem !== undefined ? deepCopy(menuItem) : {};

    const m = {};

    m.id = "id" in obj ? obj["id"] : 1;
    m.name = "name" in obj ? obj["name"] : "Uncategorized";
    m.folder = "icon" in obj ? obj["icon"] : "folder";

    return m;
};
