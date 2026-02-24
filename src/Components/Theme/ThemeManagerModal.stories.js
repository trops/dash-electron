import { ThemeManagerModal } from "./ThemeManagerModal";
import { mock, MockWrapper } from "../.././";
import "../tailwind.css";

const meta = {
    title: "Theme/ThemeManagerModal",
    component: ThemeManagerModal,
};
export default meta;

const Template = (args) => {
    return (
        <MockWrapper api={mock.api} theme={mock.theme} args={args}>
            <ThemeManagerModal {...args} />
        </MockWrapper>
    );
};

export const Primary = Template.bind({});

Primary.args = {
    //👇 The args you need here will depend on your component
    open: true,
    width: "w-full",
};
