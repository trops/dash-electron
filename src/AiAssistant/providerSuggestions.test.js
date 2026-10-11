import { suggestProviderTypes } from "./providerSuggestions";

const OPTIONS = [
    { type: "algolia", providerClass: "credential" },
    { type: "filesystem", providerClass: "mcp" },
    { type: "github", providerClass: "mcp" },
    { type: "gmail", providerClass: "mcp" },
    { type: "google-calendar", providerClass: "mcp" },
    { type: "google-drive", providerClass: "mcp" },
    { type: "slack", providerClass: "mcp" },
];

const types = (prompt, opts) =>
    suggestProviderTypes(prompt, OPTIONS, opts).map((o) => o.type);

describe("suggestProviderTypes", () => {
    test("a type named in the prompt is suggested", () => {
        expect(types("Show my open GitHub PRs")).toEqual(["github"]);
        expect(types("Latest messages from Slack")).toEqual(["slack"]);
    });

    test("hyphenated types match as words", () => {
        expect(types("What's on my Google Calendar today")).toEqual([
            "google-calendar",
        ]);
    });

    test("common words point at a type", () => {
        expect(types("Count my unread email")).toEqual(["gmail"]);
        expect(types("Pull requests waiting for my review")).toEqual([
            "github",
        ]);
        expect(types("My meetings this week")).toEqual(["google-calendar"]);
    });

    test("a named type ranks above an alias match", () => {
        expect(types("Slack messages about my inbox")).toEqual([
            "slack",
            "gmail",
        ]);
    });

    test("installed types win ties", () => {
        expect(
            types("email and calendar", {
                installedTypes: new Set(["google-calendar"]),
            })
        ).toEqual(["google-calendar", "gmail"]);
    });

    test("nothing for a self-contained widget or an empty prompt", () => {
        expect(types("A clock that shows Tokyo and London time")).toEqual([]);
        expect(types("")).toEqual([]);
        expect(types(null)).toEqual([]);
    });

    test("words only match whole words", () => {
        // "prism" contains "pr"; "indexes" isn't "index".
        expect(types("A prism animation")).toEqual([]);
    });

    test("caps at the limit and lists each type once", () => {
        const many = types("email calendar slack github drive", { limit: 3 });
        expect(many).toHaveLength(3);
        const dup = suggestProviderTypes("github", [
            { type: "github", providerClass: "mcp" },
            { type: "github", providerClass: "credential" },
        ]);
        expect(dup).toHaveLength(1);
    });

    test("servers named after ordinary words aren't guessed", () => {
        const withGeneric = [
            ...OPTIONS,
            { type: "time", providerClass: "mcp", label: "Time" },
            { type: "memory", providerClass: "mcp" },
        ];
        expect(
            suggestProviderTypes(
                "A clock that shows the time; remember my memory",
                withGeneric
            )
        ).toEqual([]);
    });
});
