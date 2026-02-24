const path = require("path");
const { app } = require("electron");

const events = require("../events");
const lpm = require("live-plugin-manager");
const { PluginManager } = require("live-plugin-manager");

const pluginController = {
    install: (win, packageName, filepath) => {
        try {
            // init the plugin manager
            // const pluginManager = new PluginManager({
            //     cwd: path.join(app.getPath('userData'), 'plugins-2'),
            //     pluginsPath: path.join(app.getPath('userData'), 'plugins-2')
            // });

            const rootPath = path.join(
                app.getPath("userData"),
                "plugins",
                packageName
            );

            // console.log('HERE', packageName, filepath);
            // console.log(path.join(app.getPath('userData'), 'plugins', packageName));

            // win.webContents.send('plugin-install-complete', path.join(app.getPath('userData'), 'plugins', packageName) );

            // const pluginsPath = path.join(app.getPath('userData'), 'plugins');
            // const pluginFilePath = path.join(app.getPath('userData'), 'plugins', filename);

            // exec(`cd '${rootPath}' && npm install`, (error, stdout, stderr) => {
            //   // send the response back
            //   win.webContents.send("plugin-install-complete", {
            //     out: stdout,
            //     root: rootPath,
            //   });
            //   // pluginManager.require(packageName);
            // });

        } catch (e) {
            win.webContents.send("plugin-install-error", { error: e.message });
        }
    },
};

module.exports = pluginController;
