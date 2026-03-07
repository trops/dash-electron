/**
 * QuerySync
 *
 * Invisible bridge component that lives inside <InstantSearch>.
 * Listens for queryChanged events from AlgoliaSearchBox via useWidgetEvents
 * and calls useSearchBox().refine() to sync the search state.
 *
 * Drop <QuerySync /> inside any <AlgoliaInstantSearchWrapper> to make
 * that widget respond to cross-widget query events.
 */
import { useEffect, useRef } from "react";
import { useWidgetEvents } from "@trops/dash-core";
import { useSearchBox } from "react-instantsearch-hooks-web";

export function QuerySync() {
    const { listen, listeners } = useWidgetEvents();
    const { refine } = useSearchBox();
    const refineRef = useRef(refine);
    refineRef.current = refine;

    useEffect(() => {
        if (listeners && listen) {
            listen(listeners, {
                onQueryChanged: (data) => refineRef.current(data.message.query),
            });
        }
    }, [listeners, listen]);

    return null;
}
