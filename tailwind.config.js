const path = require("path");
const os = require("os");

const widgetCachePath = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Dash",
    "widgets",
    "**",
    "*.{js,jsx,ts,tsx}"
);

module.exports = {
    important: true,
    darkMode: "class",
    content: [
        "./src/**/*.js",
        "./node_modules/@trops/dash-react/dist/**/*.js",
        "./node_modules/@trops/dash-core/dist/**/*.js",
        widgetCachePath,
    ],
    theme: {
        extend: {
            padding: {
                "1/2": "50%",
                "1/5": "20%",
                full: "100%",
            },
        },
    },
    safelist: [
        // Theme system: bg/text/border colors with specific shade patterns
        {
            pattern:
                /bg-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
            variants: ["hover"],
        },
        {
            pattern:
                /text-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
            variants: ["hover"],
        },
        {
            pattern:
                /border-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
            variants: ["hover"],
        },
        // Gradient stops
        {
            pattern:
                /from-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
        },
        {
            pattern:
                /via-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
        },
        {
            pattern:
                /to-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
        },
        // Named colors without shades
        "bg-black",
        "bg-white",
        "bg-transparent",
        "text-black",
        "text-white",
        // Layout utilities used by theme system
        { pattern: /grid-cols-(1|2|3|4|5|6|7|8|9|10|11|12)/ },
        { pattern: /grid-rows-(1|2|3|4|5|6)/ },
        {
            pattern: /opacity-(0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)/,
        },
    ],
    plugins: [require("tailwind-scrollbar"), require("@tailwindcss/forms")],
};
