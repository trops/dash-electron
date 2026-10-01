// Diagnose why the mesh atmosphere isn't visible: is it on the body, is it
// resolving, and is an opaque element painting over it?
module.exports = async function (page) {
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const body = getComputedStyle(document.body);
        // Walk the tree at the center of the empty stage; find the nearest
        // ancestor with a non-transparent background (what the user actually sees).
        const cx = Math.floor(window.innerWidth * 0.6);
        const cy = Math.floor(window.innerHeight * 0.5);
        const el = document.elementFromPoint(cx, cy);
        const chain = [];
        let n = el;
        while (n && chain.length < 12) {
            const cs = getComputedStyle(n);
            const bg = cs.backgroundColor;
            const bgi = cs.backgroundImage;
            if (
                (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") ||
                (bgi && bgi !== "none")
            ) {
                chain.push({
                    tag: n.tagName,
                    id: n.id || "",
                    cls: (n.className || "").toString(),
                    bg,
                });
            }
            n = n.parentElement;
        }
        const heading = Array.from(
            document.querySelectorAll("h1,h2,h3,div")
        ).find(
            (el) =>
                /Channels|Notepad|AI Chat|Messages/i.test(
                    el.textContent || ""
                ) && el.children.length === 0
        );
        return {
            dataMode: document.documentElement.getAttribute("data-mode"),
            headingColor: heading ? getComputedStyle(heading).color : null,
            accent: root.getPropertyValue("--accent").trim(),
            bgVar: root.getPropertyValue("--bg").trim(),
            meshResolvesToImage: root
                .getPropertyValue("--mesh")
                .trim()
                .slice(0, 60),
            bodyBgImage: body.backgroundImage.slice(0, 80),
            bodyBgColor: body.backgroundColor,
            paintedAncestorsAtStageCenter: chain,
        };
    });
    console.log("BG_DIAG " + JSON.stringify(info, null, 2));
};
