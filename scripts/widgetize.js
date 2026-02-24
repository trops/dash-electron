#!/usr/bin/env node

// Usage: npx create-my-template my-app

// const spawn = require('cross-spawn');
const fs = require("fs");
const path = require("path");

// The first argument will be the project name.
const projectName = process.argv[2];

console.log("=================================");
console.log("Widgetizing... ", projectName);
console.log("=================================");

function isDir(dir) {
    const stats = fs.statSync(dir);
    return !stats.isFile();
}

function clean(dir) {
    try {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach((f) => {
                if (isDir(`${dir}/${f}`) === true) {
                    clean(`${dir}/${f}`);
                } else {
                    // delete the file only, not the directory
                    fs.rmSync(`${dir}/${f}`);
                }
            });
        }
    } catch (e) {
        console.log("couldnt remove", e.message);
    }
}

/**
 * renameFilesRecursive
 *
 * @param {string} dir the directory name where to begin
 * @param {*} from
 * @param {*} to
 */
function renameFilesRecursive(dir, from, to) {
    fs.readdirSync(dir).forEach((it) => {
        const itsPath = path.resolve(dir, it);
        const itsStat = fs.statSync(itsPath);

        // new filepath, copy them all...
        const newFile = path.join(dir, it.replace(from, to));
        if (itsStat.isFile() === true) {
            fs.renameSync(itsPath, newFile);
            replaceStringInFile(newFile, "Template", projectName);
        } else {
            // recurse.
            renameFilesRecursive(itsPath, from, to);
        }
    });
}

/**
 * replaceStringInFile
 * Use this to replace the actual code in the file with the new project name
 *
 * @param {string} filepath the filepath
 * @param {string} needle the text to search for
 * @param {string} replacement the replacement string
 */
function replaceStringInFile(filepath, needle, replacement) {
    let newContents = null;
    fs.readFile(filepath, function (err, data) {
        if (err) return;
        newContents = data.toString().split(needle).join(replacement);
        fs.writeFileSync(filepath, newContents, {
            encoding: "utf8",
            flag: "w",
        });
    });
}

// Create a project directory with the project name.
const currentDir = process.cwd();

/**
 * Project Directory is the src/Widgets directory
 */
const projectDir = path.resolve(
    path.join(currentDir, "src", "Widgets"),
    projectName
);

const projectRoot = path.resolve(path.join(currentDir, "src", "Widgets"));

// A common approach to building a starter template is to
// create a `template` folder which will house the template
// and the files we want to create.
const templateDir = path.resolve(currentDir, "scripts", "template");

/**
 * Clean the project directory and subdirectories recursively
 */
console.log("1. Cleaning files in directory.", projectDir);
clean(projectDir);

console.log("2. Copying template files.", templateDir);

fs.cpSync(templateDir, projectDir, { recursive: true });

console.log("3. Renaming Widget files");
renameFilesRecursive(projectDir, "Template", `${projectName}`);

/**
 * Add the export to the /Widgets/index.js file
 * (append) to projectDir
 */

function appendExport(dir, componentName) {
    const filename = `${dir}/index.js`;
    const exportString = `export * from './${componentName}';\n`;
    // const exportStringWorkspace = `export {${componentName}} from './${componentName}Workspace.dash.js';\n`;

    let alreadyExported = false;

    // let's check if the file exists
    if (fs.existsSync(filename)) {
        // let's read the file and check to see if we have this export already...
        const contents = fs.readFileSync(filename); //, function (err, data) {
        if (contents) {
            contents
                .toString()
                .split("\n")
                .forEach((line) => {
                    if (`${line}\n` === exportString) {
                        console.log("already exported this Widget");
                        alreadyExported = true;
                    }
                });
        }
    }

    // if we have not yet created this file or exported this Widget, we should
    // append the export to the file.
    if (alreadyExported === false) {
        fs.appendFile(filename, exportString, (err) => {
            if (err) {
                console.log(err);
            } else {
                // Get the file contents after the append operation
                console.log(
                    "\nFile Contents of file after append:",
                    fs.readFileSync(filename, "utf8")
                );
            }
        });
    }
}

appendExport(projectRoot, projectName);

/*

// It is good practice to have dotfiles stored in the
// template without the dot (so they do not get picked
// up by the starter template repository). We can rename
// the dotfiles after we have copied them over to the
// new project directory.
fs.renameSync(
  path.join(projectDir, 'gitignore'),
  path.join(projectDir, '.gitignore')
);

const projectPackageJson = require(path.join(projectDir, 'package.json'));

// Update the project's package.json with the new project name
projectPackageJson.name = projectName;

fs.writeFileSync(
  path.join(projectDir, 'package.json'),
  JSON.stringify(projectPackageJson, null, 2)
);

// Run `npm install` in the project directory to install
// the dependencies. We are using a third-party library
// called `cross-spawn` for cross-platform support.
// (Node has issues spawning child processes in Windows).
spawn.sync('npm', ['install'], { stdio: 'inherit' });

console.log('Success! Your new project is ready.');
console.log(`Created ${projectName} at ${projectDir}`);
*/
