# PRD: Gong Multi-Widget Decomposition

**Status:** Implemented
**Last Updated:** 2026-03-27
**Owner:** John Giatropoulos

---

## Executive Summary

Decompose the monolithic GongWidget into 7 focused, event-driven widgets that each map to specific Gong MCP tools. Users can compose their own Gong dashboard by placing widgets side-by-side — search for calls in one widget, see the summary in another, read the transcript in a third — all connected via `callSelected` publish/listen events.

---

## Problem Statement

The current GongWidget bundles search, summary, and transcript into a single view with internal navigation. This prevents users from seeing multiple aspects of a call simultaneously and doesn't follow the Dash pattern of composable, task-specific widgets (like the GitHub and Slack packages).

## Widgets

| Widget             | Tools                                                           | Publishes    | Listens      |
| ------------------ | --------------------------------------------------------------- | ------------ | ------------ |
| GongCallSearch     | list_calls, search_calls                                        | callSelected | —            |
| GongCallSummary    | get_call_summary                                                | —            | callSelected |
| GongCallTranscript | get_call_transcript                                             | —            | callSelected |
| GongCallDetail     | get_call                                                        | —            | callSelected |
| GongUserList       | list_users, search_users, get_user                              | userSelected | —            |
| GongLibraryFolders | list_library_folders, get_library_folder_calls, list_workspaces | callSelected | —            |
| GongTrackers       | get_trackers                                                    | —            | —            |

## User Story

As a sales manager, I want to search Gong calls in one widget and see the AI summary and transcript appear in adjacent widgets when I click a call, so I can review call details without navigating between views.

## Acceptance Criteria

-   [ ] Each widget works standalone (shows empty/prompt state when no event received)
-   [ ] GongCallSearch publishes `callSelected` on click, listener widgets react
-   [ ] GongLibraryFolders also publishes `callSelected` (alternative entry point)
-   [ ] Existing monolith GongWidget preserved for backward compatibility
-   [ ] All 7 widgets appear in the widget picker with Gong provider
-   [ ] `npm run ci` passes

---

## Implementation Notes

-   Reuses existing `CallList`, `CallSummary`, `CallTranscript` components
-   Follows GitHub/Slack multi-widget event patterns (`useWidgetEvents` hook)
-   Shares `utils/mcpUtils.js` across all widgets (markdown table parser, unwrapResponse)
-   Event payload: `{ id, title, date, duration, scope }`
-   **Bug fix (2026-03-27):** Receiver widgets accessed `data.id` directly instead of `data.message.id`. DashboardPublisher wraps payloads as `{ message, event, uuid }`. Fixed using `data.message || data` defensive pattern (matching GCalEventDetail/GDriveFilePreview).
-   Listener status UI added to receiver widgets — shows green/yellow dot indicating whether event listeners are configured.
-   Gong event chain tests added to dash-core `useWidgetEvents.test.js` (6 tests + 2 isolation tests).
-   DashboardMonitor event debugger implemented in dash-core — live event log and active subscriptions view.
