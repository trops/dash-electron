const http = require("http");

/**
 * Deterministic test server for Theme from URL E2E tests.
 * Serves pages with known colors, minimal/unstyled pages, and slow responses.
 */

const COLORFUL_PAGE = `<!DOCTYPE html>
<html>
<head>
  <meta name="theme-color" content="#3b82f6">
  <meta name="msapplication-TileColor" content="#1e40af">
  <style>
    :root {
      --primary: #3b82f6;
      --secondary: #10b981;
      --accent: #f59e0b;
      --neutral: #6b7280;
    }
    body {
      background-color: #1e293b;
      color: #f8fafc;
      font-family: sans-serif;
    }
    .header { background-color: #3b82f6; color: white; padding: 20px; }
    .sidebar { background-color: #10b981; color: white; padding: 20px; }
    .card { background-color: #f59e0b; color: #1e293b; padding: 20px; }
    .footer { background-color: #6b7280; color: white; padding: 20px; }
    a { color: #60a5fa; }
    button { background-color: #3b82f6; color: white; padding: 8px 16px; border: none; }
  </style>
</head>
<body>
  <div class="header">Header</div>
  <div class="sidebar">Sidebar</div>
  <div class="card">Card</div>
  <div class="footer">Footer</div>
  <a href="#">Link</a>
  <button>Button</button>
</body>
</html>`;

const MINIMAL_PAGE = `<!DOCTYPE html>
<html>
<head><title>Minimal</title></head>
<body><p>Hello world</p></body>
</html>`;

function createTestServer() {
    const server = http.createServer((req, res) => {
        if (req.url === "/colorful") {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(COLORFUL_PAGE);
        } else if (req.url === "/minimal") {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(MINIMAL_PAGE);
        } else if (req.url === "/slow") {
            // Never respond — simulates timeout
        } else if (req.url === "/error") {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error");
        } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
        }
    });

    return server;
}

let serverInstance = null;
let serverPort = null;

async function startTestServer(port = 0) {
    serverInstance = createTestServer();
    return new Promise((resolve) => {
        serverInstance.listen(port, "127.0.0.1", () => {
            serverPort = serverInstance.address().port;
            resolve(serverPort);
        });
    });
}

async function stopTestServer() {
    if (serverInstance) {
        return new Promise((resolve) => {
            serverInstance.close(resolve);
            serverInstance = null;
            serverPort = null;
        });
    }
}

function getTestServerPort() {
    return serverPort;
}

module.exports = { startTestServer, stopTestServer, getTestServerPort };
