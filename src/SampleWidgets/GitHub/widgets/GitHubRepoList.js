/**
 * GitHubRepoList
 *
 * Search and browse GitHub repositories via the GitHub MCP provider.
 * Publishes repoSelected events when a repo is clicked.
 *
 * @package GitHub
 */
import { useState } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse, parseGitHubTextEntries } from "../utils/mcpUtils";

function GitHubRepoListContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
    const { publishEvent } = useWidgetEvents();

    const [searchQuery, setSearchQuery] = useState("");
    const [repos, setRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("search_repositories", {
                query: searchQuery.trim(),
            });
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["items", "repositories"],
                textParser: parseGitHubTextEntries,
            });
            if (mcpError) {
                setResult({ type: "error", text: mcpError });
                return;
            }
            setRepos(Array.isArray(data) ? data : []);
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRepo = (repo) => {
        const fullName = repo.full_name || repo.name || String(repo);
        const owner = repo.owner?.login || fullName.split("/")[0] || "";
        const name = repo.name || fullName.split("/").pop() || "";
        const payload = {
            id: repo.id || null,
            name,
            fullName,
            owner,
        };
        setSelectedRepo(fullName);
        publishEvent("repoSelected", payload);
    };

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        isConnected
                            ? "bg-green-500"
                            : isConnecting
                            ? "bg-yellow-500 animate-pulse"
                            : error
                            ? "bg-red-500"
                            : "bg-gray-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">{status}</span>
                <span className="text-gray-600">({tools.length} tools)</span>
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Search */}
            <div className="space-y-2">
                <SubHeading3 title="Search Repositories" />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search repos..."
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "..." : "Search"}
                    </button>
                </div>
            </div>

            {/* Repo List */}
            {repos.length > 0 && (
                <div className="space-y-2">
                    <SubHeading3 title={`Results (${repos.length})`} />
                    <div className="max-h-64 overflow-y-auto space-y-1">
                        {repos.map((repo, i) => {
                            const fullName =
                                repo.full_name || repo.name || String(repo);
                            return (
                                <button
                                    key={fullName + i}
                                    onClick={() => handleSelectRepo(repo)}
                                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                        selectedRepo === fullName
                                            ? "bg-gray-700 border border-gray-500"
                                            : "bg-white/5 hover:bg-white/10"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-300 font-medium">
                                            {fullName}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {repo.language && (
                                                <span className="text-gray-500">
                                                    {repo.language}
                                                </span>
                                            )}
                                            {repo.stargazers_count != null && (
                                                <span className="text-yellow-500">
                                                    ★ {repo.stargazers_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {repo.description && (
                                        <div className="text-gray-500 truncate mt-0.5">
                                            {repo.description}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Error */}
            {result?.type === "error" && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {result.text}
                </div>
            )}
        </div>
    );
}

export const GitHubRepoList = ({ title = "GitHub Repos", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GitHubRepoListContent title={title} />
            </Panel>
        </Widget>
    );
};
