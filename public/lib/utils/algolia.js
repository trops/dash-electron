// const a = new AlgoliaIndex(appId, apiKey, indexName);

// a.indexBatchFilesToAlgolia('./data/batch_full')
//     .then(res => {
//         console.log(res);
//     }).catch(e => console.log(e));

/**
 * algoliaIndex
 * - read file create batches
 * - send each batch to algolia
 * - upon completion send the next batch until there are no batches left
 * - cleanup
 */

var fs = require("fs");
var JSONStream = require("JSONStream");
const algoliasearch = require("algoliasearch");
const path = require("node:path");
const { ensureDirectoryExistence, checkDirectory } = require("./file");

class AlgoliaIndex {
    /**
     * @var client the algoliasearch client
     */
    client = null;

    /**
     * @var index the algoliasearch initiated index
     */
    index = null;

    constructor(appId = "", apiKey = "", indexName = "") {
        if (appId !== "" && apiKey !== "" && indexName !== "") {
            this.client = algoliasearch(appId, apiKey);
            this.index = this.client.initIndex(indexName);
        }
    }

    createBatchesFromJSONFile = (
        filepath,
        batchFilepath = "/data/batch",
        batchSize,
        callback = null
    ) => {
        return new Promise((resolve, reject) => {
            // instantiate the JSON parser that will be used by the readStream
            var parser = JSONStream.parse("*");

            // count how many items have been added to a single batch
            var countForBatch = 0;

            // counter for the number of batches (used as filename)
            var batchNumber = 1;

            // create the readStream to parse the large file (json)
            var readStream = fs.createReadStream(filepath).pipe(parser);

            var batch = [];

            // checkDirectory(batchFilepath);
            // lets first remove the batch folder
            this.clearDirectory(batchFilepath)
                .then(() => {
                    // when we receive data...
                    readStream.on("data", function (data) {
                        try {
                            //console.log('on data', data);

                            // if we have reached the limit for the batch...
                            // lets write to the batch file
                            if (countForBatch === batchSize) {
                                // write to the batch file
                                var writeStream = fs.createWriteStream(
                                    batchFilepath +
                                        "/batch_" +
                                        batchNumber +
                                        ".json"
                                );
                                writeStream.write(JSON.stringify(batch));
                                writeStream.close();

                                // adjust counts and reset batch array
                                countForBatch = 0;
                                // bump the batch number
                                batchNumber++;
                                // reset the batch json
                                batch = [];
                                // callback function to pass batchnumber (or anything later on)
                                callback &&
                                    typeof callback === "function" &&
                                    callback(batchNumber);
                            } else {
                                try {
                                    // push the JSON data into the batch array to be written later
                                    batch.push(data);
                                    countForBatch++;
                                } catch (e) {
                                    reject(e);
                                }
                            }
                        } catch (e) {
                            reject(e);
                        }
                    });

                    readStream.on("error", function (e) {
                        console.log("batch on error ", e);
                        reject(e);
                    });

                    readStream.on("close", function () {
                        console.log("batch on close ");
                        resolve("batches completed ", batchNumber);
                    });
                })
                .catch((e) => {
                    console.log("catch batch ", e.message);
                    reject(e);
                });
        });
    };

    clearDirectory = (directoryPath) => {
        return new Promise((resolve, reject) => {
            try {
                checkDirectory(directoryPath);
                fs.readdir(directoryPath, (err, files) => {
                    if (err) reject(err);
                    if (files) {
                        files.forEach((file) => {
                            fs.unlinkSync(path.join(directoryPath, file));
                        });
                        resolve();
                    }
                });
            } catch (e) {
                console.log("clear dir error ", e.message);
                reject(e);
            }
        });
    };

    async partialUpdateObjectsFromDirectorySync(
        batchFilepath,
        createIfNotExists = false,
        callback = null
    ) {
        try {
            // read the directory...
            const files = await fs.readdirSync(batchFilepath);
            let results = [];
            for (const fileIndex in files) {
                // for each file lets read the file and then push to algolia
                const pathToBatch = path.join(batchFilepath, files[fileIndex]);
                const fileContents = await this.readFile(pathToBatch);
                if (fileContents) {
                    if ("data" in fileContents && "filepath" in fileContents) {
                        // now we can update the index with the partial update
                        const updateResult = await this.partialUpdateObjects(
                            fileContents.data,
                            fileContents.filepath,
                            createIfNotExists,
                            callback
                        );
                        results.push({ file: files[fileIndex] });
                    } else {
                        console.log("missed ", files[fileIndex]);
                    }
                }
            }
            return Promise.resolve(results);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async readFile(filepath) {
        return await new Promise((resolve, reject) => {
            fs.readFile(filepath, "utf8", (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve({ data, filepath });
            });
        });
    }

    browseObjects = (query = "", callback = null) => {
        return new Promise((resolve, reject) => {
            try {
                if (this.index !== null) {
                    // call algolia to update the objects
                    this.index
                        .browseObjects({
                            query,
                            batch: (hits) => {
                                if (
                                    callback &&
                                    typeof callback === "function"
                                ) {
                                    callback(hits);
                                }
                            },
                        })
                        .then(() => {
                            resolve({ success: true });
                        })
                        .catch((e) => reject(e));
                } else {
                    reject("No index for client");
                }
            } catch (e) {
                console.log("browse objects ", e.message);
                reject(e);
            }
        });
    };

    async partialUpdateObjects(
        objects,
        file,
        createIfNotExists = false,
        callback = null
    ) {
        return new Promise((resolve, reject) => {
            try {
                if (objects) {
                    const batch = JSON.parse(objects);

                    // callback function to pass batchnumber (or anything later on)
                    if (callback && typeof callback === "function") {
                        callback("indexing objects ", file, batch.length);
                    }

                    if (this.index !== null) {
                        // call algolia to update the objects
                        this.index
                            .partialUpdateObjects(batch, {
                                createIfNotExists: createIfNotExists,
                            })
                            .then(({ objectIDs }) => {
                                resolve({
                                    success: true,
                                    batchComplete: batch.length,
                                    objectIDs,
                                });
                            })
                            .catch((e) => {
                                console.log(
                                    "Error partialUpdateObjects",
                                    e.message
                                );
                                reject(e);
                            });
                    } else {
                        reject("No index for client");
                    }
                }
            } catch (e) {
                console.log("partial update objects ", e.message);
                reject(e);
            }
        });
    }
    /**
     * indexBatchToAlgolia
     * @param {String} batchFile the path to the batch file to index.
     */
    saveObjects = (objects, file, callback = null) => {
        return new Promise((resolve, reject) => {
            try {
                if (objects) {
                    const batch = JSON.parse(objects);

                    // callback function to pass batchnumber (or anything later on)
                    if (callback && typeof callback === "function") {
                        callback("saving objects ", file);
                    }

                    // resolve({ success: true, batchComplete: batch.length, file });

                    if (this.index !== null) {
                        // call algolia to update the objects
                        this.index
                            .saveObjects(batch, {
                                autoGenerateObjectIDIfNotExist: true,
                            })
                            .then(({ objectIDs }) => {
                                resolve({
                                    success: true,
                                    batchComplete: batch.length,
                                    file,
                                    objectIDs,
                                });
                            })
                            .catch((e) => reject(e));
                    } else {
                        reject("No index for client");
                    }
                }
            } catch (e) {
                console.log("save objects error", e.message);
                reject(e);
            }
        });
    };
}

module.exports = AlgoliaIndex;
