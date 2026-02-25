import { DashSamplesWorkspace } from "./DashSamplesWorkspace";

const workspaceDefinition = {
    name: "DashSamplesWorkspace",
    component: DashSamplesWorkspace,
    canHaveChildren: true,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    type: "workspace",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-slate-950",
        borderColor: "border-slate-800",
    },
    userConfig: {},
};
export default workspaceDefinition;
