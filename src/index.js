import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import reportWebVitals from "./reportWebVitals";
// CSS loaded via <link> tag in public/index.html (built by `npm run build:css`)
import Dash from "./Dash";

// IMMEDIATE LOG - should appear first
console.log("🚀 [index.js] File loaded - JavaScript is executing!");
console.log(
    "🎨 [index.js] Tailwind CSS should be loaded via <link> tag in HTML"
);

// turn off console logs for non dev
// if (process.env.NODE_ENV !== "development") {
//     console.log = () => {};
// }

console.log("==========================================");
console.log("[index.js] Starting React app");
console.log("[index.js] NODE_ENV:", process.env.NODE_ENV);
console.log("[index.js] Root element:", document.getElementById("root"));
console.log("==========================================");

const rootElement = document.getElementById("root");
if (!rootElement) {
    console.error("[index.js] CRITICAL: Root element not found!");
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText =
        "color: red; font-size: 24px; padding: 20px; white-space: pre-wrap;";
    errorDiv.textContent = "ERROR: Root element not found!";
    document.body.replaceChildren(errorDiv);
} else {
    try {
        console.log("[index.js] Creating React root...");
        const root = ReactDOM.createRoot(rootElement);

        console.log("[index.js] Rendering React app...");
        root.render(
            <HashRouter forceRefresh={true}>
                <Dash />
            </HashRouter>
        );

        console.log("[index.js] React app rendered successfully");
    } catch (e) {
        console.error("[index.js] ERROR during render:", e);
        const errorDiv = document.createElement("div");
        errorDiv.style.cssText =
            "color: red; font-size: 24px; padding: 20px; white-space: pre-wrap;";
        errorDiv.textContent = `ERROR during render: ${e.message}\n\n${e.stack}`;
        document.body.replaceChildren(errorDiv);
    }
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(console.log);
