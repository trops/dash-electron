/**
 * Pins the AI Widget Builder's guidance — which now lives in the project's
 * dash-widget-builder skill (.claude/skills/dash-widget-builder/), auto-loaded
 * by the builder's claude session, instead of a ~1000-line system prompt
 * inlined in WidgetBuilderModal (slice 19B; see widgetBuilderPrompt.js).
 *
 * These replace the old prompt-source pins (WidgetBuilderModal.events /
 * .scheduler / .theme / .mcp-tools-gate and parts of .prompt) so the same
 * guarantees keep holding where the guidance actually is. Static
 * source-presence checks — anchor on a section, assert the key tokens.
 */
const fs = require("fs");
const path = require("path");

const SKILL_DIR = path.join(
    __dirname,
    "..",
    "..",
    ".claude",
    "skills",
    "dash-widget-builder"
);
const skill = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8");
const dashReactRef = fs.readFileSync(
    path.join(SKILL_DIR, "references", "dash-react-components.md"),
    "utf8"
);

/** The text of a `## Heading` section, up to the next `## `. */
function section(heading) {
    const start = skill.indexOf(`\n## ${heading}`);
    if (start < 0) return null;
    const next = skill.indexOf("\n## ", start + 1);
    return skill.slice(start, next > 0 ? next : undefined);
}

describe("dash-widget-builder skill — cross-widget events", () => {
    const events = section("Cross-Widget Events");

    test("has an events section", () => {
        expect(events).toBeTruthy();
    });

    test('teaches the useWidgetEvents() hook with publishEvent("name", …)', () => {
        expect(events).toMatch(/useWidgetEvents/);
        expect(events).toMatch(/publishEvent\s*\(\s*["']/);
        // The hook wraps the low-level dispatch — don't teach that.
        expect(events).not.toMatch(/window\.dispatchEvent\s*\(/);
    });

    test("event names are camelCase", () => {
        expect(events).toMatch(/camelCase/);
        expect(events).toMatch(/itemSelected/);
    });

    test("events are declared in .dash.js as a plain string array", () => {
        expect(events).toMatch(/events:\s*\[\s*"[a-zA-Z]+"/);
        expect(events).toMatch(/array of \*\*strings\*\*/);
    });

    test("tells the AI to report published events to the user", () => {
        expect(events).toMatch(/### Tell the user/);
    });

    test("teaches reacting to bots: completed/failed payloads, unwrapped", () => {
        expect(events).toMatch(/### Listening to bots/);
        // Bots publish bot:<ref>[<botId>].<event> on the same bus.
        expect(events).toMatch(/bot:<ref>\[<botId>\]/);
        expect(events).toMatch(/completed/);
        expect(events).toMatch(/failed/);
        // The fields a widget reads off the unwrapped payload.
        expect(events).toMatch(/payload\.output/);
        expect(events).toMatch(/payload\.error/);
        expect(events).toMatch(/botName/);
        // Wired by the user in Listeners — not hardcoded in the widget.
        expect(events).toMatch(/Listeners/);
    });

    test("teaches showing a bot's results (team-dashboards TD-003)", () => {
        expect(events).toMatch(/### Showing a bot's results/);
        expect(events).toMatch(/result\.<name>/);
        // The payload a results widget reads.
        expect(events).toMatch(/payload\.items/);
        expect(events).toMatch(/summary/);
        // A widget opened later gets the saved result as a replay.
        expect(events).toMatch(/envelope\.replay === true/);
        // Outside text: plain text only, links through openExternal.
        expect(events).toMatch(/never `dangerouslySetInnerHTML`/);
        expect(events).toMatch(/mainApi\.shell\.openExternal\(item\.link\)/);
    });
});

describe("dash-widget-builder skill — scheduled tasks", () => {
    const tasks = section("Scheduled Tasks");

    test("teaches the useScheduler hook", () => {
        expect(tasks).toBeTruthy();
        expect(tasks).toMatch(/useScheduler\s*\(/);
    });

    test("shows the scheduledTasks: [ … ] declaration shape", () => {
        expect(tasks).toMatch(/scheduledTasks:\s*\[/);
        expect(tasks).toMatch(/key:\s*"\w+",\s*handler:/);
    });

    test("tells the AI to report added tasks to the user", () => {
        expect(tasks).toMatch(/### Tell the user/);
    });
});

describe("dash-widget-builder skill — MCP gate includes tools.length", () => {
    // useMcpProvider's isConnected can flip true before the server's tool
    // list arrives; gating only on isConnected calls an empty registry.
    test("the MCP example gates on BOTH isConnected and tools.length", () => {
        expect(skill).toMatch(
            /if \(!isConnected \|\| tools\.length === 0\) return;/
        );
    });

    test("explains the isConnected → tools race", () => {
        expect(skill).toMatch(/Gate on BOTH isConnected AND tools\.length/);
        expect(skill).toMatch(/before the server's tools list is loaded/);
    });

    test("no example bails on isConnected alone", () => {
        expect(skill).not.toMatch(/if \(!isConnected\) return;/);
    });
});

describe("dash-widget-builder skill — single-purpose widgets", () => {
    const rules = section("Single-Purpose Widget Rule");

    test("forbids Modal, Dialog and Drawer inside a widget", () => {
        expect(rules).toBeTruthy();
        expect(rules).toMatch(/<Modal>/);
        expect(rules).toMatch(/<Dialog>/);
        expect(rules).toMatch(/<Drawer>/);
    });

    test("teaches the inline <Card> alternative", () => {
        expect(rules).toMatch(/INLINE/);
        expect(rules).toMatch(/<Card>/);
    });

    test("teaches cross-widget coordination via useWidgetEvents", () => {
        expect(rules).toMatch(/useWidgetEvents/);
    });
});

describe("dash-widget-builder skill — credential example is hooks-first", () => {
    // Rules of Hooks: every hook runs before the "no provider" early return.
    const start = skill.indexOf("### Widget with Credentialed IPC");
    const example = skill.slice(
        start,
        skill.indexOf("### Widget .dash.js Configuration", start)
    );
    const earlyReturn = example.indexOf('if (!hasProvider("algolia"))');

    test("the example exists and has the early return", () => {
        expect(start).toBeGreaterThan(-1);
        expect(earlyReturn).toBeGreaterThan(-1);
    });

    test("useProviderClient and useEffect run before the early return", () => {
        const pc = example.indexOf("useProviderClient(provider)");
        const effect = example.indexOf("useEffect(");
        expect(pc).toBeGreaterThan(-1);
        expect(effect).toBeGreaterThan(-1);
        expect(pc).toBeLessThan(earlyReturn);
        expect(effect).toBeLessThan(earlyReturn);
    });

    test("bails inside the effect, not above it", () => {
        expect(example).toMatch(/if \(!pc\?\.providerHash\) return;/);
    });
});

describe("dash-widget-builder skill — dash-react prop names", () => {
    test("Heading, Button and EmptyState use title (not text / message)", () => {
        expect(dashReactRef).toMatch(/<Heading title="\.\.\."/);
        expect(dashReactRef).toMatch(/<Button title="\.\.\."/);
        expect(dashReactRef).toMatch(/<EmptyState title="\.\.\."/);
        expect(dashReactRef).toMatch(/NEVER `text=`/);
        expect(dashReactRef).toMatch(/NEVER `message=`/);
    });
});

describe("dash-widget-builder skill — color comes from the theme", () => {
    // The old prompt taught raw `currentTheme[key] || fallback`; the skill
    // replaced that with a stricter rule: no Tailwind color classes at all,
    // color only through dash-react primitives that read ThemeContext.
    const color = section("Color Rule");

    test("forbids Tailwind color utility classes", () => {
        expect(color).toBeTruthy();
        expect(color).toMatch(/No widget code may use Tailwind color/);
    });

    test("delivers color through dash-react primitives reading ThemeContext", () => {
        expect(color).toMatch(/@trops\/dash-react/);
        expect(color).toMatch(/ThemeContext/);
    });
});

describe("dash-widget-builder skill — readable error text", () => {
    test("errors go through dash-react readableError, never raw err.message", () => {
        expect(skill).toMatch(/readableError\(value, "fallback"\)/);
        expect(skill).toMatch(
            /Never\s+render `err\.message` or `JSON\.stringify\(err\)` directly/
        );
    });
});
