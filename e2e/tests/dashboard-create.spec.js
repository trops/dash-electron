const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Dashboard create — End-to-End
 *
 * Walks the "create blank dashboard" flow from the sidebar through the
 * 4-step wizard (Name → Choose Layout → Organize → Choose Theme), then
 * confirms the dashboard lands in the sidebar.
 *
 * Selectors derived from `node scripts/explore-ui.js --to newDashboard`
 * and `--to newDashboard.blank` — see those snapshots if anything in
 * this spec drifts.
 */

let electronApp;
let window;
let tempUserData;

const DASHBOARD_NAME = "E2E Smoke Dashboard";

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("create blank dashboard via sidebar wizard", async () => {
    await test.step("open the New Dashboard dialog from the sidebar", async () => {
        await window
            .locator("aside")
            .getByText("New Dashboard", { exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);
        await expect(
            window.getByRole("dialog").getByText("New Dashboard").first()
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("pick the blank-template option", async () => {
        await window
            .getByRole("button", { name: /New Dashboard.*blank template/ })
            .click();
        await window.waitForTimeout(500);
        await expect(
            window.getByText("Give your new dashboard a name.")
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("step 1: name the dashboard, advance", async () => {
        const nameInput = window.getByRole("textbox", {
            name: "Dashboard name",
        });
        await nameInput.fill(DASHBOARD_NAME);
        // Next becomes enabled once a name is entered.
        const next = window.getByRole("button", { name: "Next", exact: true });
        await expect(next).toBeEnabled({ timeout: 3000 });
        await next.click();
        await window.waitForTimeout(500);
    });

    await test.step("step 2: accept default layout, advance", async () => {
        // The Choose Layout step lists templates — accept whatever's
        // first. If the wizard pre-selects a default, Next is already
        // enabled; otherwise click the first layout card.
        let next = window.getByRole("button", { name: "Next", exact: true });
        if (!(await next.isEnabled().catch(() => false))) {
            // Click the first available layout card to enable Next.
            // We don't know exact text; pick the first non-Back/non-Next
            // dialog button as a layout option.
            const dialogButtons = window
                .getByRole("dialog")
                .getByRole("button");
            const count = await dialogButtons.count();
            for (let i = 0; i < count; i++) {
                const btn = dialogButtons.nth(i);
                const txt = (await btn.textContent()) || "";
                if (
                    !/Back|Next|Cancel|Done|^\d$/.test(txt.trim()) &&
                    (await btn.isEnabled().catch(() => false))
                ) {
                    await btn.click();
                    break;
                }
            }
            await window.waitForTimeout(300);
            next = window.getByRole("button", { name: "Next", exact: true });
        }
        await expect(next).toBeEnabled({ timeout: 3000 });
        await next.click();
        await window.waitForTimeout(500);
    });

    await test.step("step 3: accept default folder, advance", async () => {
        // Folder step. Hermetic launch means no folders exist yet —
        // the wizard either lets us proceed without picking one, or
        // there's a "skip" / Uncategorized default.
        const next = window.getByRole("button", { name: "Next", exact: true });
        if (await next.isEnabled().catch(() => false)) {
            await next.click();
        } else {
            // Try clicking a "Skip" or "Uncategorized" option.
            const skip = window.getByText(/Skip|Uncategorized/i).first();
            if (await skip.isVisible().catch(() => false)) {
                await skip.click();
                await window.waitForTimeout(300);
                await next.click();
            }
        }
        await window.waitForTimeout(500);
    });

    await test.step("step 4: accept default theme, finish", async () => {
        // Final step. The "Next" button likely becomes "Create" or
        // "Done"; Try both.
        const finishBtn = window
            .getByRole("button", { name: /Create|Done|Finish/i })
            .first();
        if (await finishBtn.isVisible().catch(() => false)) {
            await finishBtn.click();
        } else {
            await window
                .getByRole("button", { name: "Next", exact: true })
                .click();
        }
        await window.waitForTimeout(1500);
    });

    await test.step("save the new dashboard from edit mode", async () => {
        // The wizard drops us into the layout-builder edit mode with
        // a Save button at the top. Clicking Save commits the new
        // dashboard and exits edit mode.
        const save = window.getByRole("button", { name: "Save", exact: true });
        await expect(save).toBeVisible({ timeout: 5000 });
        await save.click();
        await window.waitForTimeout(1500);
    });

    await test.step("dashboard appears in the sidebar", async () => {
        // Sidebar may be collapsed after save; expand it if needed.
        const expand = window.getByRole("button", {
            name: "Expand sidebar",
            exact: true,
        });
        if (await expand.isVisible().catch(() => false)) {
            await expand.click();
            await window.waitForTimeout(500);
        }
        await expect(
            window
                .locator("aside")
                .getByText(DASHBOARD_NAME, { exact: true })
                .first()
        ).toBeVisible({ timeout: 5000 });
    });
});
