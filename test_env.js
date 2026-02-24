const packageJson = require("./package.json");
require("dotenv").config();

console.log(process.env.REACT_APP_GITHUB_TOKEN);
console.log(process.env.REACT_APP_GITHUB_USER);
console.log(process.env.REACT_APP_GITHUB_REPO);
console.log(process.env.REACT_APP_APPLE_ID);
console.log(process.env.REACT_APP_APPLE_PASSWORD);
console.log(process.env.REACT_APP_APPLE_TEAM_ID);
