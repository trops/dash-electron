import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import postcss from "rollup-plugin-postcss";
import filesize from "rollup-plugin-filesize";
import autoprefixer from "autoprefixer";
import external from "rollup-plugin-peer-deps-external";
import pkg from "./package.json" assert { type: "json" };
import typescript from "typescript";
import ts from "@rollup/plugin-typescript";
import strip from "@rollup/plugin-strip";

const INPUT_FILE_PATH = "src/Widgets/index.js";
const OUTPUT_NAME = "Dash-Widgets";

// change the package.main so this points to the bundler
// that results from this rollup script

pkg.main = "dist/index.js";

const GLOBALS = {
    react: "React",
    "react-dom": "ReactDOM",
    "prop-types": "PropTypes",
    window: "window",
};

const PLUGINS = [
    external({
        includeDependencies: true,
    }),
    postcss({
        extract: true,
        plugins: [autoprefixer],
    }),
    babel.babel({
        babelHelpers: "runtime",
        exclude: "node_modules/**",
        skipPreflightCheck: true,
    }),
    resolve({
        browser: true,
        extensions: [".cjs", ".js", ".jsx", ".json", ".ts", ".tsx", ".css"],
    }),
    commonjs({
        include: "node_modules/**",
    }),
    filesize(),
    // ts({
    //   typescript,
    //   // sourceMap: true,
    //   // rootDir: "./src/Widgets",
    //   // include: ["./src/Widgets/*"],
    // }),
    strip(),
];

const EXTERNAL = ["react", "react-dom", "prop-types"];

// https://github.com/rollup/plugins/tree/master/packages/babel#babelhelpers
const CJS_AND_ES_EXTERNALS = EXTERNAL.concat(/@babel\/runtime/);

const OUTPUT_DATA = [
    {
        file: pkg.main,
        format: "cjs",
    },
    {
        file: pkg.module,
        format: "es",
    },
];

const isProduction =
    process.env.NODE_ENV === "prod" || process.env.NODE_ENV === "production";

const config = OUTPUT_DATA.map(({ file, format }) => ({
    input: INPUT_FILE_PATH,
    output: {
        dir: "dist",
        sourcemap: !isProduction,
        //file,
        //dir: "dist",
        format,
        name: OUTPUT_NAME,
        globals: GLOBALS,
        // exports: "named"
    },
    plugins: PLUGINS,
    external: ["cjs", "es"].includes(format) ? CJS_AND_ES_EXTERNALS : EXTERNAL,
}));

export default config;
