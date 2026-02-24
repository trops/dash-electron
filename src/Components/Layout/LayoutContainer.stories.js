import { LayoutContainer } from "./LayoutContainer";
import { MockWrapper, MockLayout, mock, mockText } from "../../Mock";
import { Workspace } from "..";
import { Widget } from "..";

const meta = {
    title: "Layout/LayoutContainer",
    component: LayoutContainer,
};
export default meta;

console.log(mock);

const Template = (args) => {
    return (
        <MockWrapper api={mock.api} args={args}>
            <LayoutContainer {...args}>{mockText.paragraph}</LayoutContainer>
        </MockWrapper>
    );
};

const TemplateLayoutThreeColumn = (args) => {
    return (
        <MockLayout api={mock.api} args={{ direction: "col", ...args }}>
            <LayoutContainer
                id="outer-container"
                direction="col"
                grow={false}
                scrollable={false}
                space={true}
            >
                <LayoutContainer
                    direction="row"
                    className="bg-green-500"
                    grow={false}
                    id="top-row"
                >
                    TEST ROW
                </LayoutContainer>
                <LayoutContainer
                    direction="row"
                    grow={true}
                    scrollable={true}
                    height="h-full"
                    className="bg-orange-500"
                    id="row-2"
                    space={true}
                >
                    <Workspace
                        direction="col"
                        className={"bg-blue-500 rounded"}
                        grow={true}
                        scrollable={true}
                        space={true}
                    >
                        <Widget {...args.widgetArgs}>
                            {mockText.paragraph}
                        </Widget>

                        <Widget {...args.widgetArgs}>
                            {mockText.paragraph}
                        </Widget>

                        <Widget {...args.widgetArgs}>
                            {mockText.paragraph}
                        </Widget>
                    </Workspace>

                    <Workspace
                        direction="col"
                        className={"bg-blue-500 rounded"}
                        grow={false}
                        scrollable={true}
                    >
                        <LayoutContainer {...args.layoutArgs} direction="col">
                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>

                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>

                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>
                        </LayoutContainer>
                    </Workspace>

                    <Workspace
                        direction="col"
                        className={"bg-blue-500 rounded"}
                        grow={true}
                        scrollable={true}
                    >
                        <LayoutContainer direction={"col"} {...args.layoutArgs}>
                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>

                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>

                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>
                        </LayoutContainer>
                    </Workspace>
                </LayoutContainer>
            </LayoutContainer>
        </MockLayout>
    );
};

const TemplateLayoutThreeRow = (args) => {
    return (
        <MockLayout
            api={mock.api}
            theme={mock.theme}
            args={{ direction: "col", ...args }}
        >
            <LayoutContainer
                id="outer-container"
                direction="col"
                grow={false}
                scrollable={false}
                space={true}
            >
                <LayoutContainer
                    direction="row"
                    className="bg-green-500"
                    grow={false}
                    id="top-row"
                >
                    <span className="text-green-300">TESTING</span>
                    {/* <InstantSearch
                        indexName="dev_find_accelerator"
                        searchClient={searchClient}
                    >
                        <AlgoliaSearchBox {...args} />
                    </InstantSearch>
                    <AlgoliaSearchBox /> */}
                </LayoutContainer>
                <LayoutContainer
                    direction="row"
                    grow={false}
                    scrollable={true}
                    height="h-full"
                    className="bg-orange-700"
                    id="row-2"
                    space={false}
                >
                    <Workspace id="Col-Workspace" direction="col">
                        {/* <LayoutContainer {...args.layoutArgs} direction="row"> */}
                        <Widget {...args.widgetArgs}>
                            {mockText.paragraph}
                        </Widget>

                        <Widget {...args.widgetArgs}>
                            {mockText.paragraph}
                        </Widget>

                        <Widget {...args.widgetArgs}>
                            {mockText.paragraph}
                        </Widget>
                        {/* </LayoutContainer> */}
                    </Workspace>

                    <Workspace direction="col">
                        <LayoutContainer {...args.layoutArgs} direction="row">
                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>

                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>

                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>
                        </LayoutContainer>
                    </Workspace>

                    <Workspace direction="col">
                        <LayoutContainer direction={"row"} {...args.layoutArgs}>
                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>

                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>

                            <Widget {...args.widgetArgs}>
                                {mockText.paragraph}
                            </Widget>
                        </LayoutContainer>
                    </Workspace>
                </LayoutContainer>
            </LayoutContainer>
        </MockLayout>
    );
};

export const Primary = Template.bind({});
export const ThreeColumn = TemplateLayoutThreeColumn.bind({});
export const ThreeRow = TemplateLayoutThreeRow.bind({});
Primary.args = {
    title: "LayoutContainer",
    scrollable: true,
    height: "h-60",
    variant: "light",
};

ThreeColumn.args = {
    title: "LayoutContainer",
    scrollable: true,
    height: "h-60",
    width: "",
    variant: "light",
    layoutArgs: {
        scrollable: false,
        grow: false,
        height: "h-full",
        space: false,
    },
    widgetArgs: {
        height: "h-full",
        backgroundColor: "bg-blue-500",
    },
};

ThreeRow.args = {
    title: "LayoutContainer",
    scrollable: true,
    height: "h-60",
    variant: "light",
    layoutArgs: {
        scrollable: false,
        grow: false,
        height: "h-full",
        space: true,
    },
    widgetArgs: {
        height: "h-full",
        className: "bg-blue-500",
        space: true,
        grow: true,
        scrollable: true,
    },
};
