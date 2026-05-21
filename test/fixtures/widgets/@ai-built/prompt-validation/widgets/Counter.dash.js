import Counter from "./Counter";

export default {
    component: Counter,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Counter",
            displayName: "Title",
            instructions: "The label shown above the counter",
            required: false,
        },
        initialValue: {
            type: "number",
            defaultValue: 0,
            displayName: "Initial Value",
            instructions:
                "The starting value (also the value Reset returns to)",
            required: false,
        },
        step: {
            type: "number",
            defaultValue: 1,
            displayName: "Step Size",
            instructions: "How much each + / − click adjusts the counter",
            required: false,
        },
    },
};
