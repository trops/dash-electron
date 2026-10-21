import React, { useCallback, useState } from "react";
import {
    Button2,
    Button3,
    Card2,
    EmptyState,
    FontAwesomeIcon,
    ListRow,
} from "@trops/dash-react";
import { INTENTS, getSampleLayoutsForIntent } from "./composerSampleLayouts";
import { useWirableTypes } from "./wirableTypes";
import { useBuilderTheme } from "../useBuilderTheme";

// Stable empty-object reference for the providers default. Without
// this, omitting the prop creates a fresh `{}` per render — and
// useWirableTypes' useEffect depends on providers identity, so it
// re-runs on every render → setState → re-render → infinite loop.
// Module-level const keeps the identity stable across all callers.
const EMPTY_PROVIDERS = {};

/**
 * QuickStartPane — the composer's empty-state onboarding.
 *
 * Rendered by ComposerPaneV2 when `isGridEmpty(grid)` is true.
 * Two-step intent-first wizard:
 *
 *   Step 1 — pick the widget's purpose: Search / View / Act / Custom.
 *     The four intents cover ~all common widget shapes; the user
 *     answers ONE question instead of scanning a 4-card sample grid
 *     + an AI form + an escape hatch (which the flat list felt like).
 *
 *   Step 2 — show only the starters that match the chosen intent.
 *     A Back button returns to step 1. The "Start blank" escape
 *     hatch is reachable from both steps.
 *
 * Sample layouts call their own `buildGrid()` mutator chain; the grid is
 * handed to `onApplyGrid`, which fires `onChange`/`onEmit` via
 * ComposerPaneV2's setGrid effect. Describing the widget instead goes to
 * the Dash team (`onAskDashTeam`) — the builder has no AI of its own.
 */
export function QuickStartPane({
    onApplyGrid,
    onRequestPalette,
    seedCellId,
    providers = EMPTY_PROVIDERS,
    // (text) → the builder closes and Create opens on it. Optional.
    onAskDashTeam = null,
}) {
    const bt = useBuilderTheme();
    // null = step 1 (pick intent). Set to an intent id ("search", etc)
    // to advance to step 2 (tailored starters).
    const [intent, setIntent] = useState(null);
    // Only meaningful when intent === "provider". Carries the picked
    // provider's wirable-type record ({id, name, kind, description, …})
    // so the starters can be ranked for it.
    const [providerChoice, setProviderChoice] = useState(null);
    const wirable = useWirableTypes(providers);

    const goBack = useCallback(() => {
        if (intent === "provider" && providerChoice) {
            // From provider-detail → back to provider picker, not all
            // the way to intent picker. One level at a time is more
            // forgiving for accidental picks.
            setProviderChoice(null);
            return;
        }
        setIntent(null);
        setProviderChoice(null);
    }, [intent, providerChoice]);

    const currentIntent =
        intent && INTENTS.find((i) => i.id === intent) ? intent : null;
    const intentObj = currentIntent
        ? INTENTS.find((i) => i.id === currentIntent)
        : null;
    // Phase C: when the user picked a provider (provider-intent
    // branch), `getSampleLayoutsForIntent` ranks flavored starters
    // first. Passing through is a no-op for non-provider intents
    // since `providerChoice` is null in those branches.
    const intentSamples = currentIntent
        ? getSampleLayoutsForIntent(currentIntent, providerChoice)
        : [];

    const applySample = useCallback(
        (layout) => {
            const grid = layout.buildGrid();
            onApplyGrid(grid, providerChoice);
        },
        [onApplyGrid, providerChoice]
    );

    return (
        <div
            className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4"
            data-testid="composer-quick-start"
        >
            {!currentIntent ? (
                <IntentPicker onPick={setIntent} />
            ) : currentIntent === "provider" && !providerChoice ? (
                <ProviderPicker
                    intentObj={intentObj}
                    wirable={wirable}
                    onPick={(p) => setProviderChoice(p)}
                    onBack={goBack}
                />
            ) : (
                <IntentDetail
                    intentObj={intentObj}
                    samples={intentSamples}
                    providerChoice={providerChoice}
                    onBack={goBack}
                    onApplySample={applySample}
                />
            )}

            {/* Escape hatch — drop into the palette on the seed cell.
                Always visible so the user can bail at any step. */}
            <div className={`pt-4 border-t ${bt.border}`}>
                <Button2
                    block
                    size="sm"
                    onClick={() => seedCellId && onRequestPalette(seedCellId)}
                    disabled={!seedCellId}
                    testId="composer-quick-start-scratch"
                    title="Or start blank — pick a single component"
                />
            </div>
            {typeof onAskDashTeam === "function" && (
                <AskDashTeam
                    key={currentIntent || "start"}
                    onAsk={onAskDashTeam}
                    withText={!!currentIntent}
                />
            )}
        </div>
    );
}

// One step's heading: what this step is, a sentence under it, and Change
// (back to the previous step) on the right.
function StepHeader({ icon = null, title, tagline = null, onBack = null }) {
    const bt = useBuilderTheme();
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
                <h2
                    className={`flex items-center gap-2 text-base font-semibold ${bt.text}`}
                >
                    {icon ? (
                        <FontAwesomeIcon
                            icon={icon}
                            className={`h-4 w-4 shrink-0 ${bt.accent}`}
                        />
                    ) : null}
                    <span className="truncate">{title}</span>
                </h2>
                {tagline ? (
                    <p className={`text-sm leading-snug ${bt.muted}`}>
                        {tagline}
                    </p>
                ) : null}
            </div>
            {onBack ? (
                <Button3
                    size="sm"
                    onClick={onBack}
                    testId="composer-quick-start-back"
                    className="shrink-0"
                >
                    <span className="flex items-center gap-2">
                        <FontAwesomeIcon
                            icon="arrow-left"
                            className="h-3 w-3"
                        />
                        Change
                    </span>
                </Button3>
            ) : null}
        </div>
    );
}

function ProviderPicker({ intentObj, wirable, onPick, onBack }) {
    const bt = useBuilderTheme();
    return (
        <div
            data-testid="composer-quick-start-providers"
            className="flex flex-col gap-3"
        >
            <StepHeader
                icon={intentObj.icon}
                title="Pick a service"
                tagline="The widget is set up around this service's common tools. You choose the exact ones after."
                onBack={onBack}
            />
            {wirable.status === "loading" && wirable.types.length === 0 ? (
                <p className={`text-sm ${bt.muted}`}>
                    Loading the list of services…
                </p>
            ) : wirable.types.length === 0 ? (
                <EmptyState
                    title="No services available"
                    description={
                        wirable.error ||
                        "The catalog didn't load. Close the builder and try again."
                    }
                />
            ) : (
                <div
                    className="flex flex-col gap-0.5"
                    data-testid="composer-quick-start-providers-list"
                >
                    {wirable.types.map((t) => (
                        <ListRow
                            key={`${t.kind}:${t.id}`}
                            icon="plug"
                            title={t.name}
                            meta={
                                t.hasConfiguredInstance
                                    ? "Set up"
                                    : t.description || "Not set up yet"
                            }
                            onClick={() => onPick(t)}
                            testId={`composer-quick-start-provider-${t.id}-${t.kind}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function IntentPicker({ onPick }) {
    return (
        <div
            data-testid="composer-quick-start-intents"
            className="flex flex-col gap-3"
        >
            <StepHeader
                title="What kind of widget do you want?"
                tagline="Pick one to see starter layouts for it."
            />
            <div className="grid grid-cols-2 gap-3">
                {INTENTS.map((it) => (
                    <IntentCard key={it.id} intent={it} onPick={onPick} />
                ))}
            </div>
        </div>
    );
}

function IntentCard({ intent, onPick }) {
    const bt = useBuilderTheme();
    return (
        <Card2
            onClick={() => onPick(intent.id)}
            ariaLabel={intent.label}
            testId={`composer-quick-start-intent-${intent.id}`}
            padding="p-3"
            hover
            className="flex flex-col gap-2 text-left"
        >
            <FontAwesomeIcon
                icon={intent.icon}
                className={`h-4 w-4 ${bt.accent}`}
            />
            <span className={`text-sm font-semibold ${bt.text}`}>
                {intent.label}
            </span>
            <span className={`text-xs leading-snug ${bt.muted}`}>
                {intent.tagline}
            </span>
        </Card2>
    );
}

function IntentDetail({
    intentObj,
    samples,
    providerChoice,
    onBack,
    onApplySample,
}) {
    const bt = useBuilderTheme();
    // When the user is in the provider branch and has picked a
    // provider, show that provider in the header instead of the
    // generic intent label/tagline.
    const headerLabel = providerChoice
        ? providerChoice.name
        : `${intentObj.label} widget`;
    const headerTagline = providerChoice
        ? providerChoice.description ||
          `Widget that uses the ${providerChoice.name} provider.`
        : intentObj.tagline;
    return (
        <div
            data-testid={`composer-quick-start-detail-${intentObj.id}`}
            className="flex flex-col gap-4"
        >
            <StepHeader
                icon={intentObj.icon}
                title={headerLabel}
                tagline={headerTagline}
                onBack={onBack}
            />

            {samples.length > 0 && (
                <div
                    data-testid="composer-quick-start-samples"
                    className="flex flex-col gap-2"
                >
                    <h3 className={`text-sm font-semibold ${bt.text}`}>
                        Starter layouts
                    </h3>
                    {samples.map((layout) => (
                        <Card2
                            key={layout.id}
                            onClick={() => onApplySample(layout)}
                            ariaLabel={layout.label}
                            testId={`composer-quick-start-sample-${layout.id}`}
                            padding="p-3"
                            hover
                            className="flex flex-col gap-1 text-left"
                        >
                            <span
                                className={`text-sm font-semibold ${bt.text}`}
                            >
                                {layout.label}
                            </span>
                            <span
                                className={`text-sm leading-snug ${bt.muted}`}
                            >
                                {layout.description}
                            </span>
                            <span
                                className={`text-xs ${bt.muted} font-mono whitespace-pre mt-2 pt-2 border-t ${bt.border}`}
                            >
                                {layout.outline}
                            </span>
                        </Card2>
                    ))}
                </div>
            )}
        </div>
    );
}

// Compose's door to the Dash team (consolidation Phase 3b): the builder
// has no AI of its own, so describing a widget hands it to Create. The first
// step offers the link; a kind's step takes the description too.
function AskDashTeam({ onAsk, withText }) {
    const bt = useBuilderTheme();
    const [text, setText] = useState("");
    if (!withText) {
        return (
            <Button3
                size="sm"
                onClick={() => onAsk("")}
                testId="composer-quick-start-ask-team"
            >
                <span className="flex items-center gap-2">
                    Rather describe it? Ask the Dash team
                    <FontAwesomeIcon icon="arrow-right" className="h-3 w-3" />
                </span>
            </Button3>
        );
    }
    return (
        <div
            className="flex flex-col gap-2"
            data-testid="composer-quick-start-ask-team-form"
        >
            <h3 className={`text-sm font-semibold ${bt.text}`}>
                Rather describe it?
            </h3>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g., A lookup box for order numbers that shows the order's status"
                aria-label="Describe the widget for the Dash team"
                rows={3}
                className={`dr-input w-full px-3 py-2 text-sm ${bt.surface} border ${bt.border} rounded-lg ${bt.text} resize-none focus:outline-none`}
                data-testid="composer-quick-start-ask-team-input"
            />
            <Button2
                size="sm"
                onClick={() => onAsk(text.trim())}
                testId="composer-quick-start-ask-team"
            >
                <span className="flex items-center gap-2">
                    Ask the Dash team
                    <FontAwesomeIcon icon="arrow-right" className="h-3 w-3" />
                </span>
            </Button2>
        </div>
    );
}
