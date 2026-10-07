/**
 * @jest-environment jsdom
 */
jest.mock("@trops/dash-react", () => {
    const React = require("react");
    return {
        ThemeContext: React.createContext({ currentTheme: {} }),
        FontAwesomeIcon: ({ icon }) =>
            React.createElement("span", { "data-testid": `icon-${icon}` }),
        Modal: ({ isOpen, children }) =>
            isOpen ? React.createElement("div", null, children) : null,
        Button: ({ title, children, onClick, disabled }) =>
            React.createElement(
                "button",
                { onClick, disabled },
                children !== undefined ? children : title
            ),
    };
});

/**
 * InstallExternalMcpModal — the header says who asked: the AI assistant
 * (install_known_mcp_server) or the user, from the UI (e.g. a draft bot's
 * suggested provider, bot-capabilities CAP-005).
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { InstallExternalMcpModal } from "./InstallExternalMcpModal";

const fetchServer = {
    id: "fetch",
    name: "Fetch",
    sourceUrl: "https://github.com/modelcontextprotocol/servers",
    mcpConfig: {
        transport: "stdio",
        command: "uvx",
        args: ["mcp-server-fetch"],
    },
    credentialSchema: {},
};

afterEach(() => {
    delete window.mainApi;
});

describe("InstallExternalMcpModal header", () => {
    it("opened from the UI, it doesn't claim the AI asked", async () => {
        window.mainApi = {
            mcp: {
                getKnownExternalCatalog: jest
                    .fn()
                    .mockResolvedValue({ servers: [fetchServer] }),
            },
        };
        render(<InstallExternalMcpModal />);
        await act(async () => {
            window.dispatchEvent(
                new CustomEvent("dash:install-known-external", {
                    detail: { id: "fetch" },
                })
            );
        });
        expect(
            await screen.findByText("Install MCP server: Fetch")
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Add this MCP provider to Dash\?/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/AI assistant requested/)).toBeNull();
    });

    it("opened by the AI assistant, it says so", async () => {
        let deliver = null;
        window.mainApi = {
            mcp: {
                onInstallKnownExternalConfirm: (cb) => {
                    deliver = cb;
                    return () => {};
                },
            },
        };
        render(<InstallExternalMcpModal />);
        await act(async () => {
            deliver({ requestId: "r1", server: fetchServer });
        });
        expect(screen.getByText(/AI assistant requested/)).toBeInTheDocument();
    });
});
