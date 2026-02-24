import { LayoutManagerModal } from "./LayoutManagerModal";
import { mock, MockWrapper } from "../../.././";
import "../../../tailwind.css";

const meta = {
    title: "Layout/LayoutManager/LayoutManagerModal",
    component: LayoutManagerModal,
};
export default meta;

const Template = (args) => {
    return (
        <MockWrapper api={mock.api} theme={mock.themes} args={args}>
            <LayoutManagerModal {...args} />
        </MockWrapper>
    );
};

export const Primary = Template.bind({});

Primary.args = {
    open: true,
    scrollable: true,
    onCreateWorkspace: (layoutObj) => {
        console.log("Create workspace with layout:", layoutObj);
    },
};
