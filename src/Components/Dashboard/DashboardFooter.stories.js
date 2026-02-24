import { DashboardFooter } from "./DashboardFooter";
import { MockWrapper, mock } from "../.././";
import "../../../tailwind.css";

//👇 This default export determines where your story goes in the story list
const meta = {
    title: "Dashboard/DashboardFooter",
    component: DashboardFooter,
};
export default meta;

//👇 We create a “template” of how args map to rendering
const Template = (args) => {
    return (
        <div className="flex flex-col h-full w-full">
            <MockWrapper
                api={mock.api}
                theme={mock.theme}
                args={args}
                backgroundColor={"bg-gray-900"}
            >
                <DashboardFooter {...args} />
            </MockWrapper>
        </div>
    );
};

export const ThemedPreview = Template.bind({});
export const ThemedPreviewNo = Template.bind({});

ThemedPreview.args = {
    preview: true,
    backgroundColor: "bg-gray-800",
};

ThemedPreviewNo.args = {
    theme: true,
    preview: false,
    backgroundColor: "bg-gray-800",
};
