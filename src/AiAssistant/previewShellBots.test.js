/**
 * The preview iframe never lets a widget start a bot (team-dashboards
 * TD-005): `bots` is always a blocked namespace, whatever the widget
 * declares. Static check on the plain script in public/.
 */
const fs = require("fs");
const path = require("path");

const shell = fs.readFileSync(
    path.join(__dirname, "..", "..", "public", "widget-preview-shell.js"),
    "utf8"
);

test("bots is always blocked in previews, with its own message", () => {
    expect(shell).toMatch(
        /function shouldBlockNamespace\(namespaceName\) \{[\s\S]{0,200}if \(namespaceName === "bots"\) return true;/
    );
    expect(shell).toContain("widgets may not start bots — publish an event");
});
