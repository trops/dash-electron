# Visual Development Workflow

## Complete Developer Journey

```
┌──────────────────────────────────────────────────────────────────┐
│                     DEVELOPER JOURNEY                             │
└──────────────────────────────────────────────────────────────────┘

PHASE 1: SETUP
┌─────────────┐
│   npm run   │  Installs dependencies, checks Node.js version
│   setup     │  Sets up .npmrc file, creates Widgets folder
└──────┬──────┘
       │
       ↓

PHASE 2: DEVELOPMENT
┌──────────────────────────────────────────────────────────────────┐
│                  npm run dev                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ React Dev Server (Port 3000)                                 │ │
│  │ - Webpack watches file changes                               │ │
│  │ - Hot Module Reload enabled                                  │ │
│  │ - Fast recompilation                                         │ │
│  └─────────────────────────────────────────────────────────────┬─ │
│                                                                  │  │
│  ┌─────────────────────────────────────────────────────────────┘  │
│  │                                                                  │
│  │  Electron App (Window)                                         │
│  │  ┌────────────────────────────────────────────────────────┐   │
│  │  │ Loads: http://localhost:3000                           │   │
│  │  │ Renders: React components from dev server              │   │
│  │  │ DevTools: Attached (CMD+Option+I)                      │   │
│  │  └────────────────────────────────────────────────────────┘   │
│  │                                                                  │
│  │  React DevTools Inspector                                      │
│  │  ┌────────────────────────────────────────────────────────┐   │
│  │  │ Components tab: Inspect component tree                 │   │
│  │  │ Console: View console.log() messages                   │   │
│  │  │ Network: Monitor API requests                          │   │
│  │  └────────────────────────────────────────────────────────┘   │
│  │                                                                  │
└──────────────────────────────────────────────────────────────────┘
       │
       │ User edits widget file
       ↓

PHASE 3: FILE CHANGE DETECTION
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  Developer saves file                                            │
│  ├─ src/Widgets/MyWidget/widgets/MyWidget.js                    │
│  └─ src/Widgets/MyWidget/widgets/MyWidget.dash.js               │
│       │                                                            │
│       ↓                                                            │
│  Webpack detects change                                          │
│  │                                                                │
│  ├─ Recompiles affected modules                                 │
│  ├─ Creates HMR update bundle                                   │
│  └─ Sends to dev server                                         │
│       │                                                            │
│       ↓                                                            │
│  Browser receives update                                         │
│  │                                                                │
│  ├─ Downloads HMR bundle                                        │
│  ├─ Replaces old module with new                                │
│  ├─ Re-renders affected components                              │
│  └─ Preserves state when possible                               │
│       │                                                            │
│       ↓                                                            │
│  App updates instantly (1-2 seconds)                            │
│  │                                                                │
│  └─ Developer sees changes in Electron window                   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
       │
       │ (Loop back to Phase 3 as needed)
       │
       ↓

PHASE 4: TESTING IN APP
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  1. Widget is automatically registered with ComponentManager    │
│     └─ Because src/Widgets/index.js exports it                  │
│                                                                   │
│  2. Dashboard UI shows widget in available widgets list         │
│                                                                   │
│  3. Developer adds widget to workspace                          │
│                                                                   │
│  4. Widget renders in Electron window                           │
│                                                                   │
│  5. Developer interacts with widget                             │
│     ├─ Clicks buttons                                            │
│     ├─ Enters configuration                                      │
│     └─ Tests interactions                                        │
│                                                                   │
│  6. Check DevTools console for errors                           │
│     └─ CMD+Option+I on macOS                                     │
│                                                                   │
│  7. Widget works? Go to Phase 5                                 │
│     Widget broken? Edit files (back to Phase 3)                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
       │
       │ When ready to share
       ↓

PHASE 5: DISTRIBUTION (OPTIONAL)
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  1. Create Git repository                                        │
│     └─ git init && git push to GitHub                            │
│                                                                   │
│  2. Create Release with ZIP                                     │
│     └─ GitHub release with widget folder as ZIP                 │
│                                                                   │
│  3. Share download URL                                          │
│     ├─ https://github.com/yourname/my-widget/releases/...      │
│     └─ Others can install with one line                         │
│                                                                   │
│  4. Others install: (in their Dash app)                        │
│     └─ await window.electron.invoke('widget:install',           │
│        'MyWidget', 'your-download-url')                         │
│                                                                   │
│  5. Widget appears in their app!                                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Side-by-side: Development Loop

```
┌─────────────────────────────┬─────────────────────────────┐
│      WHAT DEVELOPER DOES    │     WHAT SYSTEM DOES        │
├─────────────────────────────┼─────────────────────────────┤
│                             │                             │
│ 1. Creates widget:          │                             │
│    npm run widgetize        │ widgetize.js:               │
│    MyWidget                 │ - Copies templates          │
│                             │ - Renames files             │
│                             │ - Updates index.js          │
│                             │                             │
│ 2. Starts development:      │                             │
│    npm run dev              │ npm start:                  │
│                             │ - Starts React dev server   │
│                             │ - Launches Electron         │
│                             │ - Opens DevTools            │
│                             │                             │
│ 3. Edits widget files:      │                             │
│    Changes MyWidget.js      │ Webpack:                    │
│    Changes MyWidget.dash.js │ - Detects changes           │
│                             │ - Recompiles               │
│                             │ - Sends HMR update         │
│                             │ - Browser applies change    │
│                             │                             │
│ 4. Saves file               │ React:                      │
│    CMD+S                    │ - Re-renders component      │
│                             │ - Updates Electron window   │
│                             │ - Preserves state           │
│                             │                             │
│ 5. Sees changes in app      │                             │
│    instantly!               │                             │
│                             │                             │
│ 6. Tests in dashboard UI    │ ComponentManager:           │
│    - Adds widget to         │ - Widget is registered      │
│      workspace              │ - Can be configured         │
│    - Interacts with it      │ - Can receive events        │
│    - Checks console         │                             │
│                             │                             │
│ 7. Repeat 3-6 as needed     │ (Keep developing...)        │
│                             │                             │
│ 8. Publish (optional)       │ Users can install via:      │
│    - Create GitHub repo     │ widget:install IPC call     │
│    - Create release ZIP     │                             │
│    - Share URL              │                             │
│                             │                             │
└─────────────────────────────┴─────────────────────────────┘
```

## Typical Development Session

```
Time    Activity                Terminal Output
────────────────────────────────────────────────────────────
0:00    npm run dev             Compiling... ✓ Compiled successfully
                                Electron window opens
                                DevTools attaches

0:10    npm run widgetize       Creating MyWidget folder...
        MyWidget                ✓ MyWidget created

0:20    Edit MyWidget.js        [Webpack detected change]
        Add console.log         Recompiling...
        Save (CMD+S)            ✓ Compiled successfully
                                [Update sent to browser]
                                [Component re-rendered]

0:22    See output in DevTools  DevTools shows console.log

0:30    Edit MyWidget.dash.js   [Webpack detected change]
        Add new config prop     Recompiling...
        Save                    ✓ Compiled successfully

0:35    Add widget to dashboard Right-click → Add Widget
                                Select MyWidget
                                Configure properties
                                Widget appears!

0:45    Test interactions       Click buttons
                                Check console for errors
                                ✓ Everything works!

1:00    Ready to publish        (Skip if only internal use)
                                Create GitHub repo
                                Share download URL
```

## What Happens Behind the Scenes

```
When you save a file in Phase 3:

1. DETECTION (0ms)
   File system watcher detects change

2. COMPILATION (200-500ms)
   ├─ Babel transpiles JSX
   ├─ Webpack bundles modules
   ├─ HMR package is created
   └─ Ready to send

3. TRANSMISSION (0-100ms)
   ├─ Development server sends HMR update
   └─ Browser downloads new modules

4. REPLACEMENT (100-300ms)
   ├─ Old module is unloaded
   ├─ New module is loaded
   ├─ React reconciliation runs
   └─ Component re-renders

5. DISPLAY (0-200ms)
   ├─ Browser repaints
   ├─ Electron shows new content
   └─ Developer sees changes

TOTAL TIME: ~1-2 seconds
(vs 5-10 seconds for full app restart)
```

## Error Flow

```
┌─────────────────────────────────────┐
│  Edit widget file incorrectly       │
│  (Syntax error, missing import)     │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│  Save file                          │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│  Webpack detects change             │
│  Tries to compile                   │
│  ✗ Compilation fails!               │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│  ERROR DISPLAYED:                   │
│  ├─ In terminal (npm run dev)       │
│  ├─ In browser console              │
│  └─ Often in Electron window too    │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│  Developer fixes error:             │
│  ├─ Edit file to correct syntax     │
│  ├─ Add missing import              │
│  └─ Save again                      │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│  Webpack recompiles                 │
│  ✓ Compilation succeeds             │
│  HMR update sent to browser         │
│  App updates automatically          │
└─────────────────────────────────────┘

No restart needed!
```

## Navigation Between Phases

```
Setup → Development → File Changes → Testing → Distribution
  ↓         ↓              ↓           ↓           ↓
Phase 1   Phase 2        Phase 3     Phase 4    Phase 5

Normal flow: 1 → 2 → 3 ↔ 3 ↔ 3 → 4 → 4 ↔ 4 → 5 (optional)

(Phase 3 and 4 repeat many times during development)
```
