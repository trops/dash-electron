import { mock, ComponentManager } from "../.";
import { AppContext, ThemeContext, ThemeWrapper } from "../Context";
import {
    LayoutContainer,
    MockDashboardApi,
    Widget,
    Workspace,
    DashboardWrapper,
} from "..";
import { Routes, Route, HashRouter } from "react-router-dom";
import { themes } from "./theme";

// Local Widgets that integrate with Dash
import * as myWidgets from "../Widgets";

const MockWrapper = ({
    api,
    apiMock = null,
    children,
    backgroundColor = "bg-transparent",
}) => {
    function getAppContext() {
        return {
            ...mock,
            creds: {
                appId: "2345",
            },
            settings: {
                theme: "theme-1",
                debug: false,
            },
            dialog: {},
            debugMode: true,
        };
    }

    return (
        <div className="flex flex-col h-screen w-full m-0 overflow-clip bg-blue-500 p-4">
            <AppContext.Provider value={getAppContext()}>
                <ThemeWrapper
                    theme={themes["theme-1"]}
                    credentials={getAppContext().creds}
                    dashApi={new MockDashboardApi(api)}
                >
                    <div
                        className={`flex flex-col space-y-2 w-full h-full p-0 border rounded-lg overflow-clip rounded border-1 border-gray-300 bg-gray-200 ${backgroundColor}`}
                    >
                        <span className="uppercase text-gray-800 font-bold text-sm">
                            Workspace - WIDGET - Item is a child of the Widget
                            component`
                        </span>
                        <Workspace
                            uuid="MockWorkspace1"
                            id="MockWrapperWorkspace"
                            direction="col"
                            scrollable={false}
                            className={""}
                            space={true}
                            grow={true}
                            height={"h-full"}
                        >
                            <Widget
                                uuid="MockWrapperWidget"
                                space={true}
                                direction="col"
                                grow={true}
                                height="h-full"
                            >
                                {children}
                            </Widget>
                        </Workspace>
                    </div>
                </ThemeWrapper>
                {/* </ThemeContext.Provider> */}
            </AppContext.Provider>
        </div>
    );
};

/**
 * MockLayout
 *
 * For testing the LayoutContainer as a base component
 */
const MockLayout = ({
    apiMock = null,
    children,
    backgroundColor = "bg-transparent",
    ...props
}) => {
    function getAppContext() {
        return {
            ...mock,
            creds: {
                appId: "2345",
            },
            settings: {
                theme: "theme-1",
                debug: false,
            },
            debugMode: true,
        };
    }

    return (
        <div className="flex flex-col h-screen w-full m-auto overflow-clip">
            <AppContext.Provider value={getAppContext()}>
                <ThemeContext.Provider value={mock.theme.context}>
                    <div
                        className={`flex flex-col space-y-4 w-full h-7/8 p-6 border rounded-lg border-1 border-gray-700 bg-gray-300 overflow-y-auto flex-grow`}
                    >
                        <span className="uppercase text-gray-800 font-bold text-sm">
                            Layout - Item is a child of the LayoutContainer
                            component
                        </span>
                        <LayoutContainer
                            id="MockLayoutContainer"
                            scrollable={false}
                            height="h-full"
                            width="w-full"
                            direction={
                                props.direction ? props.direction : "row"
                            }
                            className="bg-gray-900"
                            grow={true}
                            space={true}
                        >
                            {children}
                        </LayoutContainer>
                    </div>
                </ThemeContext.Provider>
            </AppContext.Provider>
        </div>
    );
};

const MockWorkspace = ({
    apiMock = null,
    children,
    backgroundColor = "bg-transparent",
    ...props
}) => {
    function getAppContext() {
        return {
            ...mock,
            creds: {
                appId: "2345",
            },
            settings: {
                theme: "theme-1",
                debug: false,
            },
            debugMode: true,
        };
    }

    return (
        <div className="flex flex-col h-screen w-full m-auto overflow-clip">
            <AppContext.Provider value={getAppContext()}>
                <ThemeContext.Provider value={mock.theme.context}>
                    <div
                        className={`flex flex-col space-y-2 w-full h-7/8 p-2 border rounded-lg overflow-y-auto flex-shrink rounded border-1 border-gray-300 bg-gray-200`}
                    >
                        <Workspace {...props}>{children}</Workspace>
                    </div>
                </ThemeContext.Provider>
            </AppContext.Provider>
        </div>
    );
};

const MockDashboard = ({
    api,
    apiMock = null,
    children,
    backgroundColor = "bg-transparent",
}) => {
    // initialize the widgets
    // do inside the dashboard?
    // ComponentManager.init(dashWidgets);

    // register the widgets in the Widgets directory for Mock purposes.
    Object.keys(myWidgets).forEach((w) => {
        ComponentManager.registerWidget(myWidgets[w], w);
    });

    return (
        <HashRouter forceRefresh={true}>
            <Routes>
                <Route path="/" element={children} />
            </Routes>
        </HashRouter>
    );
};

export { MockLayout, MockWrapper, MockWorkspace, MockDashboard };
