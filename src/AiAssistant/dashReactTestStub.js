/**
 * Plain stand-ins for the @trops/dash-react components the Widget Builder
 * uses, for Jest (dash-react ships ESM that Jest doesn't transform).
 *
 *   jest.mock("@trops/dash-react", () => require("../dashReactTestStub"));
 *
 * or spread it and override what a test needs:
 *
 *   jest.mock("@trops/dash-react", () => ({
 *       ...require("../dashReactTestStub"),
 *       MenuItem: …,
 *   }));
 *
 * Each stub renders the element a test would query: buttons are <button>s
 * named by their label, fields are labelled inputs, test ids pass through.
 */
const React = require("react");
const h = React.createElement;

const button =
    (extra = {}) =>
    ({
        title,
        children,
        onClick,
        disabled,
        ariaLabel,
        tooltip,
        testId,
        "data-testid": dataTestId,
    }) =>
        h(
            "button",
            {
                type: "button",
                onClick,
                disabled,
                "aria-label": ariaLabel || undefined,
                title: tooltip,
                "data-testid": testId || dataTestId,
                ...extra,
            },
            children !== undefined ? children : title
        );

// The real inputs spread unknown props onto the <input>, so test ids,
// key handlers and native attributes reach the element; mirror that.
const INPUT_EXTRAS = [
    "data-testid",
    "id",
    "onKeyDown",
    "onBlur",
    "readOnly",
    "title",
    "type",
    "rows",
    "autoFocus",
];
const inputExtras = (props) => {
    const out = {};
    for (const k of INPUT_EXTRAS) if (props[k] !== undefined) out[k] = props[k];
    return out;
};

const passthrough =
    (tag = "div") =>
    ({ children, testId, className }) =>
        h(tag, { "data-testid": testId, className }, children);

const card = ({ children, onClick, testId, ariaLabel, disabled }) =>
    onClick
        ? h(
              "button",
              {
                  type: "button",
                  onClick,
                  disabled,
                  "aria-label": ariaLabel || undefined,
                  "data-testid": testId,
              },
              children
          )
        : h("div", { "data-testid": testId }, children);

module.exports = {
    __esModule: true,
    Button: button(),
    Button2: button(),
    Button3: button(),
    ButtonIcon: button(),
    ButtonIcon2: button(),
    ButtonIcon3: button(),
    Card: card,
    Card2: card,
    Card3: card,
    FontAwesomeIcon: () => null,
    ListRow: ({ title, meta, onClick, testId, ariaLabel, trailing }) =>
        h(
            "div",
            null,
            h(
                onClick ? "button" : "div",
                {
                    type: onClick ? "button" : undefined,
                    onClick,
                    "data-testid": testId,
                    "aria-label": ariaLabel || undefined,
                },
                h("span", null, title),
                meta ? h("span", null, meta) : null
            ),
            trailing || null
        ),
    EmptyState: ({ title, description, children, testId }) =>
        h(
            "div",
            { "data-testid": testId },
            title ? h("h3", null, title) : null,
            description ? h("p", null, description) : null,
            children
        ),
    SectionLabel: ({ text }) => h("div", null, text),
    SubHeading3: ({ title }) => h("h3", null, title),
    PanelHeader: ({ title, onBack, backLabel, actions }) =>
        h(
            "div",
            null,
            onBack
                ? h("button", { type: "button", onClick: onBack }, backLabel)
                : null,
            h("span", null, title),
            actions || null
        ),
    InputText: ({
        value,
        onChange,
        placeholder,
        ariaLabel,
        disabled,
        ...rest
    }) =>
        h("input", {
            ...inputExtras(rest),
            value: value == null ? "" : value,
            placeholder,
            disabled,
            "aria-label": ariaLabel || placeholder,
            onChange: (e) => onChange && onChange(e.target.value, e),
        }),
    SearchInput: ({ value, onChange, placeholder, ariaLabel, ...rest }) =>
        h("input", {
            ...inputExtras(rest),
            value: value == null ? "" : value,
            placeholder,
            "aria-label": ariaLabel || placeholder,
            onChange: (e) => onChange && onChange(e.target.value, e),
        }),
    TextArea: ({ value, onChange, placeholder, ariaLabel, ...rest }) =>
        h("textarea", {
            ...inputExtras(rest),
            value: value == null ? "" : value,
            placeholder,
            "aria-label": ariaLabel || placeholder,
            onChange: (e) => onChange && onChange(e.target.value, e),
        }),
    FormField: ({ label, children, hint }) =>
        h("label", null, h("span", null, label), children, hint || null),
    SegmentedControl: ({ options = [], value, onChange, ariaLabel }) =>
        h(
            "div",
            { role: "radiogroup", "aria-label": ariaLabel },
            options.map((o) => {
                const opt = typeof o === "string" ? { value: o, label: o } : o;
                return h(
                    "button",
                    {
                        key: String(opt.value),
                        type: "button",
                        role: "radio",
                        "aria-checked": opt.value === value,
                        onClick: () => onChange && onChange(opt.value),
                    },
                    opt.label
                );
            })
        ),
    ChoiceMenu: ({ label, value, options = [], onChange }) =>
        h(
            "select",
            {
                "aria-label": label,
                value: value == null ? "" : value,
                onChange: (e) => onChange && onChange(e.target.value),
            },
            h("option", { value: "" }, label),
            options.map((o) => {
                const opt = typeof o === "string" ? { value: o, label: o } : o;
                return h(
                    "option",
                    { key: String(opt.value), value: opt.value },
                    opt.label
                );
            })
        ),
    StatusBadge: ({ label, children }) =>
        h("span", null, children !== undefined ? children : label),
    Tag: ({ text, children }) =>
        h("span", null, children !== undefined ? children : text),
    Panel: passthrough(),
    ThemeContext: React.createContext({ currentTheme: {} }),
    Checkbox: ({ label, checked, onChange, disabled }) =>
        h(
            "label",
            null,
            h("input", {
                type: "checkbox",
                checked: !!checked,
                disabled,
                onChange: (e) => onChange && onChange(e.target.checked, e),
            }),
            label
        ),
};
