/**
 * AlgoliaHits
 *
 * Displays search results using useHits from react-instantsearch-hooks-web.
 * Supports Mustache templates for custom hit rendering.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
import { useContext } from "react";
import { Panel, AlertBanner, Caption2, ThemeContext } from "@trops/dash-react";
import { Widget } from "@trops/dash-core";
import { useHits } from "react-instantsearch-hooks-web";
import Mustache from "mustache";
import { AlgoliaInstantSearchWrapper } from "./AlgoliaInstantSearchWrapper";
import { QuerySync } from "./QuerySync";

function DefaultHitCard({ hit }) {
    const displayTitle =
        hit.title || hit.name || hit.label || hit.objectID || "Untitled";
    const displaySubtitle =
        hit.description || hit.subtitle || hit.content?.substring(0, 120) || "";
    const { currentTheme } = useContext(ThemeContext);

    return (
        <div
            className={`px-3 py-2 rounded transition-colors ${
                currentTheme?.["bg-primary-dark"] || ""
            } ${currentTheme?.["hover-bg-primary-dark"] || ""}`}
        >
            <div
                className={`text-sm font-medium ${
                    currentTheme?.["text-primary-medium"] || ""
                }`}
            >
                {displayTitle}
            </div>
            {displaySubtitle && (
                <Caption2 block className="mt-0.5 line-clamp-2">
                    {displaySubtitle}
                </Caption2>
            )}
            <Caption2 block className="mt-1 font-mono opacity-75">
                {hit.objectID}
            </Caption2>
        </div>
    );
}

function TemplateHitCard({ hit, template }) {
    const { currentTheme } = useContext(ThemeContext);
    let html;
    try {
        html = Mustache.render(template, hit);
    } catch {
        return (
            <AlertBanner
                variant="error"
                size="compact"
                message="Template render error"
            />
        );
    }

    return (
        <div
            className={`px-3 py-2 rounded transition-colors text-sm ${
                currentTheme?.["bg-primary-dark"] || ""
            } ${currentTheme?.["hover-bg-primary-dark"] || ""} ${
                currentTheme?.["text-primary-medium"] || ""
            }`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function HitsDisplay({ hitTemplate }) {
    const { hits } = useHits();

    if (hits.length === 0) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <Caption2 block className="italic">
                    No results found.
                </Caption2>
            </div>
        );
    }

    const useTemplate = hitTemplate && hitTemplate.trim().length > 0;

    return (
        <div className="flex flex-col gap-1 overflow-y-auto h-full">
            {hits.map((hit) => (
                <div key={hit.objectID}>
                    {useTemplate ? (
                        <TemplateHitCard hit={hit} template={hitTemplate} />
                    ) : (
                        <DefaultHitCard hit={hit} />
                    )}
                </div>
            ))}
        </div>
    );
}

export const AlgoliaHits = ({ hitTemplate = "", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaInstantSearchWrapper>
                    <QuerySync />
                    <HitsDisplay hitTemplate={hitTemplate} />
                </AlgoliaInstantSearchWrapper>
            </Panel>
        </Widget>
    );
};
