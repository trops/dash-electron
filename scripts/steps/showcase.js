// Wide showcase: resize to mockup width, expand sidebar, open a widget
// workspace, open the Bot Activity glass panel — to compare against the mockup.
module.exports = async function (page) {
    try {
        await page.setViewportSize({ width: 1460, height: 920 });
    } catch (e) {}
    await page.waitForTimeout(500);

    const tryClickText = async (label, exact = true) => {
        try {
            await page
                .getByText(label, { exact })
                .first()
                .click({ timeout: 3500 });
            return true;
        } catch (e) {
            return false;
        }
    };
    const tryClickSel = async (sel) => {
        try {
            await page.locator(sel).first().click({ timeout: 2500 });
            return true;
        } catch (e) {
            return false;
        }
    };

    // Expand the sidebar if collapsed (aria-label on the toggle button).
    await tryClickSel('[aria-label="Expand sidebar"]');
    await page.waitForTimeout(500);

    // Open a DARK workspace that has widgets. Try several; stop on the first
    // one that renders dark (data-mode dark AND body is near-black).
    const candidates = [
        "Programmatic Test",
        "React Event Test",
        "Test 3",
        "DashApi Test",
        "Slack Pack",
        "Algolia Test 1",
    ];
    let openedDark = null;
    for (const ws of candidates) {
        if (await tryClickText(ws)) {
            await page.waitForTimeout(2500);
            const mode = await page.evaluate(() => {
                const bg = getComputedStyle(document.body).backgroundColor;
                return {
                    dm: document.documentElement.getAttribute("data-mode"),
                    bg,
                    panels: document.querySelectorAll(".dr-panel,.dr-card")
                        .length,
                };
            });
            console.log("TRIED " + ws + " -> " + JSON.stringify(mode));
            if (mode.dm === "dark" && mode.panels > 0) {
                openedDark = ws;
                break;
            }
        }
    }
    console.log("OPENED_DARK " + openedDark);
    await page.waitForTimeout(1500);

    // Open the Bot Activity / assistant glass panel (robot icon on the right).
    await tryClickSel('[data-icon="robot"], [data-icon="robot-astromech"]');
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => {
        const g = document.querySelector(".chrome-glass");
        return {
            drPanel: document.querySelectorAll(".dr-panel").length,
            chromeGlass: document.querySelectorAll(".chrome-glass").length,
            chromeGlassBackdrop: g
                ? getComputedStyle(g).backdropFilter ||
                  getComputedStyle(g).webkitBackdropFilter
                : null,
        };
    });
    console.log("SHOWCASE " + JSON.stringify(info));
};
