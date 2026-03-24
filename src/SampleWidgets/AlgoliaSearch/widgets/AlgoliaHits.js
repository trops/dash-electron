/**
 * AlgoliaHits
 *
 * Displays search results using useHits from react-instantsearch-hooks-web.
 * Supports Mustache templates for custom hit rendering.
 * Self-contained — wraps itself in InstantSearch context via credentials.
 *
 * @package Algolia Search
 */
import { Panel } from "@trops/dash-react";
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

    return (
        <div className="px-3 py-2 bg-white/5 rounded hover:bg-white/10 transition-colors">
            <div className="text-sm text-gray-200 font-medium">
                {displayTitle}
            </div>
            {displaySubtitle && (
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {displaySubtitle}
                </div>
            )}
            <div className="text-[10px] text-gray-600 mt-1 font-mono">
                {hit.objectID}
            </div>
        </div>
    );
}

function TemplateHitCard({ hit, template }) {
    let html;
    try {
        html = Mustache.render(template, hit);
    } catch {
        return (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                Template render error
            </div>
        );
    }

    return (
        <div
            className="px-3 py-2 bg-white/5 rounded hover:bg-white/10 transition-colors text-sm text-gray-200"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function HitsDisplay({ hitTemplate }) {
    const { hits } = useHits();

    if (hits.length === 0) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="text-gray-500 text-xs italic">
                    No results found.
                </div>
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
