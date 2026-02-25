import { Workspace } from "@trops/dash-core";
import { DashSamplesContext } from "../contexts";

export const DashSamplesWorkspace = ({ children, ...props }) => {
    return (
        <Workspace {...props}>
            <DashSamplesContext.Provider value={{}}>
                {children}
            </DashSamplesContext.Provider>
        </Workspace>
    );
};
