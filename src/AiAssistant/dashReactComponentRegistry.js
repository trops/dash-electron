/**
 * dash-react component registry — sister to providerApiRegistry.js.
 *
 * Source of truth for which JSX `<ComponentName />` references are
 * considered legitimate dash-react exports. Used by widgetCodeValidator
 * to catch hallucinated / typo'd component names BEFORE the AI-built
 * widget compiles, instead of after when React throws "Element type is
 * invalid: expected a string ... but got: undefined."
 *
 * Why this exists: even with the dash-react-components.md skill page
 * spelling out the prop names verbatim, the AI still occasionally
 * imports a component that doesn't exist in the dist (typo, hallucination,
 * outdated training data). The runtime error is far from the cause —
 * it shows up deep in React's reconciler, the user has to send-to-AI to
 * fix, and meanwhile the preview is just blank.
 *
 * The registry is paired with a drift detector in
 * dashReactComponentRegistry.test.js that parses
 * node_modules/@trops/dash-react/dist/index.js and asserts the two
 * lists agree. Adding a new component to dash-react means adding it
 * here too; removing one means removing it here. The test fails until
 * the registry catches up — keeping false-positive rejections out of
 * the validator.
 *
 * Entries are deliberately just names (not full prop schemas). The
 * validator only checks the name; per-prop validation is a follow-up.
 */
export const DASH_REACT_COMPONENTS = new Set([
    "Accordion",
    "Accordion2",
    "Accordion3",
    "Alert",
    "Alert2",
    "Alert3",
    "AlertBanner",
    "AlgoliaRefinementList",
    "AlgoliaSearchBox",
    "Breadcrumbs",
    "Breadcrumbs2",
    "Breadcrumbs3",
    "Button",
    "Button2",
    "Button3",
    "ButtonIcon",
    "ButtonIcon2",
    "ButtonIcon3",
    "Caption",
    "Caption2",
    "Caption3",
    "Card",
    "Card2",
    "Card3",
    "Checkbox",
    "Code",
    "Code2",
    "Code3",
    "CodeEditorInline",
    "CodeEditorVS",
    "CodeRenderer",
    "CommandPalette",
    "ConfirmationModal",
    "Container",
    "DashPanel",
    "DashPanel2",
    "DashPanel3",
    "DataList",
    "Divider",
    "Divider2",
    "Divider3",
    "DragComponent",
    "Drawer",
    "DropComponent",
    "DropdownPanel",
    "DropdownPanel2",
    "DropdownPanel3",
    "EmptyState",
    "ErrorMessage",
    "FontAwesomeIcon",
    "FormField",
    "FormLabel",
    "Heading",
    "Heading2",
    "Heading3",
    "Icon",
    "Icon2",
    "Icon3",
    "InputText",
    "LayoutContainer",
    "MainSection",
    "Menu",
    "Menu2",
    "Menu3",
    "MenuItem",
    "MenuItem2",
    "MenuItem3",
    "MockAlgolia",
    "MockLayout",
    "MockWrapper",
    "Modal",
    "Navbar",
    "PalettePreviewPane",
    "Panel",
    "Panel2",
    "Panel3",
    "Paragraph",
    "Paragraph2",
    "Paragraph3",
    "ProgressBar",
    "ProgressBar2",
    "ProgressBar3",
    "RadioGroup",
    "SearchInput",
    "SelectInput",
    "SelectMenu",
    "SelectableCard",
    "SettingsModal",
    "Sidebar",
    "Skeleton",
    "Slider",
    "StatCard",
    "StatusBadge",
    "Stepper",
    "SubHeading",
    "SubHeading2",
    "SubHeading3",
    "Switch",
    "TabbedNavbar",
    "Table",
    "Table2",
    "Table3",
    "Tabs",
    "Tabs2",
    "Tabs3",
    "Tag",
    "Tag2",
    "Tag3",
    "TextArea",
    "ThemeContext",
    "ThemeFromUrlPane",
    "ThemePreviewBanner",
    "ThemePreviewContext",
    "ThemePreviewProvider",
    "Toast",
    "Toast2",
    "Toast3",
    "Toggle",
    "Toggle2",
    "Toggle3",
    "Tooltip",
    "WS_STATES",
    "WebSocketStatus",
    "WidgetChrome",
    "WidgetContext",
]);

/**
 * Returns true when `name` is exported by @trops/dash-react.
 * Convenience wrapper so callers don't need to know the registry is
 * a Set.
 */
export function isDashReactComponent(name) {
    return DASH_REACT_COMPONENTS.has(name);
}
