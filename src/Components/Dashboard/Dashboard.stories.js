import { DashboardStage } from "./DashboardStage";
import { MockDashboard, mock } from "../.././";
import "../../../tailwind.css";
import { MockDashboardApi } from "../../Api/MockDashboardApi";

/**
 * NOTE
 *
 * To instantiate the Dashboard, you MUST pass in a flavor of the API
 * - ElectronDashboardApi
 * - MockDashboardApi
 * - WebDashboardApi
 */
//
//👇 This default export determines where your story goes in the story list
const meta = {
    title: "Dashboard/DashboardStage",
    component: DashboardStage,
};
export default meta;

//👇 We create a “template” of how args map to rendering
const Template = (args) => {
    try {
        return (
            // <div className="flex flex-col h-screen w-full">
            // </div>
            <MockDashboard args={args} backgroundColor={"bg-gray-900"}>
                <DashboardStage
                    dashApi={new MockDashboardApi(mock.api)}
                    credentials={{ appId: "test-app-id" }}
                    {...args}
                />
            </MockDashboard>
        );
    } catch (e) {
        console.log(e);
        return <div>test</div>;
    }
};

export const DashboardTest = Template.bind({});

DashboardTest.args = {
    preview: true,
    backgroundColor: "bg-gray-800",
    height: "h-full",
    direction: "row",
};

DashboardTest.parameters = {
    layout: "fullscreen",
};
