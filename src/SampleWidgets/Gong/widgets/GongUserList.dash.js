import { GongUserList } from "./GongUserList";

const widgetDefinition = {
    packageName: "gong",
    scope: "trops",
    id: "trops.gong.GongUserList",
    name: "GongUserList",
    displayName: "Gong Users",
    component: GongUserList,
    canHaveChildren: false,
    workspace: "Gong-workspace",
    package: "Gong",
    author: "Dash Team",
    icon: "users",
    description:
        "Search and browse Gong workspace users. Publishes userSelected events.",
    type: "widget",
    events: ["userSelected"],
    eventHandlers: [],
    providers: [{ type: "gong", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Gong Users",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
