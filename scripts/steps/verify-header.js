// Open Slack Pack and report the DashboardHeader's computed background +
// the sidebar's, to confirm both are neutral (near-black), not an accent fill.
module.exports = async function (page) {
    try {
        await page
            .getByText("Slack Pack", { exact: true })
            .first()
            .click({ timeout: 5000 });
    } catch (e) {
        console.log("CLICK_WARN " + e.message);
    }
    await page.waitForTimeout(2500);

    const info = await page.evaluate(() => {
        const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
        // Header: a flex-row bar with justify-between near the very top.
        const header = Array.from(
            document.querySelectorAll("div.flex.flex-row.justify-between")
        ).find((d) => d.getBoundingClientRect().top < 80);
        // Sidebar: the tall left column (aside or the widest tall flex-col at x≈0).
        const sidebar = Array.from(
            document.querySelectorAll("div, aside")
        ).find((d) => {
            const r = d.getBoundingClientRect();
            return (
                r.left < 5 && r.height > 400 && r.width > 150 && r.width < 320
            );
        });
        return { headerBg: bg(header), sidebarBg: bg(sidebar) };
    });
    console.log("HEADER_CHECK " + JSON.stringify(info));
};
