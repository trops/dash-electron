/**
 * @jest-environment jsdom
 *
 * The preview iframe shell reports a widget that throws while it renders.
 * The widget renders with the host's React, so its error is raised in the
 * host window and the iframe's window "error" listener never hears it — the
 * preview sat on "Preview ready." with no error (seen live, 2026-10-29). A
 * boundary around the widget posts it to the host as a bridge:error.
 *
 * The shell is a plain script in public/; this loads the boundary from
 * between its markers and renders through it.
 */
const fs = require("fs");
const path = require("path");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { act } = require("react-dom/test-utils");

const shell = fs.readFileSync(
    path.join(__dirname, "..", "..", "public", "widget-preview-shell.js"),
    "utf8"
);
const match = shell.match(
    /\/\/ BEGIN errorBoundaryFor\n([\s\S]*?)\/\/ END errorBoundaryFor/
);

function load(postErrorToHost) {
    // eslint-disable-next-line no-new-func
    return new Function(
        "reportRenderError",
        `${match[1]}; return errorBoundaryFor;`
    )((error) => postErrorToHost("render", error && error.message));
}

describe("preview shell — a widget that throws while rendering", () => {
    it("wraps every widget it mounts, and renders it at once after mounted", () => {
        expect(match).toBeTruthy();
        expect(shell).toMatch(/createElement\(\s*errorBoundaryFor\(React\)/);
        expect(shell).toMatch(
            /ReactDOM\.flushSync\(function \(\) \{\s*renderWith/
        );
        // Mounted first: the host clears an earlier error on mounted.
        expect(shell.indexOf('postToHost("bridge:mounted"')).toBeLessThan(
            shell.indexOf("ReactDOM.flushSync(")
        );
    });

    it("reports the error to the host and renders nothing", () => {
        const posted = [];
        const errorBoundaryFor = load((kind, message) =>
            posted.push({ kind, message })
        );
        const Boundary = errorBoundaryFor(React);
        // As the Coin Flip widget did: a component that's undefined.
        const Missing = undefined;
        const Broken = () => React.createElement(Missing);
        const el = document.createElement("div");
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        act(() => {
            createRoot(el).render(
                React.createElement(Boundary, null, React.createElement(Broken))
            );
        });
        spy.mockRestore();
        expect(posted).toHaveLength(1);
        expect(posted[0].kind).toBe("render");
        expect(posted[0].message).toMatch(/Element type is invalid/);
        expect(el.innerHTML).toBe("");
    });

    it("leaves a working widget alone, and is made once per React", () => {
        const posted = [];
        const errorBoundaryFor = load((kind, message) =>
            posted.push({ kind, message })
        );
        expect(errorBoundaryFor(React)).toBe(errorBoundaryFor(React));
        const el = document.createElement("div");
        act(() => {
            createRoot(el).render(
                React.createElement(
                    errorBoundaryFor(React),
                    null,
                    React.createElement("span", null, "Heads")
                )
            );
        });
        expect(el.textContent).toBe("Heads");
        expect(posted).toEqual([]);
    });

    it("a later render (new props) tries the widget again", () => {
        const posted = [];
        const errorBoundaryFor = load((kind, message) =>
            posted.push({ kind, message })
        );
        const Boundary = errorBoundaryFor(React);
        const Flaky = ({ ok }) => {
            if (!ok) throw new Error("needs a setting");
            return React.createElement("span", null, "Fine now");
        };
        const el = document.createElement("div");
        const root = createRoot(el);
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        act(() => {
            root.render(
                React.createElement(
                    Boundary,
                    { resetKey: 1 },
                    React.createElement(Flaky, { ok: false })
                )
            );
        });
        spy.mockRestore();
        expect(posted).toHaveLength(1);
        expect(el.textContent).toBe("");
        act(() => {
            root.render(
                React.createElement(
                    Boundary,
                    { resetKey: 2 },
                    React.createElement(Flaky, { ok: true })
                )
            );
        });
        expect(el.textContent).toBe("Fine now");
        expect(posted).toHaveLength(1);
    });
});
