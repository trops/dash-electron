# Quick Reference: Widget Development Commands

## Getting Started

```bash
# One-time setup
npm install
npm run setup

# Start developing
npm run dev
```

Opens Electron app at http://localhost:3000 with hot reload enabled.

## Creating & Managing Widgets

```bash
# Create a new widget
npm run widgetize MyWidgetName

# This creates:
# src/Widgets/MyWidgetName/
#   ├── widgets/
#   │   ├── MyWidgetName.js              (React component)
#   │   └── MyWidgetName.dash.js         (Configuration)
#   └── contexts/
#       └── MyWidgetNameContext.js       (Context provider)
```

## Installing Widgets (Runtime)

```javascript
// Install using downloadUrl from widget config
await window.electron.invoke("widget:install", "Weather");

// Install from a specific URL
await window.electron.invoke(
    "widget:install",
    "Weather",
    "https://github.com/yourname/weather-widget/releases/download/v1.0.0/weather-widget.zip"
);

// Install from a local ZIP or folder path
await window.electron.invoke(
    "widget:install",
    "Weather",
    "/Users/you/widgets/weather-widget.zip"
);

// Drop-in folder (each subfolder = widget)
await window.electron.invoke("widget:load-folder", "/Users/you/DashWidgets");
```

## File Locations

```
src/Widgets/                              # Local widgets
├── MyFirstWidget/                        # Example widget
├── MyNewWidget/                          # Your new widget
└── index.js                              # Auto-exports all widgets

public/electron.js                        # Electron main process
public/lib/                               # Backend APIs & controllers
```

## Development Workflow

```bash
# 1. Create widget
npm run widgetize WeatherWidget

# 2. Start app
npm run dev

# 3. Edit files
# Files auto-reload in app (HMR)
# - src/Widgets/WeatherWidget/widgets/WeatherWidget.js
# - src/Widgets/WeatherWidget/widgets/WeatherWidget.dash.js

# 4. Test in app
# Add widget to dashboard in UI
# Interact with widget
# Check console for errors

# 5. Build for distribution (when ready)
npm run build
```

## Debugging

```bash
# DevTools automatically opens in development mode
# Or press: CMD + Option + I (macOS)
#          CTRL + Shift + I (Windows/Linux)

# React Components tab: Inspect component tree
# Console tab: View console.log() messages
# Network tab: Monitor API calls
```

## Important Files

| File                              | Purpose                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `src/Dash.js`                     | App entry point, registers all widgets with ComponentManager |
| `src/Widgets/*/widgets/*.dash.js` | Widget configuration & metadata                              |
| `src/Widgets/*/widgets/*.js`      | Widget React component                                       |
| `.env`                            | Environment variables (app ID, signing credentials, etc.)    |
| `package.json`                    | Dependencies & npm scripts                                   |

## Widget Configuration (.dash.js)

Essential properties:

```javascript
export default {
    name: "WidgetName", // Must match component name
    component: WidgetComponent, // React component
    canHaveChildren: false, // Can contain other widgets
    workspace: "WidgetNameWorkspace", // Widget group identifier
    type: "widget", // Type identifier
    styles: {
        // Tailwind classes
        backgroundColor: "bg-blue-500",
        borderColor: "border-blue-500",
    },
    userConfig: {
        // User-configurable properties
        title: {
            type: "text",
            defaultValue: "Default Title",
            displayName: "Widget Title",
        },
    },
    events: [], // Events published by widget
    eventHandlers: [], // Events this widget handles
};
```

## Useful Scripts

```bash
npm run dev              # Start development (Electron + React dev server)
npm run build            # Production build
npm run widgetize NAME   # Create new widget
npm run rebuild          # Rebuild native modules
npm run test:widgets     # Test widget system
npm run prettify         # Format code
```

## Common Tasks

### Check if widget is registered

```bash
# Look in browser DevTools console
# ComponentManager should list your widget
# Or check src/Widgets/index.js for export
```

### Find widget in ComponentManager

```javascript
// In DevTools console
const map = ComponentManager.map();
console.log(map["MyWidgetName"]);
```

### Test widget configuration loads

```bash
npm run test:widgets
```

## Troubleshooting

| Problem                | Solution                                                      |
| ---------------------- | ------------------------------------------------------------- |
| Widget not appearing   | Check `src/Widgets/index.js` has export, restart app          |
| Hot reload not working | Restart `npm run dev`                                         |
| Console errors         | Check DevTools console (CMD+Option+I)                         |
| Build fails            | Check Node.js version: `node -v` (should be v18, v20, or v22) |
| Can't install deps     | Run `npm run setup` first                                     |

## Next Steps

-   Explore existing widgets in `src/Widgets/MyFirstWidget/`
-   Read full guides in `docs/` folder:
    -   `WIDGET_DEVELOPMENT.md` - Detailed development guide
    -   `WIDGET_REGISTRY.md` - Distributing widgets
    -   `WIDGET_REGISTRY_EXAMPLE.js` - Code examples

## Need Help?

-   Check the documentation in `docs/` folder
-   Run `npm run test:widgets` to verify setup
-   Check `package.json` for available scripts
-   Review existing widget examples in `src/Widgets/`
