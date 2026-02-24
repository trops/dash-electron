const path = require("path");
const webpack = require("webpack");

module.exports = {
    babel: {
        plugins:
            process.env.NODE_ENV === "production"
                ? [["transform-remove-console", { exclude: ["error", "warn"] }]]
                : [],
    },
    webpack: {
        configure: (webpackConfig) => {
            // === ENTRY POINT ===
            // Use src/index.js as the React app entry point, NOT public/electron.js
            webpackConfig.entry = path.resolve(__dirname, "src/index.js");

            // === SOURCE MAPS ===
            // Disable source maps to avoid node:path errors from dependencies
            webpackConfig.devtool = false;

            // === NODE.JS CORE MODULE FALLBACKS ===
            // Webpack 5 doesn't include Node.js polyfills by default
            // Set these to false since they should only run in Electron main process
            webpackConfig.resolve = webpackConfig.resolve || {};
            webpackConfig.resolve.fallback = {
                ...webpackConfig.resolve.fallback,
                fs: false,
                path: false,
                os: false,
                crypto: false,
                stream: false,
                http: false,
                https: false,
                http2: false,
                zlib: false,
                url: false,
                assert: false,
                util: false,
                buffer: false,
                process: false,
                vm: false,
                child_process: false,
                net: false,
                tls: false,
                dns: false,
                querystring: false,
                constants: false,
                console: false,
                timers: false,
            };

            // === HANDLE node: URI SCHEME ===
            // Map node:* imports to regular module names, then to false (since we don't want them in browser)
            webpackConfig.resolve.alias = {
                ...webpackConfig.resolve.alias,
                "node:path": false,
                "node:fs": false,
                "node:os": false,
                "node:crypto": false,
                "node:stream": false,
                "node:http": false,
                "node:https": false,
                "node:http2": false,
                "node:zlib": false,
                "node:url": false,
                "node:assert": false,
                "node:util": false,
                "node:buffer": false,
                "node:process": false,
                "node:vm": false,
                "node:child_process": false,
                "node:net": false,
                "node:tls": false,
                "node:dns": false,
                "node:events": false,
                "node:querystring": false,
                "node:string_decoder": false,
                "node:constants": false,
                "node:console": false,
                "node:timers": false,
            };

            // Handle external modules
            // For Electron renderer process, we want to bundle most things
            // Only externalize: electron, native modules, and node: protocol imports
            webpackConfig.externals = [
                // Externalize Electron
                function ({ request }, callback) {
                    // Externalize electron module
                    if (request === "electron") {
                        return callback(null, "commonjs electron");
                    }
                    // Externalize node: protocol imports
                    if (/^node:/.test(request)) {
                        return callback(null, "commonjs " + request);
                    }
                    callback();
                },
            ];

            // === EXCLUDE ALL public/ from ALL loaders ===
            webpackConfig.module.rules.forEach((rule) => {
                if (!rule.exclude) rule.exclude = [];
                if (!Array.isArray(rule.exclude)) rule.exclude = [rule.exclude];
                rule.exclude.push(path.resolve(__dirname, "public"));
            });

            // === CSS/TAILWIND LOADER ===
            // Disabled custom CSS rule - using create-react-app's built-in CSS handling
            // const hasCssRule = webpackConfig.module.rules.some(rule => {
            //     return rule.test && rule.test.toString().includes('css');
            // });
            // if (!hasCssRule) {
            //     webpackConfig.module.rules.push({
            //         test: /\.css$/i,
            //         use: [
            //             'style-loader',
            //             'css-loader',
            //             {
            //                 loader: 'postcss-loader',
            //                 options: {
            //                     postcssOptions: {
            //                         config: path.resolve(__dirname, 'postcss.config.js'),
            //                     },
            //                 },
            //             },
            //         ],
            //         exclude: /node_modules/,
            //     });
            // }

            // === IGNORE PUBLIC DIR AT PLUGIN LEVEL ===
            webpackConfig.plugins = webpackConfig.plugins || [];
            webpackConfig.plugins.push(
                new webpack.IgnorePlugin({
                    resourceRegExp: /public\/lib/,
                    contextRegExp: /./,
                }),
                new webpack.IgnorePlugin({
                    resourceRegExp: /^\.\/public/,
                })
            );
            // Update HtmlWebpackPlugin to use src/index.html as template
            webpackConfig.plugins = webpackConfig.plugins.map((plugin) => {
                if (
                    plugin.constructor &&
                    plugin.constructor.name === "HtmlWebpackPlugin"
                ) {
                    if (
                        plugin.options &&
                        plugin.options.template &&
                        plugin.options.template.includes("public/index.html")
                    ) {
                        plugin.options.template = path.resolve(
                            __dirname,
                            "src/index.html"
                        );
                    }
                }
                return plugin;
            });

            return webpackConfig;
        },
    },
};
