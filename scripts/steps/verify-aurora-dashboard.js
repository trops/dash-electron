// Open a workspace with widgets and verify Panel/Card glass is applied.
module.exports = async function (page) {
    const tryClick = async (label) => {
        try {
            await page.getByText(label, { exact: true }).first().click();
            return true;
        } catch (e) {
            return false;
        }
    };
    // Try a few known workspace names until one opens.
    for (const name of ["Slack Pack", "Kitchen Sink", "Programmatic Test"]) {
        if (await tryClick(name)) {
            console.log("OPENED " + name);
            break;
        }
    }
    await page.waitForTimeout(3500); // let widgets compile/render

    const result = await page.evaluate(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const panel = document.querySelector(".dr-panel");
        const card = document.querySelector(".dr-card");
        const pcs = cs(panel),
            ccs = cs(card);
        return {
            counts: {
                drPanel: document.querySelectorAll(".dr-panel").length,
                drCard: document.querySelectorAll(".dr-card").length,
                drBtn: document.querySelectorAll(".dr-btn").length,
            },
            panel: pcs && {
                backdrop: pcs.backdropFilter || pcs.webkitBackdropFilter,
                radius: pcs.borderRadius,
                bg: pcs.backgroundColor,
            },
            card: ccs && {
                backdrop: ccs.backdropFilter || ccs.webkitBackdropFilter,
                radius: ccs.borderRadius,
            },
        };
    });
    console.log("AURORA_DASH " + JSON.stringify(result, null, 2));
};
