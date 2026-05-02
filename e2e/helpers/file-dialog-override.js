/**
 * File-dialog override for E2E tests.
 *
 * Monkey-patches `dialog.showOpenDialog` / `showSaveDialog` (both async +
 * sync variants) inside the main process so they resolve with a canned
 * response, letting Import / Install-from-File / Export flows run without
 * a native OS picker.
 *
 * Usage:
 *
 *   const path = require("path");
 *   const {
 *     overrideOpenDialog,
 *     overrideSaveDialog,
 *     restoreFileDialogs,
 *   } = require("../helpers/file-dialog-override");
 *
 *   test.beforeEach(async () => {
 *     await overrideOpenDialog(electronApp, {
 *       filePaths: [path.resolve(__dirname, "../../test/fixtures/some.zip")],
 *     });
 *   });
 *
 *   test.afterEach(async () => {
 *     await restoreFileDialogs(electronApp);
 *   });
 *
 * Implementation note: Playwright's `electronApp.evaluate(fn, arg)` passes
 * the `electron` module as the first arg to `fn`. We use `electron.dialog`
 * directly instead of `require('electron')` — `require()` itself is not
 * in scope inside the evaluate body.
 */

async function overrideOpenDialog(electronApp, opts = {}) {
    const filePaths = Array.isArray(opts.filePaths) ? opts.filePaths : [];
    const canceled = !!opts.canceled;

    await electronApp.evaluate(
        async (electron, { filePathsArg, canceledArg }) => {
            if (!global.__dashE2EFileDialogOriginal) {
                global.__dashE2EFileDialogOriginal = {
                    showOpenDialog: electron.dialog.showOpenDialog,
                    showOpenDialogSync: electron.dialog.showOpenDialogSync,
                    showSaveDialog: electron.dialog.showSaveDialog,
                    showSaveDialogSync: electron.dialog.showSaveDialogSync,
                };
            }
            electron.dialog.showOpenDialog = async () => ({
                canceled: canceledArg,
                filePaths: filePathsArg,
            });
            electron.dialog.showOpenDialogSync = () =>
                canceledArg ? undefined : filePathsArg;
        },
        { filePathsArg: filePaths, canceledArg: canceled }
    );
}

async function overrideSaveDialog(electronApp, opts = {}) {
    const filePath = opts.filePath || "";
    const canceled = !!opts.canceled;

    await electronApp.evaluate(
        async (electron, { filePathArg, canceledArg }) => {
            if (!global.__dashE2EFileDialogOriginal) {
                global.__dashE2EFileDialogOriginal = {
                    showOpenDialog: electron.dialog.showOpenDialog,
                    showOpenDialogSync: electron.dialog.showOpenDialogSync,
                    showSaveDialog: electron.dialog.showSaveDialog,
                    showSaveDialogSync: electron.dialog.showSaveDialogSync,
                };
            }
            electron.dialog.showSaveDialog = async () => ({
                canceled: canceledArg,
                filePath: filePathArg,
            });
            electron.dialog.showSaveDialogSync = () =>
                canceledArg ? undefined : filePathArg;
        },
        { filePathArg: filePath, canceledArg: canceled }
    );
}

async function restoreFileDialogs(electronApp) {
    if (!electronApp) return;
    await electronApp
        .evaluate(async (electron) => {
            const originals = global.__dashE2EFileDialogOriginal;
            if (originals) {
                electron.dialog.showOpenDialog = originals.showOpenDialog;
                electron.dialog.showOpenDialogSync =
                    originals.showOpenDialogSync;
                electron.dialog.showSaveDialog = originals.showSaveDialog;
                electron.dialog.showSaveDialogSync =
                    originals.showSaveDialogSync;
                delete global.__dashE2EFileDialogOriginal;
            }
        })
        .catch(() => {});
}

module.exports = {
    overrideOpenDialog,
    overrideSaveDialog,
    restoreFileDialogs,
};
