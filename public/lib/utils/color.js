/**
 * color.js
 * - extractColorsFromImage
 * - extractColorsFromImageURL
 */
const download = require("image-downloader");
const path = require("path");
const getPixels = require("get-pixels");
const { extractColors } = require("extract-colors");
const ntc = require("./ntc");

async function extractColorsFromImageURL(url, toDirectory) {
    try {
        // lets first download the image from url
        const options = {
            url,
            dest: toDirectory, // will be saved to /path/to/dest/image.jpg
        };

        console.log(options);
        const { filename } = await download.image(options);
        console.log("downloaded ", filename);

        // now we can go ahead and get the pixels from the image
        getPixels(filename, (err, pixels) => {
            if (!err) {
                const data = [...pixels.data];
                const [width, height] = pixels.shape;

                extractColors({ data, width, height })
                    .then((result) => {
                        console.log(result);
                        const n = new ntc();
                        const arr = result.map((c) => {
                            const name = n.name(c.hex);
                            c.colorName = name;
                            return c;
                        });
                        console.log(arr);
                    })
                    .catch(console.log);
            }
        });
    } catch (e) {
        throw new Error(e);
    }
}

module.exports = { extractColorsFromImageURL };
