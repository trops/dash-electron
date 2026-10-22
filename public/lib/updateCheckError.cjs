/**
 * updateCheckError.cjs — which auto-update errors just mean "no update yet".
 *
 * The update service (update.electronjs.org) answers 404 "No updates found"
 * when it has nothing for this platform — e.g. a release whose files are
 * still uploading, or a cached miss. Squirrel.Mac reports that as an error
 * (SQRLUpdaterErrorDomain code 5), and a manual check showed "Could not
 * check for updates" for what is really "no update available yet".
 */

/**
 * @param {unknown} err  the autoUpdater "error" event's error
 * @returns {boolean}
 */
function isNoUpdateYet(err) {
    if (!err) return false;
    const message = String((err && err.message) || err);
    if (/no updates? (found|available)/i.test(message)) return true;
    return (
        /SQRLUpdaterErrorDomain/.test(message) &&
        /\b(code[ =:]*5|Code=5)\b/i.test(message)
    );
}

module.exports = { isNoUpdateYet };
