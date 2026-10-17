/**
 * libraryImports.test.js — packaging records the libraries a widget
 * package imports (consolidation Phase 1a-3), so installers can download
 * them and build its checked source. Twin of dash-core's
 * electron/utils/libraryImports.js.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
    findLibraryImports,
    libraryDependencies,
} = require("./lib/libraryImports.cjs");

function pkg(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zz-imports-"));
    for (const [rel, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), content);
    }
    return dir;
}

describe("libraryImports (packaging)", () => {
    it("finds the libraries a package imports — not the app's, relative files, Node's modules, builds or tests", () => {
        const dir = pkg({
            "widgets/A.js": [
                'import React from "react";',
                'import { Panel } from "@trops/dash-react";',
                'import Mustache from "mustache";',
                'import "./local";',
                'const x = require("lodash.get");',
                'import path from "path";',
            ].join("\n"),
            "contexts/B.js":
                'export { a } from "react-instantsearch-hooks-web/dist/x";',
            "dist/index.cjs.js": 'require("bundled-only");',
            "widgets/A.test.js": 'import x from "@testing-library/react";',
        });
        assert.deepEqual(findLibraryImports(dir), [
            "lodash.get",
            "mustache",
            "react-instantsearch-hooks-web",
        ]);
    });

    it("text that only looks like an import isn't one", () => {
        const dir = pkg({
            "widgets/A.js": [
                "import {",
                "  liteClient,",
                '} from "algoliasearch/lite";',
                "export default function A() {",
                '  return <p>Imported from "Google Sheets"</p>;',
                "}",
                '// import old from "zz-commented";',
                "const s = \"require('zz-in-string')\";",
            ].join("\n"),
        });
        assert.deepEqual(findLibraryImports(dir), ["algoliasearch"]);
    });

    it("records each with the version installed here, and names what's missing", () => {
        const nm = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), "zz-nm-")),
            "node_modules"
        );
        fs.mkdirSync(path.join(nm, "mustache"), { recursive: true });
        fs.writeFileSync(
            path.join(nm, "mustache", "package.json"),
            JSON.stringify({ version: "4.2.0" })
        );
        const dir = pkg({
            "widgets/A.js":
                'import M from "mustache";\nimport G from "zz-gone";',
        });
        assert.deepEqual(libraryDependencies(dir, [nm]), {
            dependencies: { mustache: "4.2.0" },
            missing: ["zz-gone"],
        });
    });

    it("matches dash-core's copy (the app records the same at in-app publish)", () => {
        const twin = path.join(
            __dirname,
            "..",
            "node_modules",
            "@trops",
            "dash-core",
            "electron",
            "utils",
            "libraryImports.js"
        );
        if (!fs.existsSync(twin)) return; // published dash-core ships dist only
        const strip = (s) =>
            s
                .replace(/\/\*\*[\s\S]*?\*\/\n/, "")
                .replace(/,(\s*[)\]}])/g, "$1")
                .replace(/\s+/g, " ")
                .replace(/\s*([(){}[\],;:])\s*/g, "$1")
                .trim();
        assert.equal(
            strip(
                fs.readFileSync(
                    path.join(__dirname, "lib", "libraryImports.cjs"),
                    "utf8"
                )
            ),
            strip(fs.readFileSync(twin, "utf8"))
        );
    });
});

describe("packageZip records the libraries", () => {
    const src = fs.readFileSync(path.join(__dirname, "packageZip.js"), "utf8");
    it("writes them into the zip's package.json", () => {
        assert.match(src, /libraryDependencies\(effectiveWidgetsDir,/);
        assert.match(src, /dependencies: libs\.dependencies/);
    });
    it("stops when a library isn't installed here", () => {
        assert.match(
            src,
            /libs\.missing\.length[\s\S]{0,400}process\.exit\(1\)/
        );
    });
});
