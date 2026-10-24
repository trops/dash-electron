/**
 * jitConsentText.test.js
 *
 * A widget's own data file isn't shown by its internal-id filename
 * (QA 2026-10-24).
 *
 * Run via `node --test src/AiAssistant/jitConsentText.test.js`.
 */

const test = require("node:test");
const assert = require("node:assert");

const {
    fsFileLabel,
    widgetDisplayName,
    fileNameParts,
} = require("./jitConsentText");

const NOTEPAD = "trops.dash-samples.NotepadWidget";

test("the widget's own file reads as its saved data", () => {
    assert.deepStrictEqual(fsFileLabel(`${NOTEPAD}-${NOTEPAD}.json`, NOTEPAD), {
        text: "this widget's own saved data",
        ownFile: true,
    });
    assert.deepStrictEqual(fsFileLabel(`7-${NOTEPAD}-2.json`, NOTEPAD), {
        text: "this widget's own saved data",
        ownFile: true,
    });
});

test("any other file shows its name", () => {
    assert.deepStrictEqual(fsFileLabel("notes.json", NOTEPAD), {
        text: "notes.json",
        ownFile: false,
    });
    assert.deepStrictEqual(fsFileLabel(`trops.other.Thing-1.json`, NOTEPAD), {
        text: "trops.other.Thing-1.json",
        ownFile: false,
    });
});

test("no filename, or no widget id", () => {
    assert.deepStrictEqual(fsFileLabel(undefined, NOTEPAD), {
        text: "(unknown file)",
        ownFile: false,
    });
    assert.deepStrictEqual(fsFileLabel("a.json", ""), {
        text: "a.json",
        ownFile: false,
    });
});

test("a name that only contains the id isn't labelled its own", () => {
    for (const name of [
        `../../${NOTEPAD}.json`,
        `sub/${NOTEPAD}-1.json`,
        `..\\${NOTEPAD}.json`,
        `${NOTEPAD}-1.json.exe`,
        `secret ${NOTEPAD}.json`,
        `x${NOTEPAD}.json`,
    ]) {
        assert.deepStrictEqual(fsFileLabel(name, NOTEPAD), {
            text: name,
            ownFile: false,
        });
    }
});

// QA 2026-10-24: the heading said "NotepadWidget wants to…".
test("the heading names the widget as people see it", () => {
    const notepad = {
        name: "NotepadWidget",
        displayName: "NotepadWidget",
        userConfig: { title: { defaultValue: "Notepad" } },
    };
    assert.equal(widgetDisplayName(NOTEPAD, notepad), "Notepad");
    assert.equal(
        widgetDisplayName("trops.gdrive.GDriveFileList", {
            name: "Drive Files",
        }),
        "Drive Files"
    );
    // No config, or one that only repeats the code name: split it.
    assert.equal(widgetDisplayName(NOTEPAD, null), "Notepad");
    assert.equal(
        widgetDisplayName("trops.gdrive.GDriveFileList", {
            name: "My Workspace",
        }),
        "G Drive File List"
    );
    assert.equal(widgetDisplayName("trops.x.Widget", null), "Widget");
    assert.equal(widgetDisplayName("", null), "This widget");
});

test("a long file name breaks after . and - only", () => {
    const parts = fileNameParts("1792-trops.dash-samples.NotepadWidget-2.json");
    assert.equal(
        parts.join(""),
        "1792-trops.dash-samples.NotepadWidget-2.json"
    );
    assert.deepStrictEqual(parts, [
        "1792-",
        "trops.",
        "dash-",
        "samples.",
        "NotepadWidget-",
        "2.",
        "json",
    ]);
});
