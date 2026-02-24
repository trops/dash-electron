const { app } = require("electron");
console.log("app type:", typeof app);
console.log("app:", app ? "exists" : "undefined");
if (app && app.whenReady) {
    console.log("app.whenReady exists");
    app.whenReady().then(() => {
        console.log("App ready!");
        app.quit();
    });
} else {
    console.log("ERROR: app or app.whenReady is undefined!");
}
