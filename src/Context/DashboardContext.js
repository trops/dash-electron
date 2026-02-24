import { createContext } from "react";
import { DashboardPublisher } from "../Components/Dashboard/DashboardPublisher";
import { WidgetApi } from "../Api";

function buildWidgetApi() {
    console.log(DashboardPublisher);
    const w = WidgetApi;
    w.setPublisher(DashboardPublisher);
    return w;
}

export const DashboardContext = createContext({
    pub: DashboardPublisher,
    widgetApi: buildWidgetApi(),
    dashApi: null,
    providers: {},
});
