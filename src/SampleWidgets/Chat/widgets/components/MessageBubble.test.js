/**
 * Chat widget MessageBubble — assistant Markdown goes through dash-core's
 * sanitizer (renderSafeMarkdown). On an older app without it, the reply is
 * shown as plain text — never as unsanitized HTML.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

const mockRender = jest.fn(
    (t) => `<p class="safe">${t.replace(/</g, "&lt;")}</p>`
);
let mockHasSanitizer = true;

jest.mock("@trops/dash-core", () => ({
    get renderSafeMarkdown() {
        return mockHasSanitizer ? mockRender : undefined;
    },
}));

const { MessageBubble } = require("./MessageBubble");
const fs = require("fs");
const path = require("path");

const assistant = (text) => ({ role: "assistant", content: text });

// CRA's jest config resets mock implementations before each test.
beforeEach(() => {
    mockRender.mockImplementation(
        (t) => `<p class="safe">${t.replace(/</g, "&lt;")}</p>`
    );
});

afterEach(() => {
    mockHasSanitizer = true;
    mockRender.mockClear();
});

test("renders assistant Markdown through dash-core's sanitizer", () => {
    const { container } = render(
        <MessageBubble message={assistant("**hi** <img onerror=x>")} />
    );
    expect(mockRender).toHaveBeenCalledWith("**hi** <img onerror=x>");
    expect(container.querySelector("p.safe")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
});

test("without the sanitizer (older app), shows plain text — never HTML", () => {
    mockHasSanitizer = false;
    const { container } = render(
        <MessageBubble
            message={assistant('<img src="x" onerror="window.__pwned=1">')}
        />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent(
        '<img src="x" onerror="window.__pwned=1">'
    );
});

test("no longer converts Markdown with marked directly", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "MessageBubble.js"),
        "utf8"
    );
    expect(src).not.toMatch(/from "marked"/);
});
