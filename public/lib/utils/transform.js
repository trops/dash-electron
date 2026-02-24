/**
 * Utils/tranaform
 * Main gial is to transform a file of data into another form (CSV -> Json for example)
 *
 * - XML -> JSON
 * - CSV -> JSON
 */

var fs = require("fs");
var readline = require("readline");
const xtreamer = require("xtreamer");
var xmlParser = require("xml2js");
var JSONStream = require("JSONStream");
const stream = require("stream");
var csv = require("csv-parser");
const path = require("path");
const { app } = require("electron");
const { ensureDirectoryExistence } = require("./file");

const TRANSFORM_APP_NAME = "Dashboard";
const MAX_MAPPING_BODY_SIZE = 10240; // 10KB limit for mapping function body

/**
 * XtreamerClientTransform
 * Custom Transform stream to parse the JSON from the XML to String operation
 */
class XtreamerClientTransform extends stream.Transform {
    _transform(value, encoding, callback) {
        this.push(JSON.parse(value));
        callback();
    }
}

class Transform {
    constructor() {
        console.log("constructor");
    }

    /**
     * readLinesFromFile
     *
     * If this is a json file we should check in and remove the newLines, and then
     * add commas between records potentially...
     * @param {*} win
     * @param {*} filepath
     * @param {*} linesCount
     * @param {*} callbackEvent
     * @returns
     */
    readLinesFromFile = (
        win,
        filepath,
        linesCount = 100,
        callbackEvent = null
    ) => {
        return new Promise((resolve, reject) => {
            try {
                let count = 0;
                let lines = [];

                // can we aggregate potentially?
                let lineObject = [];

                const readInterface = readline.createInterface({
                    input: fs.createReadStream(filepath),
                    output: process.stdout,
                    console: false,
                });

                readInterface.on("line", function (line) {
                    if (count < linesCount) {
                        //console.log(line);
                        lines.push(line);
                        count++;
                        if (callbackEvent !== null) {
                            win.webContents.send(callbackEvent, {
                                line,
                            });
                        }
                    } else {
                        readInterface.close();
                        resolve(lines);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    };

    readJSONFromFile = (
        win,
        file = "",
        objectCount = 10,
        callbackEvent = null
    ) => {
        return new Promise((resolve, reject) => {
            try {
                const parser = JSONStream.parse("*");
                const readStream = fs.createReadStream(file).pipe(parser);

                let count = 0;

                readStream.on("data", (data) => {
                    //console.log(data);
                    if (callbackEvent !== null) {
                        win.webContents.send(callbackEvent, {
                            data: JSON.stringify(data),
                        });
                    }
                    if (objectCount !== null && count < objectCount) {
                        readStream.destroy();
                        resolve("complete");
                    }
                    count++;
                });

                readStream.on("error", (e) => {
                    reject(e);
                });

                readStream.on("end", (data) => {
                    resolve("Complete");
                });
            } catch (e) {
                console.log("read json error ", e);
                reject(e);
            }
        });
    };

    async parseXMLString(data) {
        let xmlText = data.toString().replace("\ufeff", "");
        return new Promise((resolve, reject) => {
            xmlParser
                .parseStringPromise(xmlText, {
                    trim: true,
                    compact: true,
                    ignoreComment: true,
                    ignoreDoctype: true,
                })
                .then((data) => {
                    // resolve with the comma
                    resolve(JSON.stringify(data) + ",");
                })
                .catch((e) => reject(e));
        });
    }

    parseXMLStream = (filepath, outpath, start) => {
        return new Promise((resolve, reject) => {
            try {
                const xmlFileReadStream = fs.createReadStream(filepath);

                xmlFileReadStream.on("end", () => {
                    writeStream.write("\n]");
                    resolve("Read End");
                });

                xmlFileReadStream.on("finished", () => {
                    resolve("Read Finish");
                });

                const writeStream = fs.createWriteStream(outpath);
                writeStream.write("[\n");

                const options = {
                    headers: { Accept: "application/xml" },
                    resolveWithFullResponse: true,
                    json: false,
                    simple: false,
                    max_xml_size: 50000000, // 10000000
                };

                const xtreamerTransform = xtreamer(
                    start,
                    {
                        transformer: this.parseXMLString, // returns Promise
                        max_xml_size: 50000000,
                    },
                    options
                ).on("error", (e) => {
                    console.log(e);
                    reject(e);
                });

                xmlFileReadStream
                    .pipe(xtreamerTransform)
                    .pipe(new XtreamerClientTransform())
                    .pipe(writeStream)
                    .on("end", () => {
                        console.log("ended");
                    })
                    .on("finish", () => {
                        console.log("finished pipe");
                    });
            } catch (e) {
                console.log(e);
                reject(e);
            }
        });
    };

    parseCSVStream = (
        filepath,
        outpath,
        delimiter = ",",
        objectIdKey = null,
        headers = null, // optional array of headings to grab
        win = null,
        callbackEvent = null,
        limit = null
    ) => {
        return new Promise((resolve, reject) => {
            try {
                const readStream = fs
                    .createReadStream(filepath)
                    .pipe(csv({ separator: delimiter }));
                const writeStream = fs.createWriteStream(outpath);

                let canParse = true;

                // separators for JSON
                let sep = "";
                let count = 0;
                writeStream.write("[\n");

                readStream.on("data", (item) => {
                    if (count > 0) {
                        sep = ",\n";
                    }
                    // if we have specified a limit...
                    if (limit !== null && limit <= count) {
                        canParse = false;
                        writeStream.write("]");
                        readStream.destroy();
                        resolve("Complete");
                    }
                    if (canParse === true) {
                        item["objectID"] = item[objectIdKey];
                        writeStream.write(sep + JSON.stringify(item));
                        count++;

                        if (win !== null) {
                            //console.log("have win", count, callbackEvent);
                            win.webContents.send(callbackEvent, {
                                count,
                            });
                        }
                    }
                });

                readStream.on("end", () => {
                    writeStream.write("]");
                    readStream.destroy();
                    resolve("Complete");
                });
            } catch (e) {
                reject(e);
            }
        });
    };

    /**
     * transformFileToFile
     * We want to convert a format from a file into a different format
     * based on the mapper we have provided
     *
     * @param {*} win
     * @param {*} filepath
     * @param {*} outFilepath
     * @param {*} mapping
     */
    transformFileToFile = (
        win,
        filepath,
        outFilepath,
        mappingFunctionBody,
        args = ["refObj", "index"],
        callbackEvent = null
    ) => {
        return new Promise((resolve, reject) => {
            // Validate mappingFunctionBody is a non-empty string
            if (
                typeof mappingFunctionBody !== "string" ||
                !mappingFunctionBody.trim()
            ) {
                return reject(
                    new Error("mappingFunctionBody must be a non-empty string")
                );
            }

            // Enforce size limit on mapping function body
            if (mappingFunctionBody.length > MAX_MAPPING_BODY_SIZE) {
                return reject(
                    new Error(
                        "mappingFunctionBody exceeds maximum size of " +
                            MAX_MAPPING_BODY_SIZE +
                            " bytes"
                    )
                );
            }

            // Validate file paths are within app data directory
            const appDataDir = path.join(
                app.getPath("userData"),
                TRANSFORM_APP_NAME
            );
            const resolvedFilepath = path.resolve(filepath);
            const resolvedOutFilepath = path.resolve(outFilepath);

            if (!resolvedFilepath.startsWith(appDataDir + path.sep)) {
                return reject(
                    new Error(
                        "Input file path must be within the application data directory"
                    )
                );
            }
            if (!resolvedOutFilepath.startsWith(appDataDir + path.sep)) {
                return reject(
                    new Error(
                        "Output file path must be within the application data directory"
                    )
                );
            }

            // JSON parser
            var parser = JSONStream.parse("*");

            if (fs.existsSync(resolvedFilepath)) {
                console.log("file exists ", resolvedFilepath);
                // create the readStream to parse the large file (json)
                var readStream = fs
                    .createReadStream(resolvedFilepath)
                    .pipe(parser);

                ensureDirectoryExistence(resolvedOutFilepath);

                var writeStream = fs.createWriteStream(resolvedOutFilepath);

                let sep = "";
                let count = 0;

                // create our mapping function
                const fn = new Function(args, mappingFunctionBody);

                // begin the write stream
                writeStream.write("[\n");

                readStream.on("data", (data) => {
                    try {
                        //console.log("in stream", count, data);
                        // data in this case is the JSON object...
                        if (count > 0) {
                            sep = ",\n";
                        }

                        if (data) {
                            // transform the data here...
                            const newValue = fn(data, count);

                            writeStream.write(sep + JSON.stringify(newValue));

                            if (callbackEvent !== null && win !== null) {
                                win.webContents.send(callbackEvent, {
                                    count,
                                });
                            }

                            // increment the counter
                            count++;
                        }
                    } catch (e) {
                        console.log(e.message);
                    }
                });

                readStream.on("end", (data) => {
                    writeStream.write("\n]");
                    writeStream.close();
                    resolve("Complete: wrote " + count + " objects");
                });

                readStream.on("error", (err) => {
                    console.log("read stream error transform ", err.message);
                    reject(err);
                });
            } else {
                reject(new Error("File doesnt exist"));
            }
        });
    };

    /**
     * sanitizeLine (line of file)
     * @param {String} line JSON data that we wish to sanitize
     * @returns String the sanitized String
     */
    sanitizeLine = (line) => {
        try {
            let newLine = line;

            if (line.slice(-1) === ",") {
                newLine = newLine.slice(0, -1);
            }

            if (line.slice(0, 1) === "[") {
                newLine = newLine.slice(1);
            }

            return newLine;
        } catch (e) {
            return line;
        }
    };
}

module.exports = Transform;
