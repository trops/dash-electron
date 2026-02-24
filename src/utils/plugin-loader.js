/*
// plugin-loader.js
const path = require('path');
// const { PluginManager } = require('live-plugin-manager');
const pluginInstallFolder = path.resolve(app.getPath('userData'), '.plugins');
const pluginManager = new PluginManager();

module.exports = async (pkg) => {
  // installs pkg from npm
  await pluginManager.install(pkg);
  const package = pluginManager.require(pkg);
  return package
}
*/
/*
// main.js
const pluginLoader = require('./plugin-loader');
pluginLoader("moment").then((moment) => {
   console.log(moment().format());
})
*/
