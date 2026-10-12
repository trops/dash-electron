/**
 * The main process's copy of the Widget Builder's checks
 * (public/lib/widgetChecks.cjs, generated) gives the same answers as the
 * renderer's — the Dash team's Checker and the Widget Builder agree.
 */
import {
    validateProviderApiUsage,
    validateNoModalUsage,
    validateNoBotCalls,
    validateComponentReferences,
} from "./widgetCodeValidator";
import { evaluateScorecard } from "./composer/scorecardChecks";
import { getKnownToolsForType } from "./composer/mcpKnownTools";

const generated = require("../../public/lib/widgetChecks.cjs");

const SAMPLES = [
    "export default function D() { window.mainApi.bots.run('b'); return null; }",
    `import { Panel, Heading } from "@trops/dash-react";
export default function A() { return <Panel><Heading title="x" /></Panel>; }`,
    `import { Modal, Bogus } from "@trops/dash-react";
export default function B() { window.mainApi.gmail.nope(); return <Modal><Bogus /></Modal>; }`,
    `import { useMcpProvider } from "@trops/dash-core";
export default function C() { const { callTool } = useMcpProvider("gmail"); return <div className="bg-gray-800">loading</div>; }`,
];

describe("widgetChecks.cjs matches src/AiAssistant", () => {
    test.each(SAMPLES.map((s, i) => [i, s]))("sample %i", (_i, code) => {
        expect(generated.validateProviderApiUsage(code)).toEqual(
            validateProviderApiUsage(code)
        );
        expect(generated.validateNoModalUsage(code)).toEqual(
            validateNoModalUsage(code)
        );
        expect(generated.validateNoBotCalls(code)).toEqual(
            validateNoBotCalls(code)
        );
        expect(generated.validateComponentReferences(code)).toEqual(
            validateComponentReferences(code)
        );
        expect(generated.evaluateScorecard(code)).toEqual(
            evaluateScorecard(code)
        );
    });

    test("known tool names", () => {
        expect(generated.getKnownToolsForType("gmail")).toEqual(
            getKnownToolsForType("gmail")
        );
    });
});
