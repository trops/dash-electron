# Dash - Electron Dashboard Framework

Dash is an Electron-based dashboard application framework built with React. It provides a **Workspace** and **Widget** system with dependency injection, theming, and a provider system for managing external service integrations.

## About Dash

Dash enables you to:

-   Build customizable dashboards with a widget-based architecture
-   Create reusable widgets and workspaces with hot reload support during development
-   Manage external service credentials securely through the provider system
-   Use dependency injection to pass context and functionality through component hierarchy
-   Distribute widgets as npm packages to other Dash projects

**Example dashboards you can build:**

-   Algolia Search Interface
-   Google Drive Explorer
-   Contentful Content Manager
-   Slack Integration Dashboard
-   AI/ChatGPT Interface

## Requirements

-   **Node.js**: v18, v20, or v22 (LTS versions recommended)
    -   **Note**: Node.js v24+ has breaking changes and is not compatible
    -   Recommendation: Use [nvm](https://github.com/nvm-sh/nvm) for version management
-   **Python 3**: Required for node-gyp native module compilation
-   **XCode**: Required for packaging Electron applications (Electron Forge)
-   **npm**: For installing dependencies and running scripts

Dash uses the [@trops/dash-react](https://github.com/trops/dash-react) library for UI components.

## Installation

### Step 1: Node.js Setup

Verify you have a compatible Node.js version:

```bash
node -v  # Should show v18.x, v20.x, or v22.x
```

If needed, install/switch Node.js versions:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc

# Install and use Node.js v20
nvm install 20
nvm use 20
nvm alias default 20
```

### Step 2: Environment Configuration

1. Create a `.env` file in the project root (copy from `.env.default`):

    ```bash
    cp .env.default .env
    ```

2. Edit `.env` and set any environment variables needed (e.g., Apple signing credentials for packaging).

### Step 3: Install Dependencies

```bash
npm run setup
```

This installs the main application and dash-react dependencies.

## Quick Start

### Development Mode

Start the development environment with hot reload:

```bash
npm run dev
```

This launches:

-   **React dev server** at http://localhost:3000 with hot module reloading
-   **Electron application** connected to the dev server
-   **DevTools** for debugging

Any file changes automatically reload without restarting the app.

### Production Build

Create an optimized production build:

```bash
npm run build
```

## Documentation

For comprehensive guides, see [docs/INDEX.md](./docs/INDEX.md):

**Getting Started:**

-   [Quick Start](./docs/QUICK_START.md) - Commands, workflows, and troubleshooting
-   [Development Workflow](./docs/DEVELOPMENT_WORKFLOW.md) - Development workflow and best practices

**Core Framework (widget system, providers, MCP):**

For complete widget system, provider architecture, and widget API documentation, see [@trops/dash-core](https://github.com/trops/dash-core):

-   [Widget System](https://github.com/trops/dash-core/blob/master/docs/WIDGET_SYSTEM.md) - Architecture and how Dash works
-   [Widget Development](https://github.com/trops/dash-core/blob/master/docs/WIDGET_DEVELOPMENT.md) - Create and test widgets
-   [Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md) - Provider system architecture

**UI Library:**

-   [dash-react README](../dash-react/README.md) - Component library documentation

## Package Scripts

Essential npm commands for development and distribution:

| Command                          | Description                                                              |
| -------------------------------- | ------------------------------------------------------------------------ |
| `npm run setup`                  | Install dependencies and dash-react                                      |
| `npm run dev`                    | Start dev server with hot reload and Electron                            |
| `npm run build`                  | Create production build                                                  |
| `npm run package-widgets`        | Bundle widgets for distribution                                          |
| `npm run package`                | Create Mac .dmg distributable (requires XCode & Apple Developer account) |
| `npm run widgetize <WidgetName>` | Generate widget scaffold in src/Widgets                                  |

## Widget Development

Widgets are the core building blocks of Dash dashboards. Each widget consists of:

1. **Widget Component** - React component that renders the widget UI
2. **Widget Configuration** - `.dash.js` file describing the widget metadata
3. **Workspace** - Container that hosts related widgets
4. **Contexts** (optional) - Shared state and functionality for widgets

### Creating a New Widget

#### Using the Scaffold Generator

The easiest way to create a widget:

```bash
node ./scripts/widgetize MyWidget
```

This creates:

```
src/Widgets/MyWidget/
├── widgets/
│   ├── MyWidget.js          # Widget component
│   └── MyWidget.dash.js     # Widget configuration
├── workspaces/
│   ├── MyWidgetWorkspace.js # Workspace component
│   └── MyWidgetWorkspace.dash.js
└── index.js                  # Exports
```

### Widget Configuration (.dash.js)

Define widget metadata and user-configurable options:

```javascript
// MyWidget.dash.js
import { MyWidget } from "./MyWidget";

export default {
    component: MyWidget,
    canHaveChildren: false,
    workspace: "my-cool-workspace-name",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "My Widget",
            instructions: "Widget title displayed to user",
            displayName: "Title",
            required: true,
        },
        subtitle: {
            type: "text",
            defaultValue: "Subtitle",
            displayName: "Subtitle",
        },
    },
};
```

### Workspace Configuration

Workspaces are containers for widgets:

```javascript
// MyWidgetWorkspace.dash.js
import { MyWidgetWorkspace } from "./MyWidgetWorkspace";

export default {
    component: MyWidgetWorkspace,
    canHaveChildren: true,
    workspace: "my-cool-workspace-name",
    type: "workspace",
};
```

### Widget Example

A simple widget that uses user configuration and the widget API:

```javascript
// MyWidget.js
import { Widget, Panel, Heading, SubHeading } from "@dash/Common";

export const MyWidget = ({
    title = "Hello",
    subtitle = "I'm a widget",
    api,
    ...props
}) => {
    const handleSaveData = () => {
        const data = { timestamp: Date.now(), title };
        api.storeData(data);
    };

    return (
        <Widget {...props}>
            <Panel>
                <Heading text={title} />
                <SubHeading text={subtitle} />
                <button onClick={handleSaveData}>Save Data</button>
            </Panel>
        </Widget>
    );
};
```

### Widget Communication

#### Publishing Events

Widgets communicate via publish/subscribe:

```javascript
// Publish an event
api.publishEvent("user-searched", { query: "my search" });
```

#### Listening for Events

Set up listeners in workspace configuration or in the widget:

```javascript
// Register event listeners
api.registerListeners(
    ["user-searched"], // Events to listen for
    {
        "user-searched": (payload) => {
            console.log("User searched:", payload.query);
        },
    }
);
```

### Widget Data Storage

Store and retrieve data using the widget API:

```javascript
// Store data (auto-saved to Electron app)
api.storeData({
    searchHistory: ["query1", "query2"],
    preferences: { theme: "dark" },
});

// Read data
api.readData({
    callbackComplete: (data) => {
        console.log("Loaded data:", data);
    },
    callbackError: (error) => {
        console.error("Failed to load data:", error);
    },
});
```

### Using Contexts for Dependency Injection

Share functionality across widgets using React Context:

```javascript
// MyWidgetContext.js
import React from "react";

export const MyWidgetContext = React.createContext();

// MyWidgetWorkspace.js - Provider
import { useGoogleMaps } from "./hooks/useGoogleMaps";
import { MyWidgetContext } from "./MyWidgetContext";

export const MyWidgetWorkspace = ({ children }) => {
    const googleMaps = useGoogleMaps(); // Initialize API client

    return (
        <MyWidgetContext.Provider value={{ googleMaps }}>
            {children}
        </MyWidgetContext.Provider>
    );
};

// MyWidget.js - Consumer
import { useContext } from "react";
import { MyWidgetContext } from "../MyWidgetContext";

export const MyMapWidget = (props) => {
    const { googleMaps } = useContext(MyWidgetContext);

    return <div>{/* Use googleMaps client */}</div>;
};
```

## Available Components

The [dash-react](../dash-react/) library provides UI components:

**Layout Components:**

-   `Panel`, `DashPanel` - Card/container components
-   `Container`, `LayoutContainer` - Layout helpers
-   `Header`, `SubHeader`, `Footer`
-   `MainLayout`, `MainSection`, `MainContent`
-   `Workspace`, `Widget` - Widget containers

**Interactive Components:**

-   `Button`, `ButtonIcon` - Action buttons
-   `Menu`, `MenuItem` - Menus and navigation
-   `Toggle` - Toggle switches
-   `Modal` - Modal dialogs
-   `Notification` - Alert notifications
-   `SlidePanelOverlay` - Side panel overlay
-   `Tag` - Labels and tags

**Form & Input:**

-   `Form` - Form utilities
-   `CodeEditor`, `CodeRenderer` - Code input/display

**Utilities:**

-   `ErrorBoundary`, `ErrorMessage` - Error handling
-   `Text` - Typography helpers
-   `Draggable` - Drag-and-drop support

See [dash-react documentation](../dash-react/README.md#component-overview) for full reference.

## Distributing Widgets

### Publishing as npm Package

1. Update `package.json` with widget name and version
2. Bundle widgets:
    ```bash
    npm run package-widgets
    ```
3. Version bump:
    ```bash
    npm version patch
    ```
4. Push to repository:
    ```bash
    git push origin master
    ```

A GitHub workflow automatically publishes the package.

### Using External Widget Packages

In your main Dash component, import and register external widgets:

```javascript
import * as MyWidgets from "@your-org/my-widgets-package/dist";

Object.keys(MyWidgets).forEach((widgetName) => {
    ComponentManager.registerWidget(MyWidgets[widgetName], widgetName);
});
```

## Packaging for Distribution

### Mac .dmg File

Create a distributable Mac application:

1. Set up Apple Developer account with code signing certificates
2. Create Application-Specific Password in Apple website
3. Install and configure XCode
4. Set environment variables in `.env`
5. Build the package:

    ```bash
    npm run package
    ```

    This creates an `/out/make/[YourApp].dmg` file

6. Notarize with Apple (required for distribution):
    ```bash
    npm run apple-notarize
    npm run apple-staple
    ```

## Updating from Template Repository

To merge updates from the official [dash-electron](https://github.com/trops/dash-electron) template:

```bash
# Add remote if not exists
git remote add template https://github.com/trops/dash-electron

# Fetch and verify
git remote -v
git fetch template

# Merge changes
git checkout master
git merge template/master
```

## Advanced Topics

For detailed information on advanced topics, see the documentation:

-   **Hot Module Reloading** - See [DEVELOPMENT_WORKFLOW.md](./docs/DEVELOPMENT_WORKFLOW.md)
-   **Widget Registry** - See [WIDGET_REGISTRY.md](./docs/WIDGET_REGISTRY.md)
-   **Provider System** - See [PROVIDER_API_SETUP.md](./docs/PROVIDER_API_SETUP.md)
-   **Web-based Dashboards** - The @trops/dash-react package can be used in React web apps with minimal adaptation

## Troubleshooting

For common issues and solutions, see [QUICK_START.md](./docs/QUICK_START.md).

## Contact & Support

For questions or support, please [open an issue](https://github.com/trops/dash/issues) on GitHub.

## Contributing & Future

Planned improvements:

-   Pre-compiled dashboard configurations for distribution
-   Streamlined Apple notarization process
-   GitHub Actions for automated widget package creation
-   Web-based (non-Electron) dashboard support

---

**Learn more:** [Full Documentation Index](./docs/INDEX.md) | [dash-react Library](../dash-react/)
