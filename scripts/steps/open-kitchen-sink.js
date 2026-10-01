// Open the Kitchen Sink workspace (header bar + page tabs + sidebar) and report
// the computed background of the header + sidebar so we can confirm neutral.
module.exports = async function (page) {
    // Expand the sidebar if collapsed (the » chevron toggle).
    try {
        await page
            .locator(
                '[data-icon="angles-right"], [data-icon="chevrons-right"], [data-icon="angle-right"]'
            )
            .first()
            .click({ timeout: 2500 });
        await page.waitForTimeout(500);
    } catch (e) {}
    // Open Kitchen Sink.
    try {
        await page
            .getByText("Kitchen Sink", { exact: true })
            .first()
            .click({ timeout: 4000 });
    } catch (e) {
        console.log("KS_CLICK_WARN " + e.message);
    }
    await page.waitForTimeout(3000);

    const info = await page.evaluate(() => {
        // Find the header by its workspace title text, walk up to the bar.
        const bgOf = (el) => (el ? getComputedStyle(el).backgroundColor : null);
        // Heuristic: the header is a flex row near the top containing the title.
        const headers = Array.from(document.querySelectorAll("div")).filter(
            (d) =>
                /Kitchen Sink/i.test(d.textContent || "") &&
                d.className.includes("justify-between") &&
                d.getBoundingClientRect().top < 120
        );
        return {
            headerBg: bgOf(headers[0]),
            drPanel: document.querySelectorAll(".dr-panel").length,
        };
    });
    console.log("KITCHEN_SINK " + JSON.stringify(info));
};
