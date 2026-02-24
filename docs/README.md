# Documentation Index

Complete guide to all documentation in this project.

## For New Developers

Start here if you're new to Dash:

1. **[QUICK_START.md](./QUICK_START.md)** ⭐

    - Quick commands and reference
    - Getting started in 5 minutes
    - Common tasks and troubleshooting

2. **[WIDGET_SYSTEM.md](./WIDGET_SYSTEM.md)**

    - Complete system overview
    - Architecture and concepts
    - How everything connects

3. **[WIDGET_DEVELOPMENT.md](./WIDGET_DEVELOPMENT.md)**
    - Detailed development guide
    - Step-by-step widget creation
    - Testing and debugging

## For Widget Development

### Creating Widgets Locally

```bash
npm run widgetize MyWidget    # Create widget
npm run dev                   # Start dev server
# Edit files and see changes immediately
```

See [WIDGET_DEVELOPMENT.md](./WIDGET_DEVELOPMENT.md) for:

-   Creating new widgets
-   Testing locally
-   Using hot reload
-   Debugging with DevTools
-   Configuration options

### Testing Widgets

```bash
npm run test:widgets          # Run widget system tests
```

## For Widget Distribution

### Publishing Your Widget

1. Create a repository with your widget
2. Push to GitHub and create a release with ZIP
3. Share the download URL with others

See [WIDGET_REGISTRY.md](./WIDGET_REGISTRY.md) for:

-   Complete distribution workflow
-   Widget storage locations
-   Installation by end users
-   Registry system details

### Example Code

See [WIDGET_REGISTRY_EXAMPLE.js](./WIDGET_REGISTRY_EXAMPLE.js) for:

-   Complete working examples
-   Main process setup
-   Renderer process usage
-   Full integration pattern

## Documentation Map

```
docs/
├── QUICK_START.md                    ← Start here! (5 min read)
├── WIDGET_SYSTEM.md                  ← Architecture overview
├── WIDGET_DEVELOPMENT.md             ← How to create widgets
├── WIDGET_REGISTRY.md                ← Distribution system
├── WIDGET_REGISTRY_EXAMPLE.js        ← Code examples
└── README.md (this file)              ← You are here
```

## Quick Navigation

### I want to...

| Goal                   | See                                                        |
| ---------------------- | ---------------------------------------------------------- |
| Get started quickly    | [QUICK_START.md](./QUICK_START.md)                         |
| Create a new widget    | [WIDGET_DEVELOPMENT.md](./WIDGET_DEVELOPMENT.md)           |
| Test my widget locally | [WIDGET_DEVELOPMENT.md](./WIDGET_DEVELOPMENT.md)           |
| Distribute my widget   | [WIDGET_REGISTRY.md](./WIDGET_REGISTRY.md)                 |
| See code examples      | [WIDGET_REGISTRY_EXAMPLE.js](./WIDGET_REGISTRY_EXAMPLE.js) |
| Understand the system  | [WIDGET_SYSTEM.md](./WIDGET_SYSTEM.md)                     |
| Run tests              | [QUICK_START.md](./QUICK_START.md#testing)                 |

## Key Concepts

### Widgets

Self-contained UI components with configuration and context

### Workspaces

Containers that provide data/dependencies to child widgets via Context

### ComponentManager

Built-in registry that makes widgets available in the dashboard

### Hot Module Reloading (HMR)

Changes to files automatically reload in the running app without restart

### Widget Registry

System for downloading and installing distributed widgets

## Most Important Commands

```bash
npm run dev              # Start development (MOST IMPORTANT)
npm run widgetize NAME   # Create new widget
npm run test:widgets     # Test the system
npm run build            # Build for production
```

## Key Files

| File                              | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `src/Widgets/`                    | All widgets (local development)         |
| `src/Widgets/*/widgets/*.js`      | Widget React components                 |
| `src/Widgets/*/widgets/*.dash.js` | Widget configurations                   |
| `src/Dash.js`                     | App entry point, auto-registers widgets |
| `.env`                            | Environment variables                   |
| `public/electron.js`              | Electron main process                   |

## File Organization

```
project/
├── src/
│   ├── Widgets/                       ← Where you create widgets
│   │   ├── MyFirstWidget/             (Example)
│   │   ├── MyNewWidget/               (Create with widgetize)
│   │   └── index.js                   (Auto-exports all)
│   ├── Dash.js                        (Registers widgets)
│   └── ...
├── public/
│   ├── electron.js                    (Electron main)
│   └── lib/                           (Backend APIs)
├── scripts/
│   ├── widgetize.js                   (Create widget script)
│   └── testWidgetIntegration.js       (Test script)
├── docs/                              (Documentation - you are here)
└── package.json
```

## Development Workflow

```
1. Create Widget
   npm run widgetize MyWidget

2. Start Development
   npm run dev

3. Edit Files
   - src/Widgets/MyWidget/widgets/MyWidget.js
   - src/Widgets/MyWidget/widgets/MyWidget.dash.js
   - (Auto-reloads in app)

4. Test in App
   - Add widget to dashboard in UI
   - Interact with widget
   - Check DevTools for errors

5. Distribute (Optional)
   - Create git repo
   - Push to GitHub
   - Create release with ZIP
   - Share download URL
```

## Getting Help

1. **Quick question?** Check [QUICK_START.md](./QUICK_START.md#troubleshooting)
2. **Stuck on setup?** Run `npm run setup` and check `.env` file
3. **Widget not working?** Open DevTools (CMD+Option+I) and check console
4. **Need examples?** Look at `src/Widgets/MyFirstWidget/`
5. **Want full details?** Read [WIDGET_SYSTEM.md](./WIDGET_SYSTEM.md)

## Common Issues

### Widget Not Appearing

-   Check `src/Widgets/index.js` has the export
-   Restart `npm run dev`
-   Check DevTools console for errors

### Hot Reload Not Working

-   Restart `npm run dev`
-   Check React dev server is running

### Build Fails

-   Check Node.js version: `node -v` (needs 18, 20, or 22)
-   Run `npm run setup` to install dependencies

### Can't Install Packages

-   Run `npm run setup` to regenerate `.npmrc`
-   Check Node.js version: `node -v` (needs 18, 20, or 22)

## Next Steps

1. ✅ **Read** [QUICK_START.md](./QUICK_START.md) (5 minutes)
2. ✅ **Run** `npm run dev` to start development
3. ✅ **Create** your first widget with `npm run widgetize MyWidget`
4. ✅ **Edit** widget files and see changes instantly
5. ✅ **Read** [WIDGET_REGISTRY.md](./WIDGET_REGISTRY.md) when ready to share

Happy coding! 🚀
