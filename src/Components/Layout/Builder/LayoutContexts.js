import React from "react";
import { ComponentManager } from "../../../ComponentManager";
/**
 * Based on the widgets selected in the dashboard, we want to add in all of the contexts
 * that are required to render the widgets correctly.
 *
 * In this case, we will iterate through the configuration file of the dashboard being created
 * and add in the contexts that are required for the widgets selected.
 *
 * The contexts will be instantiated with the configuration data provided in the dashboard edit view
 */

const LayoutContexts = ({ workspace, children }) => {
    try {
        console.log("LayoutContexts workspace", workspace);
        // we have to search for the user configuration data for the workspace and pass that into the context associated
        // Reduce them into a single nested provider tree
        const contexts = ComponentManager.getContextsForLayout(workspace);
        console.log("LayoutContexts contexts", contexts);

        // we need to somehow injexct the user configuration data into the context components
        const contextComponents = contexts.map((c) => {
            console.log("LayoutContexts context component", c);
            return { provider: c.provider.component, props: c.props };
        });

        if (contexts.length > 0) {
            const composer = (providersWithProps) => {
                return providersWithProps.reduce(
                    (Acc, { provider: Provider, props }) => {
                        console.log("LayoutContexts provider", Provider, props);
                        return (childrenProps) => (
                            <Provider {...props}>
                                <Acc {...childrenProps} />
                            </Provider>
                        );
                    },
                    (props) => props.children
                );
            };

            const ComposedProviders = composer(contextComponents);

            return <ComposedProviders>{children}</ComposedProviders>;
        } else {
            return (
                <div
                    id="layout-contexts"
                    className="flex flex-col w-full h-full"
                >
                    HIYA{children}
                </div>
            );
        }

        // return (contextComponents && contextComponents.length > 0) ? contextComponents.reduceRight(
        //     (acc, Context) => <Context.Provider>{acc}</Context.Provider>,
        //     children
        // ) : children;
        // return <div className="flex flex-col w-full h-full">HI THERE{JSON.stringify(contexts.length)}{children}</div>;
    } catch (e) {
        console.log("LayoutContexts error", e);
        return <div className="flex flex-col w-full h-full">{children}</div>;
    }
};

export default LayoutContexts;
