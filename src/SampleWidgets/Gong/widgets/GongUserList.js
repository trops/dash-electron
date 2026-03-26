/**
 * GongUserList
 *
 * Search and browse Gong workspace users.
 * Publishes userSelected events when a user is clicked.
 *
 * @package Gong
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GongUserListContent({ title }) {
    const { isConnected, isConnecting, error, callTool, status, tools } =
        useMcpProvider("gong");
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

            <div className="flex gap-2">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter users..."
                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                    onClick={handleLoadUsers}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Loading..." : "Load Users"}
                </button>
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
                                        ? "bg-emerald-900/40 border border-emerald-600"
                                        : "bg-white/5 hover:bg-white/10"
                                }`}
                            >
                                <div className="text-gray-300 font-medium">
                                    {name}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-gray-500">
                                    {email && <span>{email}</span>}
                                    {user.title && (
                                        <span className="text-gray-600">
                                            {user.title}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {users.length === 0 && !loading && (
                <div className="text-xs text-gray-600 italic">
                    Click Load Users to browse your Gong workspace.
                </div>
            )}

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
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
