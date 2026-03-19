import { GmailCompose } from "./GmailCompose";

const widgetDefinition = {
    name: "GmailCompose",
    displayName: "GmailCompose",
    component: GmailCompose,
    canHaveChildren: false,
    workspace: "Gmail-workspace",
    package: "Gmail",
    author: "Dash Team",
    icon: "envelope",
    description:
        "Compose and send emails. Listens for emailSelected to pre-fill reply-to fields.",
    type: "widget",
    events: [],
    eventHandlers: ["emailSelected"],
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-red-900",
        borderColor: "border-red-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Compose Email",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
