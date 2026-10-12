/**
 * widgetChecksEntry — what the main process gets from the Widget Builder's
 * checks (create-entry PRD CRE-011, slice 3b-1). scripts/build-widget-checks.js
 * bundles this file into public/lib/widgetChecks.cjs so the Dash team's
 * Checker runs exactly the checks the Widget Builder runs. These renderer
 * files stay the only source; CI fails if the generated file is stale.
 */
export {
    validateProviderApiUsage,
    validateNoModalUsage,
    validateNoBotCalls,
    validateEventPublishing,
    validateComponentReferences,
    buildAiCorrectionMessage,
    buildNoModalCorrectionMessage,
    buildNoBotCallsCorrectionMessage,
    buildEventPublishingCorrectionMessage,
    buildComponentReferenceCorrectionMessage,
} from "./widgetCodeValidator";
export { evaluateScorecard } from "./composer/scorecardChecks";
export {
    MCP_KNOWN_TOOLS,
    getKnownToolsForType,
    getKnownToolArgs,
} from "./composer/mcpKnownTools";
