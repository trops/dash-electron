/**
 * ComposerProviderChoiceContext — the wirable-type record the user
 * picked in the QuickStartPane's provider intent, surfaced to every
 * descendant of ComposerPaneV2 via React context.
 *
 * Phase D plumbing: ComposerPaneV2 captures the providerChoice when
 * `QuickStartPane.onApplyGrid` fires with a second arg, stashes it in
 * local state, and wraps its children in `<Provider value={...}>`.
 * Today no consumer reads — the context is here so a future auto-wire
 * feature ("dropping a SearchInput when Algolia is the context →
 * onChange pre-wired to algolia.search") can pull the picked provider
 * without prop-drilling through Inspector + handlers.
 *
 * Default value `null` keeps `useContext` semantics consistent: a
 * subtree mounted outside ComposerPaneV2 (e.g. the Inspector in a
 * detached preview test) reads null instead of crashing.
 *
 * The value shape mirrors the wirable-type record from
 * `useWirableTypes` (see wirableTypes.js):
 *
 *   {
 *     id: "algolia",
 *     name: "Algolia",
 *     kind: "credential" | "mcp",
 *     description: "Search and manage Algolia indices…",
 *     hasConfiguredInstance: bool,
 *     configuredInstances: ["My Algolia", ...],
 *   }
 *
 * — same record QuickStartPane.ProviderPicker hands to setProviderChoice.
 */
import React from "react";

export const ComposerProviderChoiceContext = React.createContext(null);

/**
 * Convenience hook for the (future) auto-wire consumers. Returns the
 * current picked provider record, or null when nothing was picked or
 * the consumer is mounted outside a ComposerPaneV2 subtree.
 */
export function useComposerProviderChoice() {
    return React.useContext(ComposerProviderChoiceContext);
}
