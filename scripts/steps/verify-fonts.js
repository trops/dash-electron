// Verification step (slice 1.5): confirm --accent now binds to the live theme
// (not the Aurora fallback) and that data-mode is set from the theme variant.
module.exports = async function (page) {
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const inlineVars = Array.from(document.documentElement.style).filter(
            (n) => n.startsWith("--")
        );
        return {
            dataMode: document.documentElement.getAttribute("data-mode"),
            accent: root.getPropertyValue("--accent").trim(),
            accent2: root.getPropertyValue("--accent-2").trim(),
            primary500Inline: document.documentElement.style
                .getPropertyValue("--primary-500")
                .trim(),
            secondary500Inline: document.documentElement.style
                .getPropertyValue("--secondary-500")
                .trim(),
            inlineVarCount: inlineVars.length,
            inlineAccentVars: inlineVars
                .filter((v) => /primary|secondary|neutral|accent/.test(v))
                .slice(0, 12),
            isStillFallback:
                root.getPropertyValue("--accent").trim() === "#8f82f9",
        };
    });
    console.log("ACCENT_VERIFY " + JSON.stringify(result, null, 2));
};
