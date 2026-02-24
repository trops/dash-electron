# Widget Provider Configuration Guide

## Overview

This guide shows widget developers how to configure provider requirements in their widget's `.dash.js` configuration file. Providers allow widgets to connect to external services like Slack, Algolia, GitHub, or custom APIs while keeping credentials secure and reusable across dashboards.

## Table of Contents

-   [Basic Concepts](#basic-concepts)
-   [Provider Configuration Structure](#provider-configuration-structure)
-   [Credential Schema](#credential-schema)
-   [Complete Examples](#complete-examples)
-   [Best Practices](#best-practices)
-   [Provider Types](#provider-types)

## Basic Concepts

### What is a Provider?

A **provider** is a configured connection to an external service. It contains:

-   **Type**: The service name (e.g., "slack", "algolia")
-   **Credentials**: API keys, tokens, URLs (encrypted and stored securely)
-   **Name**: User-friendly identifier (e.g., "Production Slack", "Staging API")

### Why Use Providers?

1. **Security**: Credentials are encrypted and stored in the main app's secure storage
2. **Reusability**: One provider can be used by multiple widgets
3. **Per-Dashboard**: Each dashboard can use different provider configurations
4. **User Experience**: Users select providers via UI, no code changes needed

## Provider Configuration Structure

### Location

Provider configuration goes in your widget's `.dash.js` file:

```
src/Widgets/MyWidget/
├── widgets/
│   ├── MyWidgetWidget.js          # Widget component
│   └── MyWidgetWidget.dash.js     # ← Configuration file
```

### Basic Format

```javascript
export default {
    name: "MyWidget",
    component: MyWidgetComponent,
    type: "widget",
    workspace: "my-workspace",

    // Provider configuration
    providers: [
        {
            type: "provider-type", // Required: string
            required: true, // Required: boolean
            credentialSchema: {
                // Required: object
                // Define credentials needed
            },
        },
    ],

    // Other config...
    userConfig: {
        /* ... */
    },
    styles: {
        /* ... */
    },
};
```

### Fields

| Field              | Type    | Required | Description                                          |
| ------------------ | ------- | -------- | ---------------------------------------------------- |
| `type`             | string  | ✅       | Provider type identifier (e.g., "slack", "algolia")  |
| `required`         | boolean | ✅       | If `true`, widget won't render without this provider |
| `credentialSchema` | object  | ✅       | Defines the credentials form fields                  |

## Credential Schema

The `credentialSchema` defines what information users need to provide when creating a provider.

### Field Properties

Each credential field supports these properties:

```javascript
credentialSchema: {
    fieldName: {
        type: "text",              // Required: "text" | "password" | "secret"
        displayName: "API Key",    // Required: Label shown in UI
        instructions: "Enter...",  // Required: Help text
        required: true,            // Required: Is this field required?
        secret: true               // Required: Encrypt this field?
    }
}
```

| Property       | Type    | Options                            | Description                                        |
| -------------- | ------- | ---------------------------------- | -------------------------------------------------- |
| `type`         | string  | `"text"`, `"password"`, `"secret"` | Input field type                                   |
| `displayName`  | string  | -                                  | Label shown to users                               |
| `instructions` | string  | -                                  | Help text explaining what to enter                 |
| `required`     | boolean | `true`, `false`                    | Is this field required?                            |
| `secret`       | boolean | `true`, `false`                    | Should this be encrypted? (`true` for keys/tokens) |

### Field Type Behavior

-   **`text`**: Normal text input, visible when typing
-   **`password`**: Password input, hidden when typing
-   **`secret`**: Text input for sensitive data (will be encrypted in storage)

**Note:** For API keys, tokens, and passwords, use `type: "text"` with `secret: true` for the best UX.

## Complete Examples

### Example 1: Slack Provider

```javascript
export default {
    name: "SlackNotificationWidget",
    component: SlackNotificationWidget,
    type: "widget",
    workspace: "notifications-workspace",

    providers: [
        {
            type: "slack",
            required: true,
            credentialSchema: {
                token: {
                    type: "text",
                    displayName: "Slack Bot Token",
                    instructions:
                        "Enter your Slack bot token (starts with xoxb-)",
                    required: true,
                    secret: true,
                },
                workspaceUrl: {
                    type: "text",
                    displayName: "Workspace URL",
                    instructions:
                        "Your Slack workspace URL (e.g., mycompany.slack.com)",
                    required: false,
                    secret: false,
                },
            },
        },
    ],

    userConfig: {
        channel: {
            type: "text",
            displayName: "Channel",
            instructions: "Channel to post notifications",
            required: true,
        },
    },
};
```

### Example 2: Algolia Search Provider

```javascript
export default {
    name: "SearchWidget",
    component: SearchWidget,
    type: "widget",
    workspace: "search-workspace",

    providers: [
        {
            type: "algolia",
            required: true,
            credentialSchema: {
                appId: {
                    type: "text",
                    displayName: "Application ID",
                    instructions: "Your Algolia Application ID",
                    required: true,
                    secret: true,
                },
                apiKey: {
                    type: "text",
                    displayName: "Search API Key",
                    instructions: "Your Algolia Search-Only API Key",
                    required: true,
                    secret: true,
                },
                indexName: {
                    type: "text",
                    displayName: "Default Index",
                    instructions: "Default index to search (e.g., 'products')",
                    required: true,
                    secret: false,
                },
            },
        },
    ],
};
```

### Example 3: GitHub API Provider

```javascript
export default {
    name: "GitHubIssuesWidget",
    component: GitHubIssuesWidget,
    type: "widget",
    workspace: "github-workspace",

    providers: [
        {
            type: "github",
            required: true,
            credentialSchema: {
                token: {
                    type: "text",
                    displayName: "Personal Access Token",
                    instructions: "GitHub PAT with 'repo' scope",
                    required: true,
                    secret: true,
                },
                apiUrl: {
                    type: "text",
                    displayName: "API URL",
                    instructions: "GitHub API URL (leave blank for github.com)",
                    required: false,
                    secret: false,
                },
            },
        },
    ],
};
```

### Example 4: Multiple Providers

```javascript
export default {
    name: "IntegrationWidget",
    component: IntegrationWidget,
    type: "widget",
    workspace: "integration-workspace",

    providers: [
        {
            type: "slack",
            required: true,
            credentialSchema: {
                token: {
                    type: "text",
                    displayName: "Slack Token",
                    instructions: "Your Slack bot token",
                    required: true,
                    secret: true,
                },
            },
        },
        {
            type: "github",
            required: false, // Optional provider
            credentialSchema: {
                token: {
                    type: "text",
                    displayName: "GitHub Token",
                    instructions: "GitHub personal access token (optional)",
                    required: true,
                    secret: true,
                },
            },
        },
    ],
};
```

### Example 5: Custom API Provider

```javascript
export default {
    name: "CustomAPIWidget",
    component: CustomAPIWidget,
    type: "widget",
    workspace: "custom-workspace",

    providers: [
        {
            type: "custom-api", // Custom provider type
            required: true,
            credentialSchema: {
                apiUrl: {
                    type: "text",
                    displayName: "API Base URL",
                    instructions:
                        "Your API base URL (e.g., https://api.example.com)",
                    required: true,
                    secret: false,
                },
                apiKey: {
                    type: "text",
                    displayName: "API Key",
                    instructions: "Your API authentication key",
                    required: true,
                    secret: true,
                },
                apiSecret: {
                    type: "text",
                    displayName: "API Secret",
                    instructions: "Your API secret (if required)",
                    required: false,
                    secret: true,
                },
            },
        },
    ],
};
```

### Example 6: MCP Provider (Model Context Protocol)

MCP providers connect to external tools via MCP servers instead of directly using credentials. Set `providerClass: "mcp"` to indicate an MCP provider.

```javascript
export default {
    name: "McpTestWidget",
    component: McpTestWidget,
    type: "widget",
    workspace: "mcp-test-workspace",

    providers: [
        {
            type: "slack",
            providerClass: "mcp", // MCP provider (not credential)
            required: true,
            // Optional: restrict which tools the widget can call
            // allowedTools: ["send_message", "list_channels"],
        },
    ],

    userConfig: {
        title: {
            type: "text",
            defaultValue: "MCP Test",
            displayName: "Title",
            required: false,
        },
    },
};
```

**Key differences from credential providers:**

| Feature            | Credential Provider            | MCP Provider                                |
| ------------------ | ------------------------------ | ------------------------------------------- |
| `providerClass`    | `"credential"` (default)       | `"mcp"`                                     |
| `credentialSchema` | Defined in `.dash.js`          | Derived from `mcpServerCatalog.json`        |
| Runtime access     | `AppContext.providers[name]`   | `useMcpProvider("type")` hook               |
| What you get       | Raw credentials (keys, tokens) | Tools and resources (via MCP protocol)      |
| Server lifecycle   | N/A                            | Auto-start on mount, auto-stop on unmount   |
| Tool scoping       | N/A                            | `allowedTools` in `.dash.js` + main process |

## Using MCP Providers in Your Widget

MCP providers use the `useMcpProvider` hook instead of direct credential access:

```javascript
import { useMcpProvider } from "../../hooks/useMcpProvider";

export const MyMcpWidget = (props) => {
    const { callTool, tools, isConnected, isConnecting, error } =
        useMcpProvider("slack");

    if (isConnecting) return <p>Connecting to MCP server...</p>;
    if (error) return <p>Error: {error}</p>;
    if (!isConnected) return <p>Not connected</p>;

    const handleAction = async () => {
        try {
            const result = await callTool("send_message", {
                channel: "#general",
                text: "Hello from Dash!",
            });
            console.log("Tool result:", result);
        } catch (err) {
            console.error("Tool call failed:", err.message);
        }
    };

    return (
        <div>
            <h3>Available Tools:</h3>
            <ul>
                {tools.map((tool) => (
                    <li key={tool.name}>{tool.name}</li>
                ))}
            </ul>
            <button onClick={handleAction}>Send Message</button>
        </div>
    );
};
```

**Hook return values:**

| Property       | Type     | Description                                       |
| -------------- | -------- | ------------------------------------------------- |
| `isConnected`  | boolean  | Whether the MCP server is connected               |
| `isConnecting` | boolean  | Whether connection is in progress                 |
| `error`        | string   | Error message if connection/call failed           |
| `tools`        | Array    | Available tools (filtered by `allowedTools`)      |
| `callTool`     | Function | `(toolName, args) => Promise` - call an MCP tool  |
| `resources`    | Array    | Available resources from MCP server               |
| `readResource` | Function | `(uri) => Promise` - read an MCP resource         |
| `connect`      | Function | Manually connect to the server                    |
| `disconnect`   | Function | Manually disconnect from the server               |
| `status`       | string   | Server status ("connected", "disconnected", etc.) |

## Best Practices

### 1. Provider Type Naming

-   Use lowercase kebab-case: `"slack"`, `"algolia"`, `"custom-api"`
-   Be descriptive but concise
-   Avoid version numbers (unless truly needed)

**Good:**

```javascript
type: "slack";
type: "github";
type: "custom-api";
```

**Bad:**

```javascript
type: "Slack"; // Don't use capitals
type: "api"; // Too generic
type: "slack-v2"; // Avoid version numbers
```

### 2. Required vs Optional Providers

**Use `required: true` when:**

-   The widget cannot function without the provider
-   The provider is the widget's primary purpose

**Use `required: false` when:**

-   The provider adds optional features
-   The widget has fallback behavior

```javascript
providers: [
    {
        type: "algolia",
        required: true, // Widget is a search widget, needs Algolia
        // ...
    },
    {
        type: "analytics",
        required: false, // Optional analytics tracking
        // ...
    },
];
```

### 3. Credential Security

**Always use `secret: true` for:**

-   API keys
-   Tokens
-   Passwords
-   Client secrets
-   Any sensitive authentication data

**Use `secret: false` for:**

-   URLs
-   Usernames
-   Index names
-   Non-sensitive configuration

```javascript
credentialSchema: {
    apiKey: {
        type: "text",
        secret: true,      // ✅ Encrypted
        // ...
    },
    baseUrl: {
        type: "text",
        secret: false,     // ✅ Not encrypted
        // ...
    }
}
```

### 4. Clear Instructions

Provide helpful instructions that tell users:

-   What to enter
-   Where to find the information
-   Any format requirements

**Good:**

```javascript
instructions: "Enter your Slack bot token (starts with xoxb-)";
instructions: "GitHub PAT with 'repo' and 'read:user' scopes";
instructions: "Your API base URL (e.g., https://api.example.com)";
```

**Bad:**

```javascript
instructions: "Enter token"; // Too vague
instructions: "API key"; // Not helpful
instructions: ""; // Empty
```

### 5. Sensible Defaults

If a field has a common default, document it in the instructions:

```javascript
apiUrl: {
    type: "text",
    displayName: "API URL",
    instructions: "GitHub API URL (leave blank for github.com)",
    required: false,
    secret: false
}
```

### 6. Field Naming

Use clear, standard field names:

**Good:**

```javascript
credentialSchema: {
    apiKey: { /* ... */ },
    apiSecret: { /* ... */ },
    baseUrl: { /* ... */ },
    token: { /* ... */ }
}
```

**Bad:**

```javascript
credentialSchema: {
    key: { /* ... */ },           // Too vague
    myApiKey: { /* ... */ },      // Unnecessary prefix
    THE_TOKEN: { /* ... */ }      // Wrong case
}
```

## Provider Types

### Common Provider Types

Here are some common provider types you might use:

| Type       | Purpose           | Common Credentials                         |
| ---------- | ----------------- | ------------------------------------------ |
| `slack`    | Slack integration | `token`, `workspaceUrl`                    |
| `algolia`  | Algolia search    | `appId`, `apiKey`, `indexName`             |
| `github`   | GitHub API        | `token`, `apiUrl`                          |
| `gitlab`   | GitLab API        | `token`, `apiUrl`                          |
| `jira`     | Jira integration  | `apiToken`, `baseUrl`, `email`             |
| `openai`   | OpenAI API        | `apiKey`, `organization`                   |
| `aws`      | AWS services      | `accessKeyId`, `secretAccessKey`, `region` |
| `stripe`   | Stripe payments   | `apiKey`, `webhookSecret`                  |
| `sendgrid` | Email service     | `apiKey`, `fromEmail`                      |

### Creating Custom Provider Types

You can create any provider type for your custom APIs:

```javascript
providers: [
    {
        type: "my-company-api", // Custom type
        required: true,
        credentialSchema: {
            // Define your custom fields
        },
    },
];
```

## Using Providers in Your Widget

Once configured, providers are available to your widget component through props:

```javascript
export const MyWidget = ({ selectedProviders, ...props }) => {
    // selectedProviders = { "slack": "provider-id-123" }

    // Access the selected provider ID
    const slackProviderId = selectedProviders?.slack;

    // Use the provider credentials (retrieved from secure storage)
    // Implementation details in Widget API documentation
};
```

## UI Behavior

When a widget has provider requirements:

### Before Provider Configuration

-   Widget shows a yellow ⚠️ badge in edit mode
-   Badge displays the provider type (e.g., "slack")
-   Clicking badge opens provider selector

### After Provider Configuration

-   Badge turns green ✓
-   Shows the provider name (e.g., "Production Slack")
-   Widget renders normally
-   Provider selection persists across dashboard reloads

### Optional Providers

-   Show gray ○ badge if not configured
-   Widget renders even without the provider
-   User can optionally configure for additional features

## Testing Your Provider Configuration

1. **Create a widget** with provider requirements
2. **Add widget** to a dashboard in edit mode
3. **Check the badge** appears with correct color/status
4. **Click the badge** to verify:
    - Provider selector opens
    - Credential form shows your fields
    - Field labels and instructions are clear
5. **Create a provider** with test credentials
6. **Verify** widget badge turns green
7. **Reload dashboard** to ensure selection persists

## Troubleshooting

### Badge Not Showing

-   Check `providers` is an array of objects (not strings)
-   Ensure `type`, `required`, and `credentialSchema` are present
-   Verify widget registration in ComponentManager

### Credentials Not Saved

-   Ensure `secret: true` for sensitive fields
-   Check DashboardApi is properly configured
-   Verify electron safeStorage is available

### Provider Not Available

-   Check provider is created in the dashboard
-   Verify provider `type` matches your widget's requirement
-   Ensure provider is properly registered in AppContext

## Related Documentation

-   [PROVIDER_INTEGRATION_GUIDE.md](./PROVIDER_INTEGRATION_GUIDE.md) - Architecture and integration details
-   [Widget Development Guide](./WIDGET_DEVELOPMENT.md) - General widget creation
-   [Security Best Practices](./SECURITY.md) - Credential encryption and storage

## Questions?

For questions or issues with provider configuration, check:

-   Existing provider examples in `src/Widgets/`
-   Provider components in `src/Components/Provider/`
-   Test files in `src/Components/Provider/*.stories.js`
