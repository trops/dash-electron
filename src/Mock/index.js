import { themes, mockThemeContext } from "./theme";
import { mockApi } from "./api";

export * from "./mock";

const mock = {
    theme: {
        themeName: "theme-1",
        themes,
        rawThemes: themes,
        context: mockThemeContext,
    },
    api: mockApi,
};

const mockText = {
    title: "Title",
    paragraph: `Here is the body of the panelHere is the body of the panelHere
    is the body of the panelHere is the body of the panelHere is the
    body of the panelHere is the body of the panelHere is the body
    of the panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panel panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the panel
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panel panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the panel
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panelHere is the body of the
    panelHere is the body of the panel`,
};

export { mock, mockText };
