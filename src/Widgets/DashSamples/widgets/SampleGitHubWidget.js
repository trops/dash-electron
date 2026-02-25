/**
 * SampleGitHubWidget
 *
 * Demonstrates useMcpProvider("github") with repo search and issue listing.
 * Requires a GitHub MCP provider to be configured.
 *
 * @package DashSamples
 */
import { useState } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";

function SampleGitHubContent({ title, defaultRepo }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");

    const [searchQuery, setSearchQuery] = useState("");
    const [repos, setRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(defaultRepo || "");
    const [issues, setIssues] = useState([]);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearchRepos = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("search_repositories", {
                query: searchQuery.trim(),
            });
            const parsed = typeof res === "string" ? JSON.parse(res) : res;
            setRepos(
                Array.isArray(parsed)
                    ? parsed
                    : parsed?.items || parsed?.repositories || []
            );
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleListIssues = async (repo) => {
        const target = repo || selectedRepo;
        if (!target) return;
        setLoading(true);
        setResult(null);
        setSelectedRepo(target);
        try {
            const [owner, name] = target.split("/");
            const res = await callTool("list_issues", {
                owner,
                repo: name,
            });
            const parsed = typeof res === "string" ? JSON.parse(res) : res;
            setIssues(Array.isArray(parsed) ? parsed : parsed?.issues || []);
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
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

            {/* Search Repos */}
            <div className="space-y-2">
                <SubHeading3 title="Search Repositories" />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && handleSearchRepos()
                        }
                        placeholder="Search repos..."
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                    />
                    <button
                        onClick={handleSearchRepos}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        Search
                    </button>
                </div>
                {repos.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {repos.map((repo, i) => {
                            const fullName =
                                repo.full_name || repo.name || String(repo);
                            return (
                                <button
                                    key={fullName + i}
                                    onClick={() => handleListIssues(fullName)}
                                    className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                                        selectedRepo === fullName
                                            ? "bg-gray-700 border border-gray-500"
                                            : "bg-white/5 hover:bg-white/10"
                                    }`}
                                >
                                    <span className="text-gray-300">
                                        {fullName}
                                    </span>
                                    {repo.description && (
                                        <div className="text-gray-500 truncate">
                                            {repo.description}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Issues */}
            {selectedRepo && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3 title={`Issues: ${selectedRepo}`} />
                        <button
                            onClick={() => handleListIssues()}
                            disabled={!isConnected || loading}
                            className="px-2 py-0.5 text-xs rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white"
                        >
                            Refresh
                        </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                        {issues.length === 0 ? (
                            <div className="text-xs text-gray-600 italic">
                                No issues found.
                            </div>
                        ) : (
                            issues.map((issue, i) => (
                                <div
                                    key={issue.number || i}
                                    className="px-2 py-1 bg-white/5 rounded text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                issue.state === "open"
                                                    ? "bg-green-900/50 text-green-400"
                                                    : "bg-purple-900/50 text-purple-400"
                                            }`}
                                        >
                                            {issue.state || "open"}
                                        </span>
                                        <span className="text-gray-300 truncate">
                                            {issue.title ||
                                                JSON.stringify(issue)}
                                        </span>
                                    </div>
                                    {issue.labels?.length > 0 && (
                                        <div className="flex gap-1 mt-1">
                                            {issue.labels.map((l, j) => (
                                                <span
                                                    key={j}
                                                    className="px-1 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400"
                                                >
                                                    {l.name || l}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
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

export const SampleGitHubWidget = ({
    title = "Sample GitHub",
    defaultRepo = "",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SampleGitHubContent title={title} defaultRepo={defaultRepo} />
            </Panel>
        </Widget>
    );
};
