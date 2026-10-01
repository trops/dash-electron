// Verify slice 2: the Aurora gate is active and .dr-* treatment is actually
// applied (computed styles), not just present in the stylesheet.
module.exports = async function (page) {
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(() => {
        const pick = (sel) => document.querySelector(sel);
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const btn = pick(".dr-btn-primary") || pick(".dr-btn");
        const card = pick(".dr-card");
        const panel = pick(".dr-panel");
        const btnCs = cs(btn);
        const cardCs = cs(card);
        const panelCs = cs(panel);
        return {
            dataDesign: document.documentElement.getAttribute("data-design"),
            dataMode: document.documentElement.getAttribute("data-mode"),
            counts: {
                drBtn: document.querySelectorAll(".dr-btn").length,
                drCard: document.querySelectorAll(".dr-card").length,
                drPanel: document.querySelectorAll(".dr-panel").length,
            },
            primaryButton: btnCs && {
                backgroundImage: btnCs.backgroundImage.slice(0, 60),
                borderRadius: btnCs.borderRadius,
                boxShadow: btnCs.boxShadow.slice(0, 40),
            },
            card: cardCs && {
                backdropFilter:
                    cardCs.backdropFilter || cardCs.webkitBackdropFilter,
                borderRadius: cardCs.borderRadius,
                background: cardCs.backgroundColor,
            },
            panel: panelCs && {
                backdropFilter:
                    panelCs.backdropFilter || panelCs.webkitBackdropFilter,
                borderRadius: panelCs.borderRadius,
            },
        };
    });
    console.log("AURORA_VERIFY " + JSON.stringify(result, null, 2));
};
