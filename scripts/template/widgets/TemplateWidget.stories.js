import React from "react";
import { TemplateWidget } from "./TemplateWidget";

export default {
    title: "TemplateWidget",
    component: TemplateWidget,
};

const StorySample = (args) => <TemplateWidget {...args} />;

export const TemplateStoryItem = StorySample.bind({});
TemplateStoryItem.args = {
    title: "Test",
};
