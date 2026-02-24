import { MockWorkspace, mock, mockText } from "../../Mock";
import { Workspace } from "..";
import { Widget } from "..";
import { Paragraph } from "..";

const meta = {
    title: "Workspace/Workspace",
    component: Workspace,
};
export default meta;

const TemplateColumn = (args) => {
    return (
        <MockWorkspace api={mock.api} theme={mock.themes} {...args}>
            <Widget className={args.widgetArgs.className}>
                <Paragraph text={mockText.paragraph} />
            </Widget>
            <Widget className={args.widgetArgs.className}>
                <Paragraph text={mockText.paragraph} />
            </Widget>
            <Widget className={args.widgetArgs.className}>
                <Paragraph text={mockText.paragraph} />
            </Widget>
        </MockWorkspace>
    );
};

const TemplateRow = (args) => {
    return (
        <MockWorkspace api={mock.api} theme={mock.themes} {...args}>
            <Widget className={args.widgetArgs.className} {...args.widgetArgs}>
                <Paragraph text={mockText.paragraph} />
            </Widget>
            <Widget className={args.widgetArgs.className} {...args.widgetArgs}>
                <Paragraph text={mockText.paragraph} />
            </Widget>
            <Widget className={args.widgetArgs.className} {...args.widgetArgs}>
                <Paragraph text={mockText.paragraph} />
            </Widget>
        </MockWorkspace>
    );
};

export const Column = TemplateColumn.bind({});
export const Row = TemplateRow.bind({});

Column.args = {
    direction: "col",
    title: "Workspace",
    scrollable: true,
    space: true,
    height: "h-full",
    variant: "light",
    widgetArgs: {
        className: "bg-red-500 rounded p-4",
        space: true,
        grow: true,
    },
    className: "bg-orange-500 p-4 rounded",
};

Row.args = {
    direction: "row",
    title: "Workspace",
    scrollable: true,
    space: true,
    height: "h-full",
    variant: "light",
    widgetArgs: {
        className: "bg-red-500 rounded p-4",
        space: true,
        grow: true,
    },
    className: "bg-orange-500 p-4 rounded",
};
