import { DashboardContext } from "./DashboardContext";
import { DashboardPublisher } from "../Components/Dashboard";
import { WidgetApi } from "../Api";
import { AppWrapper } from "./App/AppWrapper";
import { ThemeWrapper } from "./ThemeWrapper";
import { MainSection } from "@trops/dash-react";
import { useContext, useMemo } from "react";
import { AppContext } from "./App/AppContext";

const EMPTY_PROVIDERS = {};

export const DashboardWrapper = ({
    dashApi,
    credentials,
    backgroundColor = null,
    children,
}) => {
    // use the contexts to pass through any information
    const appContext = useContext(AppContext);

    const widgetApi = useMemo(() => {
        const w = WidgetApi;
        w.setPublisher(DashboardPublisher);
        w.setElectronApi(dashApi);
        return w;
    }, [dashApi]);

    const providers = appContext?.providers || EMPTY_PROVIDERS;

    const contextValue = useMemo(
        () => ({
            widgetApi,
            pub: DashboardPublisher,
            dashApi,
            credentials,
            providers,
        }),
        [widgetApi, dashApi, credentials, providers]
    );

    return (
        <AppWrapper dashApi={dashApi} credentials={credentials}>
            <ThemeWrapper dashApi={dashApi} credentials={credentials}>
                <div className="flex flex-col w-screen h-screen overflow-clip justify-between p-0">
                    <MainSection backgroundColor={backgroundColor}>
                        <DashboardContext.Provider value={contextValue}>
                            {children}
                        </DashboardContext.Provider>
                    </MainSection>
                </div>
            </ThemeWrapper>
        </AppWrapper>
    );
};
