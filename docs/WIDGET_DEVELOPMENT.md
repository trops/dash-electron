# Widget Development & Testing Guide

This guide explains how to develop and test widgets locally in your Dash application before distributing them through the registry.

## Quick Start: Run the Application

```bash
# Install dependencies
npm install

# Start development mode (React dev server + Electron)
npm run dev
```

This opens:

-   **Electron window** with your application running
-   **React dev server** at http://localhost:3000 (hot reload enabled)
-   **DevTools** in detached window for debugging

## Developing Widgets Locally

### 1. Create a New Widget

Use the `widgetize` script to generate a new widget template. **Important:** Pass a descriptive name WITHOUT the word "Widget", as the script will append it automatically:

```bash
npm run widgetize Weather
```

This creates:

```
src/Widgets/Weather/
├── README.md
├── widgets/
│   ├── WeatherWidget.js             # React component
│   └── WeatherWidget.dash.js        # Configuration
├── contexts/
│   ├── WeatherContext.js            # Context provider
│   └── index.js
├── workspaces/
│   ├── WeatherWorkspace.js          # Workspace component
│   ├── WeatherWorkspace.dash.js     # Workspace configuration
│   └── index.js
└── index.js
```

The widget is automatically exported in `src/Widgets/index.js`.

**Naming convention:**

-   ✓ `npm run widgetize Weather` → creates `WeatherWidget.js`, `WeatherContext.js`, `WeatherWorkspace.js`
-   ✓ `npm run widgetize Clock` → creates `ClockWidget.js`, `ClockContext.js`, `ClockWorkspace.js`
-   ✗ **Avoid:** `npm run widgetize WeatherWidget` (creates `WeatherWidgetWidget.js` - redundant!)

### 2. Implement Your Widget

Edit `src/Widgets/Weather/widgets/WeatherWidget.js`:

```javascript
import { useContext } from "react";
import { Widget, Heading2, Panel } from "@trops/dash-react";
import { WeatherContext } from "../contexts";

export const WeatherWidget = ({ id, title = "Weather", ...props }) => {
    const { temperature } = useContext(WeatherContext);

    return (
        <Widget id={id} {...props}>
            <Panel>
                <Heading2>{title}</Heading2>
                <p>Temperature: {temperature}°C</p>
            </Panel>
        </Widget>
    );
};
```

### 3. Configure Your Widget

Edit `src/Widgets/Weather/widgets/WeatherWidget.dash.js`:

```javascript
import { WeatherWidget } from "./WeatherWidget";

export default {
    name: "WeatherWidget",
    component: WeatherWidget,
    canHaveChildren: false,
    workspace: "WeatherWorkspace-workspace",
    type: "widget",
    events: [],
    eventHandlers: [],
    styles: {
        backgroundColor: "bg-blue-500",
        borderColor: "border-blue-500",
    },
    // Distribution metadata (optional, but recommended)
    version: "1.0.0",
    author: "Your Name",
    downloadUrl:
        "https://github.com/yourname/weather-widget/releases/download/v1.0.0/weather-widget.zip",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Weather",
            displayName: "Widget Title",
            required: false,
        },
    },
};
```

**Note on `downloadUrl`:** Add this field before publishing to make it easy for others to install your widget. Once you publish a release to GitHub, update this URL to point to your released ZIP file. This way, the installation command becomes simple: `widget:install WeatherWidget`.

### 4. Create a Workspace (Optional)

Edit `src/Widgets/Weather/workspaces/WeatherWorkspace.js`:

```javascript
import { Workspace } from "@trops/dash-react";
import { WeatherContext } from "../contexts";

export const WeatherWorkspace = ({ children }) => {
    const contextValue = {
        temperature: 72,
    };

    return (
        <WeatherContext.Provider value={contextValue}>
            <Workspace>{children}</Workspace>
        </WeatherContext.Provider>
    );
};
```

### 4b. Configure Your Workspace

Edit `src/Widgets/Weather/workspaces/WeatherWorkspace.dash.js`:

```javascript
import { WeatherWorkspace } from "./WeatherWorkspace";

export default {
    name: "WeatherWorkspace",
    component: WeatherWorkspace,
    canHaveChildren: true,
    workspace: "WeatherWorkspace-workspace",
    type: "workspace",
};
```

### 5. Set Up Context Provider

Edit `src/Widgets/Weather/contexts/WeatherContext.js`:

```javascript
import React from "react";

export const WeatherContext = React.createContext({});
```

## Running the Application

### Development Mode

```bash
npm run dev
```

This runs:

-   React dev server with hot module reloading (HMR)
-   Electron application pointing to localhost:3000
-   DevTools for debugging both React and Electron

**When you save files:**

-   React components hot-reload in the Electron window
-   You can see changes instantly without restarting

### Production Build

```bash
npm run build
```

This:

1. Runs setup (Node.js version check, .npmrc setup)
2. Prettifies code
3. Builds CSS from Tailwind
4. Builds React for production
5. Starts dev servers
6. Launches Electron with production build

## Testing Your Widget

### In the Electron Application

1. Start the app: `npm run dev`
2. Use the Dash dashboard interface to add your widget
3. Configure widget properties through the UI
4. Test interactions and state changes

### Debugging

#### Browser DevTools

The Electron DevTools window opens automatically in development mode. Use it to:

-   Inspect React components
-   Check console for errors
-   Profile performance
-   Debug JavaScript

#### React Developer Tools

```bash
# DevTools are installed and available in the Extensions
# Use React tab in DevTools to inspect component tree
```

#### Console Logging

```javascript
// In your widget
console.log("Widget mounted!", props);
console.log("Context value:", contextValue);

// Check in DevTools console (CMD+Option+I on macOS)
```

### Hot Module Reloading (HMR)

React's HMR means:

-   Save a file → React automatically reloads that component
-   State is preserved when possible
-   No need to restart Electron
-   Super fast iteration

Example workflow:

```javascript
// Edit WeatherWidget.js
export const WeatherWidget = ({...}) => {
    return (
        <div>Updated weather!</div>  // ← Save file
    );                               // ← See change in app immediately
};
```

## Troubleshooting

### Widget Not Appearing in App

1. **Check export in index.js**

    ```bash
    cat src/Widgets/index.js | grep Weather
    # Should show: export * from './Weather';
    ```

2. **Check console for errors**

    - Open DevTools (CMD+Option+I)
    - Look for errors in console
    - Check React tab for component mounting

3. **Verify widget configuration**
    - Ensure `.dash.js` exports `default`
    - Check that `component` property points to correct React component
    - Verify `workspace` property exists

### Hot Reload Not Working

1. Restart dev servers: `npm run dev`
2. Check that React dev server is running (should see in terminal)
3. Verify file changes trigger React compilation

### Electron Window Blank

1. Check that React dev server started (should see "webpack compiled successfully")
2. Open DevTools to check for errors
3. Restart with `npm run dev`

### ComponentManager Not Registering Widget

1. Verify widget is exported in `src/Widgets/index.js`
2. Check that `widgetize` script ran successfully
3. Look at `src/Dash.js` - it auto-registers all exported widgets

## Example: Complete Widget Development Cycle

```bash
# 1. Create widget (use name without 'Widget' suffix)
npm run widgetize Weather

# 2. Start development
npm run dev

# 3. Edit the widget files
# src/Widgets/Weather/widgets/WeatherWidget.js
# src/Widgets/Weather/widgets/WeatherWidget.dash.js
# src/Widgets/Weather/workspaces/WeatherWorkspace.js

# 4. See changes in Electron window immediately (HMR)

# 5. Add widget to dashboard in UI

# 6. Test interactions, styling, state

# 7. When satisfied, package for distribution
# (see WIDGET_REGISTRY.md for distribution)
```

## Next Steps

Once your widget is working locally:

1. **Create a repository** for your widget
2. **Package as ZIP** from your src/Widgets/Weather folder
3. **Upload to distribution** (GitHub releases, custom server, etc.)
4. **Share the download URL** so others can install via the registry

See [WIDGET_REGISTRY.md](./WIDGET_REGISTRY.md) for distribution instructions.
