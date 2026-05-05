// Dynamic tool name — the scanner can't resolve `tool` to a literal,
// so it produces a warning and no detected tool. Install-time consent
// modal must NOT pop for this widget.
//
// scanner-marker: opaque
const tool = process.env.TOOL || "read_file";
mainApi.mcp.callTool("filesystem", tool, { path: "/tmp/example.txt" });

module.exports = function Reader() {
    return null;
};
