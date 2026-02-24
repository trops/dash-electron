# Widget System Architecture & Developer Guide

Complete overview of how widgets work in Dash and how to develop them.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Workflow                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. CREATE                    2. DEVELOP                     │
│  ┌────────────────────┐      ┌───────────────────────┐      │
│  │ npm run widgetize  │      │ npm run dev           │      │
│  │ MyNewWidget        │─────→│ (Hot reload)          │      │
│  └────────────────────┘      │ Edit files & test     │      │
│                              └───────────────────────┘      │
│                                        │                    │
│                                        ↓                    │
│  3. DISTRIBUTE                4. END USERS INSTALL          │
│  ┌────────────────────┐      ┌───────────────────────┐      │
│  │ Package as ZIP     │      │ Via widget registry   │      │
│  │ Create repo/release│─────→│ npm run dev           │      │
│  │ Share download URL │      │ Marketplace UI        │      │
│  └────────────────────┘      └───────────────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Widgets

-   React components that render UI
-   Defined in `src/Widgets/*/widgets/*.js`
-   Receive props from configuration

### Configuration (.dash.js)

-   Metadata about the widget
-   User-configurable properties
-   Events and handlers
-   Associated workspace
-   Defined in `src/Widgets/*/widgets/*.dash.js`

### Workspaces

-   Container for widgets
-   Provides context/dependencies to child widgets
-   Defined in `src/Widgets/*/workspaces/*.js`

### Contexts

-   React Context providers
-   Share data with widgets
-   Defined in `src/Widgets/*/contexts/*.js`

### ComponentManager

-   Built-in registry from `@trops/dash-react`
-   Auto-registers all widgets from `src/Widgets/`
-   Makes widgets available in the dashboard UI

## File Structure

```
src/Widgets/
├── MyFirstWidget/                    (Example)
│   ├── README.md
│   ├── widgets/
│   │   ├── MyFirstWidget.js          ← React component
│   │   └── MyFirstWidget.dash.js     ← Configuration
│   ├── contexts/
│   │   └── MyFirstWidgetContext.js
│   └── workspaces/
│       └── MyFirstWidget.js
│
├── MyNewWidget/                      (Created by widgetize)
│   ├── README.md
│   ├── widgets/
│   │   ├── MyNewWidget.js
│   │   └── MyNewWidget.dash.js
│   ├── contexts/
│   │   └── MyNewWidgetContext.js
│   └── workspaces/
│       └── MyNewWidget.js
│
└── index.js                          ← Auto-exports all widgets
```

## Local Development Process

### Step 1: Create Widget

```bash
npm run widgetize MyAwesomeWidget
```

### Step 2: Start Development Server

```bash
npm run dev
```

Starts:

-   **React Dev Server** (http://localhost:3000) - Hot module reloading
-   **Electron App** - Renders dev server
-   **DevTools** - For debugging

### Step 3: Edit Files

-   `src/Widgets/MyAwesomeWidget/widgets/MyAwesomeWidget.js` - Component logic
-   `src/Widgets/MyAwesomeWidget/widgets/MyAwesomeWidget.dash.js` - Configuration

### Step 4: Test Immediately

-   Changes auto-reload in app
-   No restart needed
-   Test in dashboard UI

### What Happens When You Save:

```javascript
// File: src/Widgets/MyAwesomeWidget/widgets/MyAwesomeWidget.js
export const MyAwesomeWidget = ({ title }) => {
    return <div>{title}</div>; // ← Save this
};
```

1. Webpack detects file change
2. Recompiles React component
3. HMR module is injected
4. Electron receives update
5. Component re-renders in app
6. **Total time**: ~1 second

## Auto-Registration Process

When you `npm run dev`:

1. `src/Dash.js` imports all widgets from `src/Widgets/index.js`
2. `src/Widgets/index.js` auto-exports all created widgets
3. `src/Dash.js` loops through and calls:
    ```javascript
    Object.keys(myWidgets).forEach((w) => {
        ComponentManager.registerWidget(myWidgets[w], w);
    });
    ```
4. ComponentManager stores widget in its internal map
5. Dashboard UI can now show and use the widget

## Available During Development

### Hot Module Reloading (HMR)

-   React component changes reload instantly
-   State preserved when possible
-   No full app restart

### DevTools

```
CMD + Option + I  (macOS)
CTRL + Shift + I  (Windows/Linux)
```

Features:

-   Inspect React components
-   View console.log() output
-   Debug JavaScript
-   Check network requests
-   Profile performance

### Console Logging

```javascript
// In your widget
console.log("Widget props:", props);
console.log("Context:", context);

// View in DevTools console
```

## Testing Workflow

### Unit Test: Widget System

```bash
npm run test:widgets
```

Verifies:

-   Widget discovery
-   Configuration loading
-   Caching behavior
-   File paths

### Integration Test: In Application

1. Start: `npm run dev`
2. Create widget: `npm run widgetize TestWidget`
3. Edit widget files
4. Add widget to dashboard in UI
5. Interact with widget
6. Check console for errors

### Debugging

1. Open DevTools (CMD+Option+I)
2. Go to **React** tab (if React DevTools installed)
3. Find your component in tree
4. Click component to inspect
5. View props and state
6. Edit props to test behavior

## Configuration Reference

### Widget Configuration Structure

```javascript
export default {
    // Identity
    name: "MyWidget", // Must match component export
    component: MyWidget, // React component
    type: "widget", // "widget" | "workspace"

    // Hierarchy
    canHaveChildren: false, // Can contain other widgets?
    workspace: "MyWidgetWorkspace", // Parent workspace

    // Styling
    styles: {
        backgroundColor: "bg-blue-500", // Tailwind classes
        borderColor: "border-blue-500",
    },

    // User Configuration
    userConfig: {
        title: {
            type: "text", // text | number | select | etc
            defaultValue: "Default",
            displayName: "Widget Title", // Label in UI
            instructions: "Enter title",
            required: false,
        },
    },

    // Event System
    events: [], // Events this widget publishes
    eventHandlers: [], // Events this widget handles
};
```

## Common Development Tasks

### Create & Test New Widget

```bash
npm run widgetize WeatherWidget
npm run dev
# Edit src/Widgets/WeatherWidget/widgets/WeatherWidget.js
# See changes in app automatically
```

### Use Context in Widget

```javascript
// contexts/WeatherWidgetContext.js
export const WeatherWidgetContext = React.createContext({});

// widgets/WeatherWidget.js
import { WeatherWidgetContext } from "../contexts";

export const WeatherWidget = (props) => {
    const { weatherData } = useContext(WeatherWidgetContext);
    return <div>{weatherData.temp}</div>;
};

// workspaces/WeatherWidget.js
import { WeatherWidgetContext } from "../contexts";

export const WeatherWidgetWorkspace = ({ children }) => {
    const value = { weatherData: { temp: 72 } };
    return (
        <WeatherWidgetContext.Provider value={value}>
            {children}
        </WeatherWidgetContext.Provider>
    );
};
```

### Add User Configuration

```javascript
// widgets/MyWidget.dash.js
export default {
    userConfig: {
        color: {
            type: "select",
            defaultValue: "blue",
            displayName: "Color",
            options: [
                { value: "blue", displayName: "Blue" },
                { value: "red", displayName: "Red" },
                { value: "green", displayName: "Green" },
            ],
        },
    },
};

// widgets/MyWidget.js
export const MyWidget = ({ color = "blue" }) => {
    return <div className={`bg-${color}-500`}>Widget</div>;
};
```

## Distribution

Once your widget works locally:

1. **Create repository**

    ```bash
    git init
    git add .
    git commit -m "Initial widget"
    git remote add origin https://github.com/yourname/my-widget.git
    git push -u origin main
    ```

2. **Create release**

    - Push to GitHub
    - Create release with ZIP of widget folder
    - Share the download URL

3. **Share with others**
    - Users run: `await window.electron.invoke('widget:install', 'MyWidget', 'your-download-url')`
    - Widget appears in their app
    - They can add it to their dashboards

See [WIDGET_REGISTRY.md](./WIDGET_REGISTRY.md) for full distribution details.

## Troubleshooting Development

### Widget not appearing in app

1. Check DevTools console for errors
2. Verify export in `src/Widgets/index.js`
3. Restart: `npm run dev`

### Hot reload not working

1. Check React dev server logs
2. Verify file changes compile
3. Restart: `npm run dev`

### "MyWidget is not a function" error

-   Check that component is a valid React component
-   Verify export: `export const MyWidget = () => {...}`
-   Not: `export default MyWidget`

### Can't install dependencies

-   Run: `npm run setup`
-   Check Node.js version: `node -v` (should be 18, 20, or 22)
-   Check `.npmrc` has `@trops:registry=https://npm.pkg.github.com`

## Quick Reference

| Task                   | Command                        |
| ---------------------- | ------------------------------ |
| Create widget          | `npm run widgetize WidgetName` |
| Start development      | `npm run dev`                  |
| Test widget system     | `npm run test:widgets`         |
| Build for production   | `npm run build`                |
| Format code            | `npm run prettify`             |
| Rebuild native modules | `npm run rebuild`              |

## Resources

-   **Quick Start**: [QUICK_START.md](./QUICK_START.md)
-   **Development Guide**: [WIDGET_DEVELOPMENT.md](./WIDGET_DEVELOPMENT.md)
-   **Distribution**: [WIDGET_REGISTRY.md](./WIDGET_REGISTRY.md)
-   **Examples**: [WIDGET_REGISTRY_EXAMPLE.js](./WIDGET_REGISTRY_EXAMPLE.js)
-   **Source Code**: `src/Widgets/MyFirstWidget/` (complete example)
