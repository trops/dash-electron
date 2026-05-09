const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Widget Builder — REAL end-to-end (Claude CLI backend)
 *
 * Verifies slice 17b.6's CLI lockdown by driving the actual flow:
 *   1. Open the widget builder.
 *   2. Skip the provider gate (no-provider branch — same CLI flags
 *      apply to all three branches; we don't need to seed a provider
 *      to verify the lockdown). The CLI subprocess this launches
 *      uses `--system-prompt` (replace) + `--tools ""` per the new
 *      buildClaudeCliArgs helper in dash-core.
 *   3. Send a build message.
 *   4. Wait for the AI to respond.
 *   5. Assert the chat does NOT contain any of:
 *        - "Skill via Claude Code"
 *        - "Bash via Claude Code"
 *        - "Read via Claude Code"
 *        - "Glob via Claude Code"
 *
 * If those tool-call indicators appear, the lockdown failed and we
 * have more work. If not, the fix is verified end-to-end.
 *
 * Cost: this spawns a real Claude CLI subprocess and consumes a
 * small amount of API tokens. Worth it — we've been chasing this
 * by hand for hours.
 */

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

// Bumped above the playwright config's default 60s — the real
// CLI subprocess can take 25s+ to respond, plus waitForTimeout
// + setup steps push us over the default budget.
test.setTimeout(180000);

test("CLI-backed build flow does not invoke Skill / Bash / Read / Glob tools", async () => {
    const consoleErrors = [];
    window.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await test.step("app reaches steady state", async () => {
        await window.waitForTimeout(2000);
    });

    await test.step("dispatch dash:open-widget-builder", async () => {
        await window.evaluate(() => {
            window.dispatchEvent(new CustomEvent("dash:open-widget-builder"));
        });
        await expect(
            window.locator('[data-testid="widget-builder-modal"]')
        ).toBeAttached({ timeout: 10000 });
    });

    await test.step("skip the provider (no-provider branch)", async () => {
        // The CLI lockdown flags apply to all three prompt branches,
        // so picking "skip the provider" still spawns the CLI with
        // --system-prompt + --tools "". This avoids needing to seed
        // an encrypted credential provider into hermetic user-data,
        // which fails for safeStorage reasons inside Playwright.
        const skipBtn = window
            .locator("button", { hasText: /no external provider/i })
            .first();
        await expect(skipBtn).toBeVisible({ timeout: 10000 });
        await skipBtn.click();
        // Confirmation: the gate dismisses and the chat input becomes
        // available.
        await expect(
            window.getByRole("textbox", { name: /type a message/i })
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("send a build message", async () => {
        const input = window.getByRole("textbox", {
            name: /type a message/i,
        });
        await input.fill("build a tiny clock widget — keep it self-contained");
        await window.getByRole("button", { name: "Send", exact: true }).click();
    });

    await test.step("wait for the AI response (~45s budget for real CLI call)", async () => {
        // Real CLI calls take 5–25s. Generous timeout because we're
        // not racing the AI here — we want to see whatever it ends
        // up doing (including any tool calls).
        await window.waitForTimeout(45000);
    });

    await test.step("forensics: screenshot + dump modal text", async () => {
        const path = "/tmp/widget-builder-cli-flow.png";
        await window.screenshot({ path, fullPage: false });
        console.log("[forensics] screenshot:", path);

        const modalText = await window
            .locator('[data-testid="widget-builder-modal"]')
            .first()
            .textContent({ timeout: 5000 })
            .catch(() => "");
        console.log("[forensics] modal text length:", modalText?.length);
        console.log(
            "[forensics] modal text (first 3000 chars):",
            modalText?.slice(0, 3000)
        );
    });

    await test.step("assert: no Skill / Bash / Read / Glob tool calls fire", async () => {
        const modalText = await window
            .locator('[data-testid="widget-builder-modal"]')
            .first()
            .textContent({ timeout: 5000 })
            .catch(() => "");

        const forbiddenTools = ["Skill", "Bash", "Read", "Glob"];
        const found = forbiddenTools.filter((t) =>
            new RegExp(`${t}\\s*via Claude Code`, "i").test(modalText)
        );

        if (found.length > 0) {
            console.log("[ASSERT FAILED] forbidden tools found:", found);
            console.log("[ASSERT FAILED] full modal text:", modalText);
        }
        expect(found).toEqual([]);
    });

    await test.step("report any console errors", async () => {
        console.log(
            "[console] errors fired during test:",
            consoleErrors.length
        );
        consoleErrors
            .slice(0, 10)
            .forEach((e) => console.log("[console.error]", e.slice(0, 300)));
    });
});
