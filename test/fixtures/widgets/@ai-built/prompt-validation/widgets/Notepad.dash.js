import Notepad from "./Notepad";

export default {
    component: Notepad,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Notepad",
            displayName: "Title",
            instructions: "Title shown above the note area.",
            required: false,
        },
        placeholder: {
            type: "text",
            defaultValue: "Start typing…",
            displayName: "Placeholder",
            instructions: "Placeholder text shown when the note is empty.",
            required: false,
        },
    },
};
