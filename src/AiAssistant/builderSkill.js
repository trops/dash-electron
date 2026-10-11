/**
 * builderSkill — the parts of the dash-widget-builder skill
 * (.claude/skills/dash-widget-builder/SKILL.md) the Widget Builder's AI
 * needs, for its system prompt (create-entry PRD, phase 2e).
 *
 * The skill never reached the builder's AI on its own: Claude Code is run
 * with --disable-slash-commands ("Disable all skills"), the installed app's
 * folder is inside app.asar, and the Anthropic API has no skills. So the
 * main process reads the file and the builder puts these sections in the
 * prompt.
 *
 * Dropped: what only applies to someone running `claude` in a terminal —
 * looking around the filesystem, scaffolding, testing with `npm run dev`,
 * packaging — and the pointer list of reference files.
 *
 * CommonJS so Node tooling (the prompt-validation runner) can require it.
 */

const DROP_SECTIONS = ["Before You Start", "Reference Documents"];
const DROP_SUBSECTIONS = [
    "Phase 1: Scaffold",
    "Phase 4: Test",
    "Phase 5: Package",
];

const startsWithAny = (title, list) => list.some((t) => title.startsWith(t));

/**
 * @param {string|null} skillText  the whole SKILL.md
 * @returns {string} the builder sections ("" when there's no skill)
 */
function builderSkillSections(skillText) {
    if (!skillText || typeof skillText !== "string") return "";
    // Front matter (--- … ---) is metadata for skill loaders, not guidance.
    const body = skillText.replace(/^---\n[\s\S]*?\n---\n/, "");
    const out = [];
    let inFence = false;
    let dropSection = false;
    let dropSub = false;
    for (const line of body.split("\n")) {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
        } else if (!inFence) {
            const h2 = /^## (.+)$/.exec(line);
            const h3 = /^### (.+)$/.exec(line);
            if (h2) {
                dropSection = startsWithAny(h2[1].trim(), DROP_SECTIONS);
                dropSub = false;
            } else if (h3) {
                dropSub = startsWithAny(h3[1].trim(), DROP_SUBSECTIONS);
            }
        }
        if (!dropSection && !dropSub) out.push(line);
    }
    return out
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

module.exports = { builderSkillSections, DROP_SECTIONS, DROP_SUBSECTIONS };
