// Literal call — the manifest scanner detects this and synthesizes a
// declared block at install time. The widget body itself isn't run by
// the e2e suite; the scanner reads the source as text.
//
// scanner-marker: detectable
mainApi.mcp.callTool("filesystem", "read_file", { path: "/tmp/example.txt" });

module.exports = function Reader() {
    return null;
};
