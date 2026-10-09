/**
 * Test stand-in for ./useBuilderTheme. The real hook reads dash-react,
 * whose ESM dist jest can't load in these suites; every colour comes back
 * as an empty class string.
 *
 *   jest.mock("../useBuilderTheme", () => require("../builderThemeStub"));
 */
const empty = () =>
    new Proxy(
        {},
        {
            get: (_t, key) =>
                key === "tk"
                    ? () => ""
                    : key === "status"
                    ? new Proxy(
                          {},
                          { get: () => new Proxy({}, { get: () => "" }) }
                      )
                    : "",
        }
    );

module.exports = {
    builderTheme: () => empty(),
    useBuilderTheme: () => empty(),
};
