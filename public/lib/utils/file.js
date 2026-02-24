const path = require("path");
const {
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
    openSync,
    closeSync,
    readdir,
    unlink,
    unlinkSync,
    readdirSync,
    lstatSync,
} = require("fs");

function ensureDirectoryExistence(filePath) {
    try {
        // isDirectory
        var dirname = path.dirname(filePath);
        // check if the directory exists...return true
        // if not, we can pass in the dirname as the filepath
        // and check each directory recursively.
        if (existsSync(dirname)) {
            return true;
        }
        // recursion...
        ensureDirectoryExistence(dirname);
        mkdirSync(dirname);
    } catch (e) {
        console.log("ensure directory " + e.message);
    }
}

function checkDirectory(dir) {
    try {
        if (existsSync(dir) === false) {
            console.log("filepath doesnt exist", dir);
            mkdirSync(dir);
        }
    } catch (e) {
        throw e;
    }
}

// function ensureFileExistence(filePath) {
//     try {
//         var dirname = path.dirname(filePath);
//         if (existsSync(dirname)) {
//             return true;
//         }
//         ensureDirectoryExistence(dirname);

//         mkdirSync(dirname);
//     } catch (e) {
//         console.log(e.message);
//     }
// }

/**
 * getFileContents
 *
 * Will attempt to get the file contents
 * and will generate directory and file if this does not exist.
 *
 * Handles corrupted/empty JSON files by reinitializing with defaults.
 *
 * @param {string} filepath path to the file
 * @returns
 */
function getFileContents(filepath, defaultReturn = []) {
    try {
        // lets first make sure all is there...
        ensureDirectoryExistence(filepath);

        // and now lets read the file...
        let fileContents = JSON.stringify(defaultReturn);
        let fileContentsArray = defaultReturn;
        if (existsSync(filepath)) {
            fileContents = readFileSync(filepath, "utf8");

            try {
                fileContentsArray =
                    filepath.substring(filepath.length - 4) === "json"
                        ? JSON.parse(fileContents)
                        : fileContents;
            } catch (parseError) {
                // File exists but is empty or corrupted JSON
                console.warn(
                    `[File] Corrupted JSON file: ${filepath}, reinitializing with defaults`
                );
                console.warn(`[File] Parse error: ${parseError.message}`);

                // Reinitialize with default content
                fileContentsArray = defaultReturn;
                writeFileSync(filepath, JSON.stringify(defaultReturn, null, 2));
                console.log(`[File] Successfully reinitialized: ${filepath}`);
            }
        } else {
            // we should make the file with default content
            closeSync(openSync(filepath, "w"));
            writeFileSync(filepath, JSON.stringify(defaultReturn, null, 2));
        }

        return fileContentsArray;
    } catch (e) {
        console.log(e);
        return defaultReturn;
    }
}

function writeToFile(filename, data) {
    try {
        // write the new pages configuration back to the file
        return writeFileSync(filename, data);
    } catch (e) {
        return false;
    }
}

/**
 *
 * @param {string} directory
 * @returns
 */
function removeFilesFromDirectory(directory, excludeFiles = []) {
    return (
        directory !== "" &&
        directory &&
        readdir(directory, (err, files) => {
            if (err) throw err;

            for (const file of files) {
                if (!excludeFiles.includes(file)) {
                    unlinkSync(path.join(directory, file), (err) => {
                        if (err) throw err;
                    });
                }
            }
        })
    );
}

module.exports = {
    ensureDirectoryExistence,
    getFileContents,
    writeToFile,
    removeFilesFromDirectory,
    checkDirectory,
};
