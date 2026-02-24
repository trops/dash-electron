/**
 * TemplateWorkspace
 *
 * A Workspace holds the functionality (api's, libraries, etc) that can be injected
 * or accessed through Contexts by your Widgets.
 *
 * For example, if I were making an Algolia Search Workspace, I could setup my searchClient and keys
 * in this Workspace and make them available in a AlgoliaSearchContext.
 *
 * You can have a Workspace that is self-contained (no children), or if the Workspace can have children
 * the end user will be able to add similar workspace widgets into the Dash layout.
 *
 * @pacakge Template
 */
import { Workspace } from "../../../Components/Workspace";
import { TemplateContext } from "../../../Widgets/Template/contexts/TemplateContext";

/**
 * Note:
 * You may specify a value for the TemplateContext either in the Workspace or in the TemplateContext itself.
 * You may also employ a Wrapper around the TemplateContext to use get/set methods to update this value if desired.
 */
const sampleClient = {
    foo: function () {
        return "Bar!";
    },
};

export const TemplateWorkspace = ({ children, ...props }) => {
    return (
        <Workspace {...props}>
            {/* Use the Context (optional) to wrap the children in order to expose the Context */}
            <TemplateContext.Provider value={{ sampleClient }}>
                {children}
            </TemplateContext.Provider>
        </Workspace>
    );
};
