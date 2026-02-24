import { Widget } from "./Widget";
import { MockWrapper, mock, mockText } from "../Mock";
import { Heading, Paragraph, Panel } from "@trops/dash-react";
import { LayoutContainer } from "../Components/Layout/LayoutContainer";
import { DashPanel } from "..";

const meta = {
    title: "Widget/Widget",
    component: Widget,
};
export default meta;

const Template = (args) => {
    return (
        <MockWrapper api={mock.api} theme={mock.themes}>
            <LayoutContainer scrollable={true}>
                <Heading title="Widget" />
                <Paragraph text={mockText.paragraph} />
            </LayoutContainer>
        </MockWrapper>
    );
};

const TemplateDashPanel = (args) => {
    return (
        <MockWrapper api={mock.api} theme={mock.themes} {...args}>
            <DashPanel>
                <DashPanel.Header title={"Dash Panel"}>
                    Dash Panel
                </DashPanel.Header>
                <DashPanel.Body>{mockText.paragraph}</DashPanel.Body>
                <DashPanel.Footer>Footer</DashPanel.Footer>
            </DashPanel>
        </MockWrapper>
    );
};

const TemplateDashPanelParagraph = (args) => {
    return (
        <MockWrapper api={mock.api} theme={mock.themes} {...args}>
            <DashPanel>
                <DashPanel.Header title={"Dash Panel"}>
                    Dash Panel
                </DashPanel.Header>
                <DashPanel.Body>
                    <Paragraph text={mockText.paragraph} scrollable={true} />
                </DashPanel.Body>
                <DashPanel.Footer>Footer</DashPanel.Footer>
            </DashPanel>
        </MockWrapper>
    );
};

const TemplateScrollableList = (args) => {
    return (
        <MockWrapper api={mock.api} theme={mock.themes} {...args}>
            <LayoutContainer
                scrollable={true}
                direction="col"
                height="h-full"
                width="w-full"
            >
                <Panel>
                    <Panel.Body>test</Panel.Body>
                </Panel>
                <Panel>
                    <Panel.Body>test</Panel.Body>
                </Panel>
                <Panel>
                    <Panel.Body>test</Panel.Body>
                </Panel>
                <Panel>
                    <Panel.Body>test</Panel.Body>
                </Panel>
                <Panel>
                    <Panel.Body>test</Panel.Body>
                </Panel>
            </LayoutContainer>
        </MockWrapper>
    );
};

export const Primary = Template.bind({});
export const PrimaryDashPanel = TemplateDashPanel.bind({});
export const PrimaryDashPanelParagraph = TemplateDashPanelParagraph.bind({});
export const PrimaryScrollableList = TemplateScrollableList.bind({});

Primary.args = {
    title: "Widget",
    scrollable: false,
    height: "h-60",
};

PrimaryDashPanel.args = {
    title: "Dash Panel",
    scrollable: false,
    height: "h-60",
};

PrimaryDashPanelParagraph.args = {
    title: "Dash Panel",
    scrollable: false,
    height: "h-60",
};

PrimaryScrollableList.args = {
    title: "Dash Panel",
    scrollable: false,
    height: "h-full",
    direction: "vertical",
};
