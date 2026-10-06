/**
 * GitHubWidget
 *
 * Search repos and list issues via the GitHub MCP provider.
 * Requires a GitHub MCP provider to be configured.
 *
 * @package GitHub
 */
import { useState, useContext } from "react";
import {
    AlertBanner,
    Button,
    Button2,
    Caption2,
    InputText,
    Panel,
    StatusBadge,
    SubHeading2,
    SubHeading3,
    Tag3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { parseMcpResponse, parseGitHubTextEntries } from "../utils/mcpUtils";

function GitHubContent({ title, defaultRepo }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
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
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["issues", "items"],
            });
            if (mcpError) {
                setResult({ type: "error", text: mcpError });
                return;
            }
            setIssues(Array.isArray(data) ? data : []);
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

            {/* Search Repos */}
            <div className="space-y-2">
                <SubHeading3 title="Search Repositories" />
                <div className="flex flex-wrap gap-2">
                    <InputText
                        type="text"
                        value={searchQuery}
                        onChange={(value) => setSearchQuery(value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && handleSearchRepos()
                        }
                        placeholder="Search repos..."
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleSearchRepos}
                        disabled={!isConnected || loading}
                    >
                        Search
                    </Button>
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
                                            ? selectedSurface
                                            : rowSurface
                                    }`}
                                >
                                    <span>{fullName}</span>
                                    {repo.description && (
                                        <Caption2 block className="truncate">
                                            {repo.description}
                                        </Caption2>
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
                        <Button2
                            size="sm"
                            onClick={() => handleListIssues()}
                            disabled={!isConnected || loading}
                        >
                            Refresh
                        </Button2>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                        {issues.length === 0 ? (
                            <Caption2 block className="italic">
                                No issues found.
                            </Caption2>
                        ) : (
                            issues.map((issue, i) => (
                                <div
                                    key={issue.number || i}
                                    className={`px-2 py-1 rounded text-xs ${
                                        currentTheme?.["bg-primary-dark"] || ""
                                    } ${bodyText}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <StatusBadge
                                            state={
                                                (issue.state || "open") ===
                                                "open"
                                                    ? "open"
                                                    : "closed"
                                            }
                                            label={issue.state || "open"}
                                        />
                                        <span className="truncate">
                                            {issue.title ||
                                                JSON.stringify(issue)}
                                        </span>
                                    </div>
                                    {issue.labels?.length > 0 && (
                                        <div className="flex gap-1 mt-1">
                                            {issue.labels.map((l, j) => (
                                                <Tag3
                                                    key={j}
                                                    text={l.name || l}
                                                    padding="px-1 py-0.5"
                                                />
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
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={result.text}
                />
            )}
        </div>
    );
}

export const GitHubWidget = ({
    title = "GitHub",
    defaultRepo = "",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GitHubContent title={title} defaultRepo={defaultRepo} />
            </Panel>
        </Widget>
    );
};
