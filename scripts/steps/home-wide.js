// Capture the dark Home (wide, expanded sidebar) and verify the stage is
// transparent so the mesh atmosphere shows, and the chrome is seamless.
module.exports = async function (page) {
    try {
        await page.setViewportSize({ width: 1460, height: 920 });
    } catch (e) {}
    await page.waitForTimeout(400);
    try {
        await page
            .locator('[aria-label="Expand sidebar"]')
            .first()
            .click({ timeout: 2500 });
    } catch (e) {}
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => {
        // Nearest painted ancestor at stage center — is the stage now transparent?
        const cx = Math.floor(window.innerWidth * 0.55);
        const cy = Math.floor(window.innerHeight * 0.5);
        let n = document.elementFromPoint(cx, cy);
        let firstOpaque = null;
        while (n) {
            const cs = getComputedStyle(n);
            if (
                cs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                cs.backgroundColor !== "transparent"
            ) {
                firstOpaque = {
                    tag: n.tagName,
                    cls: (n.className || "").toString().slice(0, 55),
                    bg: cs.backgroundColor,
                };
                break;
            }
            n = n.parentElement;
        }
        return {
            dataMode: document.documentElement.getAttribute("data-mode"),
            firstOpaqueAtStageCenter: firstOpaque,
        };
    });
    console.log("HOME_DIAG " + JSON.stringify(info));
};
