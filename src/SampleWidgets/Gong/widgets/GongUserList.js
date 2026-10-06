/**
 * GongUserList
 *
 * Search and browse Gong workspace users.
 * Publishes userSelected events when a user is clicked.
 *
 * @package Gong
 */
import { useState, useCallback, useContext } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    InputText,
    Panel,
    SubHeading2,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongUserListContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const surface = currentTheme?.["bg-primary-dark"] || "";
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const selectedRow = `${currentTheme?.["bg-secondary-dark"] || ""} ${
        currentTheme?.["text-secondary-light"] || ""
    }`;
    const { publishEvent } = useWidgetEvents();

    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);

    const handleLoadUsers = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await callTool("list_users", {});
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["users"],
            });
            if (mcpError) {
                setErrorMsg(mcpError);
                return;
            }
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    }, [callTool]);

    const handleSelectUser = useCallback(
        (user) => {
            const id = user.id || user.userId || "";
            setSelectedUserId(id);
            publishEvent("userSelected", {
                id,
                name:
                    user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.name || "",
                email: user.emailAddress || user.email || "",
                title: user.title || "",
            });
        },
        [publishEvent]
    );

    const filtered = searchQuery.trim()
        ? users.filter((u) => {
              const q = searchQuery.toLowerCase();
              const name = (
                  u.name || `${u.firstName || ""} ${u.lastName || ""}`
              ).toLowerCase();
              const email = (u.emailAddress || u.email || "").toLowerCase();
              return name.includes(q) || email.includes(q);
          })
        : users;

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

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

            <div className="flex flex-wrap items-center gap-2">
                <InputText
                    type="text"
                    value={searchQuery}
                    onChange={(value) => setSearchQuery(value)}
                    placeholder="Filter users..."
                    className="flex-1 min-w-0"
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
                <Button
                    size="sm"
                    onClick={handleLoadUsers}
                    disabled={!isConnected || loading}
                >
                    {loading ? "Loading..." : "Load Users"}
                </Button>
            </div>

            {filtered.length > 0 && (
                <div className="max-h-96 overflow-y-auto space-y-1">
                    {filtered.map((user, i) => {
                        const id = user.id || user.userId || i;
                        const name =
                            user.name ||
                            `${user.firstName || ""} ${
                                user.lastName || ""
                            }`.trim() ||
                            "Unknown";
                        const email = user.emailAddress || user.email || "";
                        return (
                            <button
                                key={id}
                                onClick={() => handleSelectUser(user)}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                    selectedUserId === id
                                        ? selectedRow
                                        : `${surface} ${rowHover}`
                                }`}
                            >
                                <div
                                    className={`font-medium ${
                                        selectedUserId === id ? "" : bodyText
                                    }`}
                                >
                                    {name}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {email && <Caption2>{email}</Caption2>}
                                    {user.title && (
                                        <Caption2 className="opacity-70">
                                            {user.title}
                                        </Caption2>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {users.length === 0 && !loading && (
                <Caption2 block className="italic">
                    Click Load Users to browse your Gong workspace.
                </Caption2>
            )}

            {errorMsg && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={errorMsg}
                />
            )}
        </div>
    );
}

export const GongUserList = ({ title = "Gong Users", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GongUserListContent title={title} />
            </Panel>
        </Widget>
    );
};
