const { app } = require("electron");
var fs = require("fs");
const path = require("path");
const events = require("../events");
const { getFileContents, writeToFile } = require("../utils/file");

// Convert Json to Csv
const ObjectsToCsv = require("objects-to-csv");
const Transform = require("../utils/transform");
const { extractColorsFromImageURL } = require("../utils/color");
const https = require("https");

const configFilename = "data.json";
const appName = "Dashboard";

const dataController = {
    /**
     * saveLayout
     * Create a workspace from a json configuration object (no template)
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     * @param {object} pageObject the page config object
     */
    convertJsonToCsvFile: (win, appId, jsonObject, toFilename = "test.csv") => {
        try {
            // filename to the pages file (live pages)
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                "data",
                toFilename
            );

            // make sure the file exists...
            const fileContents = getFileContents(filename, "");

            const csv = new ObjectsToCsv(jsonObject);

            csv.toDisk(filename)
                .then((result) => {
                    win.webContents.send(
                        events.DATA_JSON_TO_CSV_FILE_COMPLETE,
                        {
                            succes: true,
                            result,
                            filename,
                        }
                    );
                })
                .catch((e) =>
                    win.webContents.send(events.DATA_JSON_TO_CSV_FILE_ERROR, {
                        error: e.message,
                    })
                );
        } catch (e) {
            win.webContents.send(events.DATA_JSON_TO_CSV_FILE_ERROR, {
                error: e.message,
            });
        }
    },

    /**
     * convertJsonToCsvString
     * @param {BrowserWindow} win
     * @param {*} jsonObject array of json objects
     */
    convertJsonToCsvString: (win, jsonObject = []) => {
        try {
            const csv = new ObjectsToCsv(jsonObject);
            csv.toString(filename)
                .then((result) => {
                    win.webContents.send(
                        events.DATA_JSON_TO_CSV_STRING_COMPLETE,
                        {
                            succes: true,
                            csvString: result,
                        }
                    );
                })
                .catch((e) =>
                    win.webContents.send(events.DATA_JSON_TO_CSV_STRING_ERROR, {
                        error: e.message,
                    })
                );
        } catch (e) {
            win.webContents.send(events.DATA_JSON_TO_CSV_STRING_ERROR, {
                error: e.message,
            });
        }
    },

    readLinesFromFile: (win, filepath, lineCount) => {
        try {
            const t = new Transform();
            t.readLinesFromFile(
                win,
                filepath,
                lineCount,
                events.READ_LINES_UPDATE
            )
                .then((res) => {
                    win.webContents.send(events.READ_LINES_COMPLETE, {
                        success: true,
                        filepath,
                        lineCount,
                        lines: res,
                    });
                })
                .catch((e) => {
                    //console.log(e);
                    win.webContents.send(events.READ_LINES_ERROR, {
                        error: e.message,
                    });
                });
        } catch (error) {
            win.webContents.send(events.READ_LINES_ERROR, {
                error: e.message,
            });
        }
    },

    readJSONFromFile: (win, filepath, objectCount = null) => {
        try {
            console.log("reading json from file ", filepath, objectCount);
            const t = new Transform();
            t.readJSONFromFile(
                win,
                filepath,
                objectCount,
                events.READ_JSON_UPDATE
            )
                .then((res) => {
                    win.webContents.send(events.READ_JSON_COMPLETE, {
                        success: true,
                        filepath,
                    });
                })
                .catch((e) => {
                    //console.log(e);
                    win.webContents.send(events.READ_JSON_ERROR, {
                        error: e.message,
                    });
                });
        } catch (error) {
            console.log(error);
            win.webContents.send(events.READ_JSON_ERROR, {
                error: e.message,
            });
        }
    },

    readDataFromURL: (win, url, toFilepath) => {
        try {
            // Validate URL is https protocol only
            let parsedUrl;
            try {
                parsedUrl = new URL(url);
            } catch {
                throw new Error("Invalid URL provided");
            }
            if (parsedUrl.protocol !== "https:") {
                throw new Error(
                    "Only HTTPS URLs are allowed, got: " + parsedUrl.protocol
                );
            }

            // Validate toFilepath is within the app data directory
            const appDataDir = path.join(app.getPath("userData"), appName);
            const resolvedFilepath = path.resolve(toFilepath);
            if (!resolvedFilepath.startsWith(appDataDir + path.sep)) {
                throw new Error(
                    "File path must be within the application data directory"
                );
            }

            const writeStream = fs.createWriteStream(resolvedFilepath);

            https
                .get(url, (resp) => {
                    resp.on("data", (chunk) => {
                        writeStream.write(chunk);
                    });

                    resp.on("end", () => {
                        win.webContents.send(events.READ_DATA_URL_COMPLETE, {
                            success: true,
                            toFilepath: resolvedFilepath,
                        });
                    });
                })
                .on("error", (err) => {
                    win.webContents.send(events.READ_DATA_URL_ERROR, {
                        error: err.message,
                    });
                });
        } catch (error) {
            console.log(error);
            win.webContents.send(events.READ_DATA_URL_ERROR, {
                error: error.message,
            });
        }
    },

    /**
     * parseXMLStream
     * @param {*} filepath
     * @param {*} outpath
     * @param {*} start
     * @param {*} recordNode
     * @param {*} objectIdKey
     */
    parseXMLStream: (
        win,
        filepath,
        outpath,
        start,
        recordNode = null,
        objectIdKey = null
    ) => {
        try {
            const t = new Transform();
            t.parseXMLStream(
                filepath,
                outpath,
                start
                // recordNode,
                // objectIdKey,
                // win,
                // events.PARSE_XML_STREAM_UPDATE
            )
                .then((res) => {
                    win.webContents.send(events.PARSE_XML_STREAM_COMPLETE, {
                        success: true,
                        filepath,
                        outpath,
                    });
                })
                .catch((e) => {
                    console.log(e);
                    win.webContents.send(events.PARSE_XML_STREAM_ERROR, {
                        error: e.message,
                    });
                });
        } catch (e) {
            win.webContents.send(events.PARSE_XML_STREAM_ERROR, {
                error: e.message,
            });
        }
    },

    /**
     * parseCSVStream
     * @param {*} win
     * @param {*} filepath
     * @param {*} outpath
     * @param {*} delimiter
     * @param {*} objectIdKey
     * @param {Array} headers optional array of headers to choose from the file
     */
    parseCSVStream: (
        win,
        filepath,
        outpath,
        delimiter = ",",
        objectIdKey = null,
        headers = null,
        limit = null
    ) => {
        try {
            const t = new Transform();
            t.parseCSVStream(
                filepath,
                outpath,
                delimiter,
                objectIdKey,
                headers,
                win,
                events.PARSE_CSV_STREAM_UPDATE,
                limit
            )
                .then((res) => {
                    win.webContents.send(events.PARSE_CSV_STREAM_COMPLETE, {
                        success: true,
                        filepath,
                        outpath,
                    });
                })
                .catch((e) => {
                    console.log(e);
                    win.webContents.send(events.PARSE_CSV_STREAM_ERROR, {
                        error: e.message,
                    });
                });
        } catch (e) {
            win.webContents.send(events.PARSE_CSV_STREAM_ERROR, {
                error: e.message,
            });
        }
    },
    /**
     * saveToFile
     *
     * This will save to the /appName/data directory
     * We want this to happen so that all of the data is accessible regardless of the appId
     * Is this the correct behavior?
     *
     * @param {*} win
     * @param {*} data
     * @param {*} filename
     * @param {*} append
     * @param {*} returnEmpty
     */
    saveToFile: (win, data, filename, append, returnEmpty = {}) => {
        try {
            if (data) {
                // filename to the pages file (live pages)
                const toFilename = path.join(
                    app.getPath("userData"),
                    appName,
                    "data",
                    filename
                );

                //console.log("saving to file ", toFilename);

                // // call this to make sure the directory structure exists
                let fileContents = getFileContents(toFilename, returnEmpty);
                if (fileContents === null || fileContents === "") {
                    fileContents = JSON.stringify(returnEmpty);
                }

                // timestamp
                const stamp = Date.now();

                let writeContents = null;

                if (append === true) {
                    // append data
                    if (JSON.stringify(returnEmpty) === "{}") {
                        const tempWriteContents = JSON.parse(fileContents);
                        tempWriteContents[stamp] = data;
                        writeContents = JSON.stringify(tempWriteContents);
                        writeToFile(toFilename, writeContents);
                    }

                    if (JSON.stringify(returnEmpty) === "[]") {
                        const tempWriteContents = JSON.parse(fileContents);
                        tempWriteContents.push({ [stamp]: data });
                        writeContents = JSON.stringify(tempWriteContents);
                        // writeContents = JSON.parse(fileContents);
                        // writeContents.push({ [stamp]: data });
                        writeToFile(toFilename, writeContents);
                    }
                } else {
                    // overwrite existing
                    writeContents = JSON.stringify(data);
                    if (JSON.stringify(returnEmpty) === "{}") {
                        writeToFile(
                            toFilename,
                            writeContents
                            // JSON.stringify({ [stamp]: data })
                        );
                    }
                    if (JSON.stringify(returnEmpty) === "[]") {
                        writeToFile(
                            toFilename,
                            writeContents
                            // JSON.stringify([{ [stamp]: data }])
                        );
                    }
                }

                // console.log(events.DATA_SAVE_TO_FILE_COMPLETE, {
                //     success: true,
                //     filename: toFilename,
                //     fileContents,
                // });

                win.webContents.send(events.DATA_SAVE_TO_FILE_COMPLETE, {
                    success: true,
                    filename: toFilename,
                    fileContents: JSON.parse(writeContents),
                });
            }
        } catch (e) {
            console.log(e);
            win.webContents.send(events.DATA_SAVE_TO_FILE_ERROR, {
                success: false,
                filename: filename,
                message: e.message,
            });
        }
    },

    readFromFile: (win, filename, returnIfEmpty = {}) => {
        try {
            if (filename) {
                // filename to the pages file (live pages)
                const fromFilename = path.join(
                    app.getPath("userData"),
                    appName,
                    "data",
                    filename
                );
                console.log("reading from file ", fromFilename, returnIfEmpty);
                // make sure the file exists...
                const fileContents = getFileContents(
                    fromFilename,
                    returnIfEmpty
                );

                console.log("file contents ", fileContents, fromFilename);

                win.webContents.send(events.DATA_READ_FROM_FILE_COMPLETE, {
                    succes: true,
                    filename: fromFilename,
                    data: JSON.stringify(fileContents),
                });
            }
        } catch (e) {
            win.webContents.send(events.DATA_READ_FROM_FILE_ERROR, {
                succes: false,
                message: e.message,
            });
        }
    },

    /**
     * transformFile
     * Transform the file from one format to another using the provided mapping function block
     * and arguments that are optional (default - refObj, index)
     * @param {*} win
     * @param {*} filepath
     * @param {*} outFilepath
     * @param {*} mappingFunctionBody
     * @param {*} args
     */
    transformFile: (
        win,
        filepath,
        outFilepath,
        mappingFunctionBody,
        args = ["refObj", "index"]
    ) => {
        try {
            const t = new Transform();
            t.transformFileToFile(
                win,
                filepath,
                outFilepath,
                mappingFunctionBody,
                args,
                events.TRANSFORM_FILE_UPDATE
            )
                .then((result) => {
                    win.webContents.send(events.TRANSFORM_FILE_COMPLETE, {
                        succes: true,
                        filename: filepath,
                        toFilename: outFilepath,
                    });
                })
                .catch((e) => {
                    win.webContents.send(events.TRANSFORM_FILE_ERROR, {
                        succes: false,
                        message: e.message,
                    });
                });
        } catch (e) {
            win.webContents.send(events.TRANSFORM_FILE_ERROR, {
                succes: false,
                message: e.message,
            });
        }
    },

    extractColorsFromImageURL: (win, url) => {
        try {
            console.log(url);
            const fileExtension = ".jpg";
            const filename = path.join(
                app.getPath("userData"),
                appName,
                "@algolia/dash-electron",
                "data",
                "imageExtract" + fileExtension
            );

            console.log("filename", filename);

            extractColorsFromImageURL(url, filename)
                .then((result) => console.log(result))
                .catch((e) => console.log(e));
        } catch (e) {
            console.log(e);
        }
    },
};

module.exports = dataController;
