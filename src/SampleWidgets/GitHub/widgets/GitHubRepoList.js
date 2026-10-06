/**
 * GitHubRepoList
 *
 * Search and browse GitHub repositories via the GitHub MCP provider.
 * Publishes repoSelected events when a repo is clicked.
 *
 * @package GitHub
 */
import { useState, useContext } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    InputText,
    Panel,
    SubHeading2,
    SubHeading3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse, parseGitHubTextEntries } from "../utils/mcpUtils";

function GitHubRepoListContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
    const { publishEvent } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const rowSurface = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    } ${bodyText}`;
    const selectedSurface = `border ${
        currentTheme?.["bg-secondary-dark"] || ""
    } ${currentTheme?.["text-secondary-light"] || ""} ${
        currentTheme?.["border-secondary-medium"] || ""
    }`;

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
                            ? statusTokens.success.solidBg
                            : isConnecting
                            ? `${statusTokens.warning.solidBg} animate-pulse`
                            : error
                            ? statusTokens.error.solidBg
                            : currentTheme?.["bg-primary-medium"] || ""
                    }`}
                />
                <Caption2 className="font-mono">{status}</Caption2>
                <Caption2 className="opacity-70">
                    ({tools.length} tools)
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Search */}
            <div className="space-y-2">
                <SubHeading3 title="Search Repositories" />
                <div className="flex flex-wrap gap-2">
                    <InputText
                        type="text"
                        value={searchQuery}
                        onChange={(value) => setSearchQuery(value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search repos..."
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleSearch}
                        disabled={!isConnected || loading}
                    >
                        {loading ? "..." : "Search"}
                    </Button>
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
                                            ? selectedSurface
                                            : rowSurface
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">
                                            {fullName}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {repo.language && (
                                                <Caption2>
                                                    {repo.language}
                                                </Caption2>
                                            )}
                                            {repo.stargazers_count != null && (
                                                <span
                                                    className={
                                                        statusTokens.warning
                                                            .icon
                                                    }
                                                >
                                                    ★ {repo.stargazers_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {repo.description && (
                                        <Caption2
                                            block
                                            className="truncate mt-0.5"
                                        >
                                            {repo.description}
                                        </Caption2>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Error */}
            {result?.type === "error" && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={result.text}
                />
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
