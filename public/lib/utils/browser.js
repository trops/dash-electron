/**
 * addClasses
 * @param {string} classes tailwind classes
 */
function addClasses(el, classes) {
    const classArray = classes.split(" ").forEach((c) => {
        el.classList.add(c);
    });
    return el;
}

/**
 * removeClasses
 * @param {string} classes tailwind classes
 */
function removeClasses(el, classes) {
    const classArray = classes.split(" ").forEach((c) => {
        el.classList.remove(c);
    });
    return el;
}

module.exports = {
    addClasses,
    removeClasses,
};
