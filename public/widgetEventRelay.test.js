/**
 * Static pin: the widget-event relay hands the publishing dashboard
 * (workspaceId) to the Bot Factory dispatcher, so a bot subscribed to one
 * dashboard's widget doesn't fire for a copy of that dashboard (copies reuse
 * widget ids → identical eventType strings).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "electron.js"), "utf8");

describe("widget-event relay → botController.handleEvent", () => {
    it("forwards the event's workspaceId to the bot dispatcher", () => {
        const call = src.match(/botController\.handleEvent\(\{[\s\S]*?\}\)/);
        assert.ok(call, "botController.handleEvent({...}) call not found");
        assert.match(call[0], /eventType:\s*message\.eventType/);
        assert.match(call[0], /workspaceId:\s*message\.workspaceId/);
    });
});
