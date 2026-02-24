import React, { useContext, useEffect, useState, useRef } from "react";
import { SubHeading3, Heading, InputText } from "@trops/dash-react";
import { ThemeContext, AppContext } from "../../../Context";
import { deepCopy } from "@trops/dash-react";
import { ComponentManager } from "../../../ComponentManager";
import parseArgs from "minimist";

export const PanelApplicationSettings = ({
    settings,
    workspaces,
    setIsOpen,
}) => {
    const messagesEnd = useRef(null);

    const { theme, themes, changeCurrentTheme } = useContext(ThemeContext);
    const { creds, api, changeDebugMode } = useContext(AppContext);

    const [userInput, setUserInput] = useState("");
    const [userInputIndex, setUserInputIndex] = useState(0);

    // store the "chat"
    const [applicationInput, setApplicationInput] = useState([]);
    const [userInputs, setUserInputs] = useState([]);

    useEffect(() => {
        if (applicationInput.length === 0) {
            addDashInput("Talk robot to me.");
        }

        scrollToBottom();
    });

    function handleUserInput(e) {
        // only add when the user presses enter
        setUserInput(() => `${e.target.value}`);
    }

    function handleKeyDown(e) {
        if (e.key === "Enter") {
            addUserInput(userInput);
            evaluateUserInput(userInput);
            setUserInput(() => "");
        }

        if (e.key === "ArrowUp") {
            const currentIndex = deepCopy(userInputIndex);
            const newIndex = currentIndex - 1;
            const text = userInputs[newIndex];
            if (text !== undefined && text !== null) {
                setUserInput(() => text);
                setUserInputIndex(() => newIndex);
            }
        }

        if (e.key === "ArrowDown") {
            const currentIndex = deepCopy(userInputIndex);
            const newIndex = currentIndex + 1;
            const text = userInputs[newIndex];
            if (text !== undefined && text !== null) {
                setUserInput(() => text);
                setUserInputIndex(() => newIndex);
            }
        }
    }

    function evaluateUserInput(input) {
        // in some cases we have to get the substring and
        // use the rest of the string to "change" the configuration

        let newInput = input;
        if (input.indexOf("/") > -1) {
            newInput = input.substring(1);
        }

        // break up the command line statement into parts split by spaces
        const parts = newInput.split(" ");
        const command = parts[0];

        let args = {};
        if (parts.length > 1) {
            const tempParts = deepCopy(parts);
            tempParts.shift();
            args = tempParts.length > 1 ? parseArgs(tempParts) : null;

            if (args === null && parts.length > 1) {
                args = tempParts;
            }
        }

        let stringObject = "";

        switch (command.toLowerCase()) {
            case "exit":
                setIsOpen(false);
                break;

            case "debug":
                // either true or false!
                if (args[0] === "true" || args[0] === "false") {
                    changeDebugMode(args[0]);
                    stringObject = `Changing debugMode to ${args[0]}`;
                }
                break;

            case "history":
                const inputs = userInputs.join("\n");
                stringObject = inputs;
                break;

            case "settings":
                stringObject = `${JSON.stringify(settings, null, 2)}`;
                break;

            case "creds":
                stringObject = `${JSON.stringify(creds, null, 2)}`;
                break;

            case "api":
                stringObject = `${JSON.stringify(api, null, 2)}`;
                break;

            case "widget":
                if (Object.keys(args).length > 0) {
                    if (args[0] === "list") {
                        const m = ComponentManager.map();
                        const widgets = Object.keys(m).filter(
                            (key) => m[key]["type"] === "widget"
                        );
                        stringObject = `${JSON.stringify(widgets, null, 2)}`;
                    }
                }
                break;

            case "workspace":
                if (Object.keys(args).length > 0) {
                    if (args[0] === "list") {
                        stringObject = `${JSON.stringify(
                            workspaces.map((ws) => ws["name"]),
                            null,
                            2
                        )}`;
                    }
                }
                break;

            case "theme":
                if (Object.keys(args).length > 0) {
                    // -c (change theme)
                    if ("c" in args) {
                        changeCurrentTheme(args["c"]);
                        stringObject = `Changing theme to ${args["c"]}`;
                    }

                    // list
                    if (args[0] === "list") {
                        // theme keys list
                        const themeKeys = Object.keys(themes).map(
                            (themeKey) => {
                                return {
                                    name: themes[themeKey]["name"],
                                    key: themeKey,
                                }; //join('\n');
                            }
                        );
                        stringObject = `${JSON.stringify(themeKeys, null, 2)}`;
                    }
                } else {
                    console.log("theme list?");
                    if (args[0] === "list") {
                        // theme keys list
                        const themeKeys = Object.keys(themes).join("\n");
                        stringObject = `${themeKeys}`;
                    } else {
                        stringObject = `${JSON.stringify(theme, null, 2)}`;
                    }
                }

                break;

            case "help":
                const helpObject = [
                    "settings - list application setting configuration",
                    "creds - list application credentials (appId, apiKey)",
                    "api - list the Electron api information",
                    "widget list",
                    "workspace list",
                    "theme list  - list the theme 'keys'",
                    "theme [-c <themeKey>] - change the theme",
                    "exit - close the Nerd.",
                    "debug [true|false] - set debugMode",
                ];

                stringObject = JSON.stringify(helpObject, null, 2);
                break;

            default:
                break;
        }

        const o = [
            {
                message: input,
                author: "human",
                textType: "string",
            },
        ];

        if (stringObject !== "") {
            o.push({
                message: stringObject,
                author: "dash",
                textType: "code",
            });
        }

        addInputs(o);
    }

    function addInputs(inputs = []) {
        const applicationInputCurrent = deepCopy(applicationInput);
        const newArray = applicationInputCurrent.concat(inputs);
        setApplicationInput(() => newArray);
    }

    function addDashInput(input, textType = "string") {
        const applicationInputCurrent = deepCopy(applicationInput);
        applicationInputCurrent.push({
            author: "dash",
            message: input,
            textType,
        });
        setApplicationInput(() => applicationInputCurrent);
    }

    function addUserInput(input) {
        const applicationInputCurrent = deepCopy(applicationInput);
        applicationInputCurrent.push({ author: "human", message: input });

        const userInputsCurrent = deepCopy(userInputs);
        userInputsCurrent.push(input);

        setApplicationInput(() => applicationInputCurrent);
        setUserInputs(() => userInputsCurrent);
        setUserInputIndex(() => userInputs.length);
    }

    function writeInput(input, author, textType) {
        return author === "dash"
            ? writeApplicationInput(input, textType)
            : writeUserInput(input);
    }

    function writeUserInput(input) {
        return (
            <div className="flex flex-row shadow w-full">
                <span className="text-blue-500 bg-gray-800 px-4 py-2 rounded w-full shadow text-xs">
                    {input}
                </span>
            </div>
        );
    }

    function writeApplicationInput(input, textType = "string") {
        return textType === "string" ? (
            <div className="flex flex-row shadow w-full">
                <span className="text-green-500 bg-slate-900 px-4 py-2 rounded w-full shadow text-xs">
                    {input}
                </span>
            </div>
        ) : (
            <div className="flex flex-row w-full shadow">
                <span className="text-green-500 bg-slate-900 px-4 py-2 rounded w-full shadow text-xs">
                    <pre>{input}</pre>
                </span>
            </div>
        );
    }

    function renderApplicationInput() {
        return applicationInput.map((input, index) => {
            return (
                <div
                    key={`input-${index}`}
                    className="flex flex-row w-full py-1 font-mono text-green font-normal text-xs xl:text-sm"
                >
                    {writeInput(
                        input["message"],
                        input["author"],
                        input["textType"]
                    )}
                </div>
            );
        });
    }

    function scrollToBottom() {
        messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
    }

    return (
        <div className="flex flex-col w-full h-full overflow-clip">
            <div className="flex flex-row w-full h-full overflow-clip xl:justify-between xl:space-x-4">
                <div
                    className={`flex-col h-full rounded font-medium w-full hidden xl:flex xl:w-1/3 p-10 justify-between`}
                >
                    <div className="flex flex-col rounded py-10 space-y-4 w-full overflow-clip">
                        <Heading title={"Hello"} padding={false} />
                        <SubHeading3
                            title={
                                "01001000 01100101 01101100 01101100 01101111"
                            }
                            padding={false}
                        />
                        {/* <div className="flex flex-col h-full overflow-y-scroll">
                            <pre className="text-xs">{JSON.stringify(applicationInput, null, 2)}</pre>
                        </div> */}
                    </div>
                </div>
                <div
                    className={`flex flex-col h-full rounded xl:rounded-0 w-full lg:w-full`}
                >
                    <div className="flex flex-col bg-gradient-to-tr from-gray-900 to-gray-800 text-green-600 h-full w-full rounded-lg p-6 overflow-clip border border-gray-900">
                        <div className="flex flex-col py-4 text-sm font-mono overflow-clip h-full">
                            <div className="flex flex-col py-4 text-xs font-mono h-full overflow-y-scroll">
                                <div className="flex flex-1 flex-col h-full"></div>
                                {renderApplicationInput()}
                                <div
                                    ref={messagesEnd}
                                    style={{ float: "left", clear: "both" }}
                                ></div>
                            </div>
                        </div>
                        <div className="text-xs text-gray-400 space-y-1">
                            <div className="flex flex-row text-xs text-gray-400">
                                Type 'help' for more information, 'exit' to
                                leave.
                            </div>
                            <InputText
                                name="name"
                                padding={"p-4"}
                                value={userInput}
                                onKeyDown={handleKeyDown}
                                onChange={handleUserInput}
                                textSize={"text-lg"}
                                placeholder=""
                                bgColor={"bg-gray-400"}
                                textColor={"text-gray-800"}
                                hasBorder={false}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
