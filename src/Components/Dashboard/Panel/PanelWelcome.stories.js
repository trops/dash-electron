import { PanelWelcome } from "./PanelWelcome";
import { MockWrapper, mock } from "../../.././";
import "../../../tailwind.css";

//👇 This default export determines where your story goes in the story list
const meta = {
    title: "Dashboard/Panel/PanelWelcome",
    component: PanelWelcome,
};
export default meta;

//👇 We create a “template” of how args map to rendering
const Template = (args) => {
    return (
        <MockWrapper
            api={mock.api}
            theme={mock.theme}
            args={args}
            backgroundColor={"bg-gray-900"}
        >
            <PanelWelcome {...args} />
        </MockWrapper>
    );
};

export const ThemedPreview = Template.bind({});
export const ThemedPreviewNo = Template.bind({});

ThemedPreview.args = {
    preview: true,
    backgroundColor: "bg-gray-800",
    height: "h-full",
};

ThemedPreviewNo.args = {
    theme: true,
    preview: false,
    backgroundColor: "bg-gray-800",
};
