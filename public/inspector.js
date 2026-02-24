let { ipcRenderer, contextBridge } = require("electron");
const Mustache = require("mustache");
const {
    SAVE_SNIPPET_COMPLETE,
    PAGE_GET_PAGE_BY_ID_COMPLETE,
    PUPPETEER_RESET_PAGE_LAYOUT,
    PUPPETEER_RESET_PAGE_LAYOUT_COMPLETE,
    PUPPETEER_SAVE_PAGE_LAYOUT,
} = require("./lib/events");
const { readFileSync } = require("fs");
const queryString = require("node:querystring");
const path = require("path");
const algoliasearch = require("algoliasearch");
const { addClasses, removeClasses } = require("./lib/utils/browser");

// main API for handling requests
const mainApi = require("./lib/api");
contextBridge.exposeInMainWorld("mainApi", mainApi);

let searchClient;

// load in the local tailwind.css and inject into the style tag
const styles = readFileSync(path.join(__dirname, "../src/tailwind.css"));

// fetch from the local filesystem
let templates, pageData, qs;
let searchTerm = "";

// when the user is editing the page template
let editMode = false;
let editLayout = null;

// to generate a template we have to select the container and also the template within the container
// in order to maintain the brand css
let injectContainer = null;
let injectContainerClass = null;
let injectTemplate = null;

let oldCssStyle = null; // to be used on mouseover, remove the style, then put back.
let currentMouseOverTarget = null;
let mouseOverObject = {};

// in edit mode, when a user clicks we will add the selector here.
let layoutSelectors = {};

// load instantsearch
window.instantsearch = require("instantsearch.js");
const instantsearch = window.instantsearch.default;

function removeMouseoverClasses(className, el = null) {
    // return to original
    currentMouseOverTarget.style = oldCssStyle;

    let elements = document.getElementsByClassName(className);
    // HTMLCollection
    Array.from(elements).forEach((element) => {
        element = removeClasses(
            element,
            "highlight-wrap bg-blue-500 opacity-70"
        );
        element = addClasses(element, "opacity-100");
    });
}

/**
 * addScript
 * Inject a script element into the page
 * @param {string} src the source javascript
 */
function addAlgoliaSearchScript() {
    var s1 = document.createElement("script");
    s1.setAttribute(
        "src",
        "https://cdn.jsdelivr.net/npm/algoliasearch@4.5.1/dist/algoliasearch-lite.umd.js"
    );
    s1.setAttribute(
        "integrity",
        "sha256-EXPXz4W6pQgfYY3yTpnDa3OH8/EPn16ciVsPQ/ypsjk="
    );
    s1.setAttribute("crossorigin", "anonymous");

    var s2 = document.createElement("script");
    s2.setAttribute(
        "src",
        "https://cdn.jsdelivr.net/npm/algoliasearch@4.5.1/dist/algoliasearch-lite.umd.js"
    );
    s2.setAttribute(
        "integrity",
        "sha256-EXPXz4W6pQgfYY3yTpnDa3OH8/EPn16ciVsPQ/ypsjk="
    );
    s2.setAttribute("crossorigin", "anonymous");

    document.body.appendChild(s1);
    document.body.appendChild(s2);
}

/**
 * addAlgoliaSearchStyles
 * add the search styles for the ux treatment
 */
function addAlgoliaSearchStyles() {
    var l = document.createElement("link");
    l.setAttribute("rel", "stylesheet");
    l.setAttribute(
        "href",
        "https://cdn.jsdelivr.net/npm/instantsearch.css@7.3.1/themes/reset-min.css"
    );
    l.setAttribute(
        "integrity",
        "sha256-t2ATOGCtAIZNnzER679jwcFcKYfLlw01gli6F6oszk8="
    );
    l.setAttribute("crossorigin", "anonymous");

    document.head.appendChild(l);
}

/**
 * Inject our tailwind.css file into the head
 */
function addLocalTailwind() {
    var l = document.createElement("style");
    l.setAttribute("type", "text/css");
    l.innerHTML = styles.toString();
    document.head.appendChild(l);
}

function handleClickSave(e) {
    console.log(e);
    e.preventDefault();
}

function handleClickEdit(e) {
    console.log("clicked edit");
    editMode = true;
    e.preventDefault();
}

function handleClickReset(e) {
    //console.log('clicked reset', qs);

    // vars required for the reset
    const url = qs["url"];
    const application = {
        key: qs["algolia-app-key"],
        appId: qs["algolia-app-id"],
    };
    const pageId = qs["sitehub-page-id"];
    const indexName = qs["algolia-index"];

    mainApi.browser.resetPageLayout(url, application, pageId, indexName);
    e.preventDefault();
}

/**
 * handleClickLayoutKey
 * @param {string} layoutKey
 */
function handleClickLayout(layoutKey, layout) {
    editMode = true;
    editLayout = {
        layoutKey,
        layout,
    };
}

function handleSearch(e) {
    // set the search term
    searchTerm = e.target.value;
    testSearchAlgolia(
        qs["algolia-app-id"],
        qs["algolia-app-key"],
        qs["algolia-index"],
        pageData,
        templates
    );
}

function addMenubar(page) {
    // need to add an algolia menu bar to the page
    var menubar = document.createElement("div");
    menubar = addClasses(
        menubar,
        "absolute bg-indigo-700 px-2 top-0 w-full flex flex-row justify-between items-center text-gray-200 font-bold text-sm border-b border-gray-600 top-0"
    );
    menubar.style.zIndex = 10;
    menubar.setAttribute("id", "sitehub-menu");
    menubar.innerHTML = "Sitehub";

    // container for the buttons on the right of the menu bar
    var divActions = document.createElement("div");
    divActions.setAttribute("id", "inspector-actions");
    divActions = addClasses(divActions, "flex flex-row p-2 space-x-2 w-full");

    // search box?
    var searchBox = document.createElement("input");
    searchBox.setAttribute("type", "text");
    searchBox.setAttribute("id", "searchbox");
    searchBox.setAttribute("placeholder", "Search");
    searchBox.setAttribute("value", searchTerm);
    searchBox = addClasses(
        searchBox,
        "inspector-el rounded text-gray-500 w-full bg-white flex flex-row flex-1"
    );
    searchBox.oninput = handleSearch;
    searchBox.style.zIndex = 999;
    divActions.appendChild(searchBox);

    // reset the page (remove the index.html file)
    var resetButton = document.createElement("button");
    resetButton.setAttribute("type", "button");
    resetButton.onclick = handleClickReset;
    resetButton = addClasses(
        resetButton,
        "inspector-el p-2 bg-gray-700 text-gray-500 hover:bg-indigo-900 rounded text-sm text-gray-500 flex-0"
    );
    resetButton.innerHTML = "Reset Preview Page";

    divActions.appendChild(resetButton);

    // var editButton = document.createElement('button');
    // editButton.setAttribute('type', 'button');
    // editButton.onclick = handleClickEdit;
    // editButton = addClasses(editButton, 'inspector-el p-2 bg-gray-700 text-gray-500 hover:bg-gray-900 rounded w-full');
    // editButton.innerHTML = 'Edit';

    // divActions.appendChild(editButton);

    // add the layout keys
    Object.keys(page.layout).map((layoutKey) => {
        var btn = document.createElement("button");
        btn.setAttribute("type", "button");
        btn.onclick = () =>
            handleClickLayout(layoutKey, page.layout[layoutKey]);
        btn = addClasses(
            btn,
            "inspector-el p-2 bg-gray-700 text-gray-500 hover:bg-gray-900 rounded flex-0"
        );
        btn.innerHTML = layoutKey;

        divActions.appendChild(btn);
    });

    menubar.appendChild(divActions);

    document.body.appendChild(menubar);

    instantsearch.widgets.searchBox({
        container: "#searchbox",
    });
}

/**
 * testSearchAlgolia
 * Initialize instantsearch to see if this will work
 *
 * @param {string} appId the app id
 * @param {string} key the api key
 */
function testSearchAlgolia(appId, key, index, pageData, templates) {
    // page layout
    const layout = pageData.layout;
    const pageId = pageData.id;
    const queries = [];

    // layout keys
    Object.keys(layout).forEach((layoutKey) => {
        // first we have to check to see if we have a selector chosen
        // as the container for the widget...

        // query building for api call
        const layoutConfig = layout[layoutKey];
        const uiType = layoutConfig.ui;

        // remove the context param and rename contextRule

        layoutConfig["params"]["ruleContexts"] =
            layoutConfig["params"]["context"] !== undefined
                ? layoutConfig["params"]["context"]
                : null;
        if (layoutConfig["params"]["ruleContexts"] === null) {
            delete layoutConfig["params"]["ruleContexts"];
        }

        const queryFromConfig = layoutConfig["params"]["query"];

        delete layoutConfig["params"]["context"];
        delete layoutConfig["params"]["optionalFilters"];
        delete layoutConfig["params"]["filters"];
        delete layoutConfig["params"]["query"];

        // craft the query to Algolia
        const query = {
            indexName: layoutConfig["indexName"],
            query:
                queryFromConfig !== "" && queryFromConfig !== undefined
                    ? queryFromConfig
                    : searchTerm, // need to use the searchbar query here...
            params: layoutConfig["params"],
        };

        const templateName = layout[layoutKey]["template"];
        const template = templates.filter((t) => t.name === templateName)[0];
        if (template) {
            const attributeMap =
                "attributeMap" in template ? template["attributeMap"] : {};
            const translatedTemplate = translateTemplate(
                template["template"],
                attributeMap
            );

            // query with all the goodies.
            queries.push({
                layout: layoutConfig,
                layoutKey,
                query,
                template: translatedTemplate,
            });

            // do the setup in this step for setting up the DOM
            const container = `algolia-container-${pageId}-${layoutKey}`;
            const containerEl = document.getElementById(container);
            if (containerEl) {
                // add the DOM elements.
                injectAlgoliaIntoElement(containerEl, layoutKey, uiType);
            }
        }
    });

    // iterate over the queries and render
    const algoliaQueries = queries.map((q) => q.query);
    console.log(algoliaQueries);

    // execute the queries
    searchClient
        .multipleQueries(algoliaQueries, {})
        .then((results) => {
            console.log(results);
            // iterate over the results and render templates with hits
            results.results.map((result, index) => {
                // set some vars for the layout key (ui element) and the template for rendering
                const layoutKey = queries[index]["layoutKey"];
                const template = queries[index]["template"];

                // get the container we added as a child of the injected (selected) container from the user
                // this is the container specific to the UI as well.
                const container = document.getElementById(layoutKey);

                if (container) {
                    // remove the children...
                    container.childNodes.forEach((c) => c.remove());

                    // now we can render with mustache...
                    result["hits"].map((hit) => {
                        // render the hit using the template
                        const inner = Mustache.render(template, hit);
                        // lets add the resulting html
                        let layoutDiv = document.createElement("div");
                        layoutDiv = addClasses(
                            layoutDiv,
                            "flex flex-col w-full flex-1 h-full max-w-lg"
                        );
                        layoutDiv.innerHTML = inner;
                        container.appendChild(layoutDiv);
                    });
                } else {
                    console.log("no container");
                }
            });
        })
        .catch((e) => console.log(e.message));
}

function loadPageData(appId, pageId) {
    // get the page data and do stuff...
    mainApi.page.getPageById(appId, pageId);
}

function cancelAllClicks() {
    // document.body.onclick = function(e) {
    //     console.log('GOTCHA! ', e.target);
    //    //editMode === false && e.preventDefault();
    // };
}

function translateTemplate(template, attributeMap) {
    let templateCode = template;
    Object.keys(attributeMap).length > 0 &&
        Object.keys(attributeMap).forEach((field) => {
            const translatedFieldValue = attributeMap[field];
            templateCode = templateCode.replace(field, translatedFieldValue);
        });
    return templateCode;
}

/**
 * injectAlgoliaIntoElement
 * Inject the Algolia component into the container we have determined from the
 * 1. Selection of the container "container" in the template
 * 2. Template code from within the container "template.code"
 *
 * @param {Element} el
 */
function injectAlgoliaIntoElement(el, layoutKey, uiType) {
    try {
        console.log(uiType);
        // Add the actual Algolia search component to the DOM
        el.innerHTML = null;

        // establish a new element, if the id already exists, remove it, and then replace
        // with this new element.
        const layoutDiv = document.getElementById(layoutKey);
        if (layoutDiv) {
            console.log("removing element");
            layoutDiv.remove();
        }

        // remove the mouseover overlay
        const overlay = document.getElementById("algolia-hover-overlay");
        overlay && overlay.remove();

        // Hits
        if (uiType === "hits") {
            // we would have to check on the type of element...
            var hitsGrid = document.createElement("div");
            hitsGrid.setAttribute("id", layoutKey);
            hitsGrid = addClasses(
                hitsGrid,
                "grid flex flex-1 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 flex flex-1 opacity-100 w-full h-full py-4"
            );

            // add classes to the div we have selected to place the grid...
            el = addClasses(
                el,
                "flex flex-col flex-1 h-full overflow-y-auto border border-dashed border-2 border-blue-200 rounded p-4"
            );
            el.style.height = "100%";
            el.appendChild(hitsGrid);

            //layoutSelectors[layoutKey] = layoutKey;
        }

        // Carousel
        if (uiType === "carousel") {
            // we would have to check on the type of element...
            var hitsGrid = document.createElement("div");
            hitsGrid.setAttribute("id", layoutKey);
            hitsGrid = addClasses(
                hitsGrid,
                "flex flex-1 opacity-100 w-full h-full overflow-x-scroll max-h-lg space-x-4"
            );

            el.parentElement = addClasses(el, "flex flex-row h-max-lg w-full");
            el.appendChild(hitsGrid);

            //layoutSelectors[layoutKey] = layoutKey;
        }
    } catch (e) {
        console.log(e.message);
    }
}

// function injectAlgoliaIntoElementClass(className) {

//     try {
//         let el = document.getElementsByClassName(className)[0];
//         console.log(el);
//         // Add the actual Algolia search component to the DOM
//         el.innerHTML = null;

//         // establish a new element, if the id already exists, remove it, and then replace
//         // with this new element.
//         const layoutKey = editLayout['layoutKey'];
//         const uiType = editLayout['layout']['ui'];
//         const layoutDiv = document.getElementById(layoutKey);
//         if (layoutDiv) {
//             layoutDiv.remove();
//         }

//         // remove the mouseover overlay
//         const overlay = document.getElementById('algolia-hover-overlay');
//         overlay && overlay.remove();

//         // Hits
//         if (uiType === 'hits') {
//             // we would have to check on the type of element...
//             var hitsGrid = document.createElement('div');
//             hitsGrid.setAttribute('id', layoutKey);
//             hitsGrid = addClasses(hitsGrid, 'grid flex flex-1 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 flex flex-1 opacity-100 w-full h-full py-4');
//             // hitsGrid.style.display = 'grid !important';

//             // add classes to the div we have selected to place the grid...
//             el = addClasses(el, 'flex flex-col flex-1 h-full overflow-y-auto border border-4 border-blue-500');
//             el.style.height = '100%';
//             el.appendChild(hitsGrid);

//             layoutSelectors[layoutKey] = layoutKey;
//         }

//         // Carousel
//         if (uiType === 'carousel') {
//             // we would have to check on the type of element...
//             var hitsGrid = document.createElement('div');
//             hitsGrid.setAttribute('id', layoutKey);
//             hitsGrid = addClasses(hitsGrid, 'flex flex-1 opacity-100 w-full h-full overflow-x-scroll max-h-lg space-x-4');

//             el.parentElement = addClasses(el, 'flex flex-col h-max-lg');
//             el.appendChild(hitsGrid);

//             layoutSelectors[layoutKey] = layoutKey;
//         }
//     } catch(e) {
//         console.log(e.message);
//     }
// }

/**
 * onload
 */
window.onload = function () {
    // query string added to this url for pertinent algolia search and sitehub information
    qs = queryString.parse(window.location.search.replace("?", ""));
    console.log(qs);

    // search client init
    searchClient = algoliasearch(qs["algolia-app-id"], qs["algolia-app-key"]);

    // cancel all the clicks on the page
    //cancelAllClicks();

    // algolia styles
    addAlgoliaSearchStyles();

    // tailwind
    addLocalTailwind();

    // load in the page data
    loadPageData(qs["algolia-app-id"], qs["sitehub-page-id"]);

    // add the script that will be providing the search
    ipcRenderer.addListener(SAVE_SNIPPET_COMPLETE, (e, message) => {
        console.log("SAVED!");
    });

    // listeners for complete events?
    ipcRenderer.addListener(SAVE_SNIPPET_COMPLETE, (e, message) => {
        console.log("SAVED!", message);
    });

    ipcRenderer.addListener(PAGE_GET_PAGE_BY_ID_COMPLETE, (e, message) => {
        console.log("page data ", message);

        // set the global variables for the page and the templates available
        pageData = message.page;

        //only pull the templates for this page specifically
        // templates = message.templates.filter(t => {
        //     if ('pageId' in t) {
        //         return t.pageId === qs['sitehub-page-id']
        //     } else {
        //         return false;
        //     }
        // });

        templates = message.templates;

        console.log(templates);

        // only fire this up when we have all of the selectors "selected" to place the containers...
        // now that we have loaded the page data we can set up the search
        testSearchAlgolia(
            qs["algolia-app-id"],
            qs["algolia-app-key"],
            qs["algolia-index"],
            pageData,
            templates
        );

        // update the menubar
        // add the menubar
        addMenubar(pageData);
    });

    /**
     * onmousemove
     *
     * User will move their mouse around the browser window to select the element they would like
     * to save as a template to be used in the visual side of search
     *
     * @param {event} e mouseover event
     */
    document.onmouseover = (e) => {
        // generate the highlighted area to "capture" as a template for later.
        let el = e.target;

        // tag for the element (only DIV elements allowed)
        const tagName = el.tagName;

        // check to see if we already have an overlay in the dom
        let overlay = document.getElementById("algolia-hover-overlay");

        if (tagName === "DIV") {
            // get the boundaries of the element we are mousing over to use as the dimensions
            // for the overlay
            const scrollTop = document.documentElement.scrollTop;
            const element = el.getBoundingClientRect();
            const left = element.left;
            const top = element.top;
            const width = element.width;
            const height = element.height;
            const parent =
                el.parentElement && el.parentElement.hasAttribute("id")
                    ? el.parentElement.id
                    : null;

            // dont allow mouseover/overlay on the menubar
            if (
                el.id !== "sitehub-menu" &&
                parent !== "sitehub-menu" &&
                editMode === true
            ) {
                if (!overlay) {
                    overlay = document.createElement("div");
                    overlay.setAttribute("id", "algolia-hover-overlay");
                }

                overlay.style.display = "relative";
                overlay.style.pointerEvents = "none";
                overlay.style.width = Math.round(width) + "px";
                overlay.style.height = Math.round(height) + "px";
                overlay.style.top = Math.round(top + scrollTop) + "px";
                overlay.style.left = Math.round(left) + "px";
                overlay.style.zIndex = 999;

                overlay = addClasses(
                    overlay,
                    "bg-blue-300 absolute flex flex-col border-dashed border-4 border-blue-700 rounded opacity-75 justify-center items-center text-3xl text-white text-center cursor-pointer"
                );
                overlay.innerHTML =
                    "Click to Place " + editLayout["layout"]["displayName"];
                document.body.appendChild(overlay);
            } else {
                if (overlay !== null) overlay.remove();
            }
        } else {
            if (overlay !== null) overlay.remove();
        }
    };

    /**
     * onmouseup
     * User has selected an element to "save" as the template for their "page"
     *
     * Save this in the local app directory in the /snippets directory to be used later
     * as a possible template. Trick is we need the entire page to satisfy the CSS/JS that is rendered
     * with the page.
     *
     * @param {event} e
     */
    document.onmouseup = (e) => {
        try {
            let el = e.target;
            const tagName = el.tagName;

            // if we have begun the "injection" process we have to select two divs
            // 1. Container
            // 2. Template within the container

            // check to see if we have already clicked this element
            if (
                el.classList.contains("highlight-wrap-clicked") === false &&
                el.id !== "searchbox" &&
                editMode === true &&
                tagName === "DIV"
            ) {
                // layout key we are editing
                const layoutKey = editLayout["layoutKey"];

                //injectAlgoliaIntoElement(el);

                if (injectContainer === null) {
                    // set this to the CLASS container
                    injectContainerClass = `algolia-container-${qs["sitehub-page-id"]}-${layoutKey}`;
                    console.log(injectContainer);
                    el.classList.add(injectContainerClass);
                    injectContainer = el.innerHTML;
                } else {
                    // set the inner html to the template
                    injectTemplate = el.innerHTML;

                    // loop through all of the injectTemplate element
                    // and change the innerHTML/text to variables?
                    Array.from(el.childNodes).forEach((c, index) => {
                        console.log(c.tagName, c.innerText, index);

                        // convert to template variable
                        if (c.tagName !== "IMG") {
                            el.childNodes[
                                index
                            ].innerText = `{{text_${index}}}`;
                        }

                        // delete the image src and convert to a template variable
                        if (c.tagName === "IMG") {
                            c.setAttribute("src", `{{image_${index}}}`);
                        }
                    });

                    console.log(el.innerHTML);

                    // create the template
                    const pageTemplate = {
                        name: `preview-${qs["sitehub-page-id"]}-${layoutKey}`,
                        ui: "hits",
                        index: qs["algolia-index"],
                        author: "Your Name",
                        version: "1",
                        template: el.innerHTML,
                        pageId: qs["sitehub-page-id"],
                        layoutKey: layoutKey,
                        containerClass: injectContainerClass,
                        attributeMap: {},
                    };

                    console.log("template ", pageTemplate);

                    // Save the selected "template" inside the selected container
                    // we should "update" the snippet based on the page and layout key
                    // appId, templateName, indexName, templateCode, attributeMap

                    // need to figure out how to pre-populate the map as well...
                    const attributeMap = {};

                    // create a name for this template
                    const templateName = `template-${qs["sitehub-page-id"]}-${layoutKey}`;

                    // update the template or create a new one...
                    mainApi.template.updateTemplate(
                        qs["algolia-app-id"],
                        templateName,
                        qs["algolia-index"],
                        pageTemplate,
                        attributeMap
                    );

                    // SAVE THE ENTIRE PAGE...
                    // add the class to the page and save the mhtml
                    // this will allow us to "find" the element later...
                    // or search the file and replace the element on preloading the page...
                    mainApi.browser.savePageLayout(
                        qs["url"],
                        qs,
                        pageData,
                        qs["algolia-index"],
                        injectContainer,
                        injectContainerClass
                    );

                    // now we can inject this template and content
                    //injectAlgoliaIntoElement(el);
                    // injectAlgoliaIntoElementClass(injectContainer);

                    // set back to done editing
                    editMode = false;
                    editLayout = null;
                    injectContainer = null;
                    injectTemplate = null;

                    // reload the page...
                    // this will inject into the dom
                    // and initiate the search
                    window.location.reload();
                }
            }
        } catch (e) {
            console.log(e);
            console.log(e.message);
        }
    };
};
