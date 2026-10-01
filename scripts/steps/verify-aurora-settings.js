// Open Settings (dense with dash-react primitives) and verify the Aurora
// treatment is actually applied to real components, then the script screenshots.
module.exports = async function (page) {
    // Open the user menu → Settings
    try {
        await page
            .locator(
                'button:has([data-icon="circle-user"], [data-icon="user"])'
            )
            .first()
            .click();
        await page.waitForTimeout(700);
        await page.getByText("Settings", { exact: true }).first().click();
        await page.waitForTimeout(1200);
    } catch (e) {
        console.log("NAV_WARN " + e.message);
    }

    const result = await page.evaluate(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const btn = document.querySelector(".dr-btn-primary");
        const card = document.querySelector(".dr-card");
        const panel = document.querySelector(".dr-panel");
        const bcs = cs(btn),
            ccs = cs(card),
            pcs = cs(panel);
        return {
            counts: {
                drBtn: document.querySelectorAll(".dr-btn").length,
                drCard: document.querySelectorAll(".dr-card").length,
                drPanel: document.querySelectorAll(".dr-panel").length,
            },
            primaryButtonBg: bcs && bcs.backgroundImage.slice(0, 50),
            cardBackdrop:
                ccs && (ccs.backdropFilter || ccs.webkitBackdropFilter),
            cardRadius: ccs && ccs.borderRadius,
            panelBackdrop:
                pcs && (pcs.backdropFilter || pcs.webkitBackdropFilter),
        };
    });
    console.log("AURORA_SETTINGS " + JSON.stringify(result, null, 2));
};
