/**
 * openAI
 */

const { ipcRenderer } = require("electron");

const { OPENAI_DESCRIBE_IMAGE } = require("../events/openaiEvents");

const openaiApi = {
    // convert a json array of objects to a csv string and save to file
    describeImage: (imageUrl, apiKey, prompt = "What’s in this image?") =>
        ipcRenderer.invoke(OPENAI_DESCRIBE_IMAGE, { imageUrl, apiKey, prompt }),
};

module.exports = openaiApi;
