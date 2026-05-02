/**
 * File-dialog override for E2E tests.
 *
 * `dialog.showOpenDialog` / `dialog.showSaveDialog` open native OS file
 * pickers when the renderer asks the main process to pick a file. That
 * blocks Playwright tests cold — there's no DOM to drive. This helper
 * monkey-patches both methods inside the main process so they resolve
 * with a canned response, letting Import / Install-from-File / Export
 * flows run headless.
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
 * Both sync (`showOpenDialogSync`) and async (`showOpenDialog`) variants
 * are patched, so it doesn't matter which the controller uses.
 */

/**
 * Patch `dialog.showOpenDialog` and `dialog.showOpenDialogSync` to
 * return a canned response.
 *
 * @param {import('@playwright/test').ElectronApplication} electronApp
 * @param {Object} opts
 * @param {string[]} [opts.filePaths=[]]
 *   Absolute paths to return. Empty array + `canceled=true` simulates cancel.
 * @param {boolean} [opts.canceled=false]
 */
async function overrideOpenDialog(electronApp, opts = {}) {
    const filePaths = Array.isArray(opts.filePaths) ? opts.filePaths : [];
    const canceled = !!opts.canceled;

    await electronApp.evaluate(
        async ({ filePathsArg, canceledArg }) => {
            const electron = require("electron");
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

/**
 * Patch `dialog.showSaveDialog` and `dialog.showSaveDialogSync` to
 * return a canned response.
 *
 * @param {import('@playwright/test').ElectronApplication} electronApp
 * @param {Object} opts
 * @param {string} [opts.filePath]   Absolute path to return.
 * @param {boolean} [opts.canceled=false]
 */
async function overrideSaveDialog(electronApp, opts = {}) {
    const filePath = opts.filePath || "";
    const canceled = !!opts.canceled;

    await electronApp.evaluate(
        async ({ filePathArg, canceledArg }) => {
            const electron = require("electron");
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

/**
 * Restore the original `dialog.show*Dialog*` methods. Safe to call
 * even if no override was applied — errors are swallowed.
 *
 * @param {import('@playwright/test').ElectronApplication} electronApp
 */
async function restoreFileDialogs(electronApp) {
    if (!electronApp) return;
    await electronApp
        .evaluate(async () => {
            const electron = require("electron");
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
