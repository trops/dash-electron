/**
 * A widget that shows what a bot sends (team-dashboards TD-009) is
 * previewed with the bot's last message: the preview shell hands
 * widgetData.previewEvents to the widget's listeners, as a dashboard does
 * when it opens. Runs the shell's own code for it.
 */
const fs = require("fs");
const path = require("path");

const shell = fs.readFileSync(
    path.join(__dirname, "..", "..", "public", "widget-preview-shell.js"),
    "utf8"
);
const start = shell.indexOf("    var deliveredPreviewEvents = {};");
const end = shell.indexOf("    var stubDashboard = {");

// The shell's deliverPreviewEvents, with its widget data set from outside.
function load(widgetData) {
    // eslint-disable-next-line no-new-func
    return new Function(
        "currentWidgetData",
        `${shell.slice(start, end)}
        return {
            deliver: deliverPreviewEvents,
            reset: function () { deliveredPreviewEvents = {}; },
        };`
    )(widgetData);
}

const EVENT = "bot:local/shopping-helper[bot_shop].completed";
const message = { botId: "bot_shop", output: "- Oat milk" };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("the shell's code is found", () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(shell).toContain("registerListeners: deliverPreviewEvents,");
});

test("a listener gets the bot's last message, marked as a replay", () => {
    const { deliver } = load({ previewEvents: { [EVENT]: message } });
    const show = jest.fn();
    deliver(
        { showShoppingHelperAnswer: [EVENT] },
        { showShoppingHelperAnswer: show },
        "u1"
    );
    jest.runAllTimers();
    expect(show).toHaveBeenCalledWith({
        message,
        event: EVENT,
        uuid: "u1",
        replay: true,
    });
});

test("once per listener, until the widget data changes", () => {
    const shellCode = load({ previewEvents: { [EVENT]: message } });
    const show = jest.fn();
    const args = [{ show: [EVENT] }, { show }, "u1"];
    shellCode.deliver(...args);
    shellCode.deliver(...args);
    jest.runAllTimers();
    expect(show).toHaveBeenCalledTimes(1);
    shellCode.reset();
    shellCode.deliver(...args);
    jest.runAllTimers();
    expect(show).toHaveBeenCalledTimes(2);
});

test("nothing without a message, a handler or a matching event", () => {
    const show = jest.fn();
    load(null).deliver({ show: [EVENT] }, { show }, "u1");
    load({ previewEvents: { [EVENT]: message } }).deliver(
        { show: ["Other[1].clicked"] },
        { show },
        "u1"
    );
    load({ previewEvents: { [EVENT]: message } }).deliver(
        { missing: [EVENT] },
        { show },
        "u1"
    );
    jest.runAllTimers();
    expect(show).not.toHaveBeenCalled();
});

test("a listener that throws doesn't break the preview", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deliver } = load({ previewEvents: { [EVENT]: message } });
    deliver(
        { boom: [EVENT] },
        {
            boom: () => {
                throw new Error("x");
            },
        },
        "u1"
    );
    expect(() => jest.runAllTimers()).not.toThrow();
    spy.mockRestore();
});
