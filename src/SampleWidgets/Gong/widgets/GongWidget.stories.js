import React from "react";
import { GongWidget } from "./GongWidget";

export default {
    title: "GongWidget",
    component: GongWidget,
};

const StorySample = (args) => <GongWidget {...args} />;

export const GongStoryItem = StorySample.bind({});
GongStoryItem.args = {
    title: "Test",
};
