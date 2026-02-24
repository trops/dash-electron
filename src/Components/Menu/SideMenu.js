/* This example requires Tailwind CSS v2.0+ */
import React, { Fragment } from "react";
import { Disclosure } from "@headlessui/react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon, withRouter } from "@trops/dash-react";

const mainApi = window.mainApi;

function classNames(...classes) {
    return classes.filter(Boolean).join(" ");
}

class SideMenu extends React.Component {
    handlePath = (path) => {
        console.log("PATH ", path);
        this.props.navigate(path);
    };

    generatePageChildren = (pages, indexName, pathname = "") => {
        return pages !== null
            ? pages.length > 0
                ? pages
                      .filter((p) => p.indexName === indexName)
                      .map((page) => ({
                          icon: "file",
                          name: page.displayName,
                          href: "/rules-manager/pages/" + page.id,
                          current:
                              pathname === "/rules-manager/pages/" + page.id,
                      }))
                : null
            : null;
    };

    generateTemplateChildren = (templates, indexName, pathname = "") => {
        return templates !== null
            ? templates.length > 0
                ? templates
                      .filter((p) => p.index === indexName)
                      .map((t) => ({
                          icon: "file",
                          name: t.name,
                          href: "/rules-manager/templates/" + t.name,
                          current:
                              pathname === "/rules-manager/templates/" + t.name,
                      }))
                : null
            : null;
    };

    generateApplicationChildren = (pages, templates, queries, indexName) => {
        const children = [];

        children.push({
            name: indexName,
            // href: '/rules-manager/pages',
            // current: pages !== null,
            // icon: 'code'
        });

        children.push({
            name: "Pages",
            href: "/rules-manager/pages",
            current: pages !== null,
            icon: "file",
        });

        children.push({
            name: "Display Templates",
            href: "/rules-manager/templates",
            current: templates !== null,
            icon: "palette",
        });

        children.push({
            name: "Queries",
            href: "/rules-manager/query-test",
            current: queries !== null,
            icon: "vial-circle-check",
        });

        return children;
    };

    generateNavigation = () => {
        const { pages, templates, location, queries } = this.props;
        const application = mainApi.getApplication();
        const indexName = mainApi.getIndexName();
        const currentPath = "pathname" in location ? location["pathname"] : "";

        const navigation = [
            {
                name: "Home",
                href: "/applications",
                icon: "home",
            },
        ];

        application !== undefined &&
            navigation.push({
                name: application["appId"],
                href: "/applications/" + application["appId"],
                current:
                    currentPath === "/applications/" + application["appId"],
                icon: "server",
                children:
                    indexName &&
                    this.generateApplicationChildren(
                        pages,
                        templates,
                        queries,
                        indexName
                    ),
            });

        // indexName && navigation.push({
        //   name: indexName,
        //   href: '/applications/' + application['appId'],
        //   // current: currentPath === '/applications/' + application['appId'],
        //   icon: 'server',
        //   // children: indexName && this.generateApplicationChildren(pages, templates, queries, indexName)
        // });

        // application !== undefined && indexName && navigation.push({
        //   name: 'Pages',
        //   href: '/rules-manager/pages',
        //   current: pages !== null,
        //   icon: 'file'
        //   // children: this.generatePageChildren(pages, indexName, currentPath),

        // });

        // application !== undefined && indexName && navigation.push({
        //   name: 'Display Templates',
        //   href: '/rules-manager/templates',
        //   current: templates !== null,
        //   icon: 'palette'
        //   // children: this.generateTemplateChildren(templates, indexName, currentPath),

        // });

        // application !== undefined && indexName && navigation.push({
        //   name: 'Queries',
        //   href: '/rules-manager/query-test',
        //   current: queries !== null,
        //   icon: 'vial-circle-check'
        // });
        return navigation;
    };

    render() {
        const { location, showMenu } = this.props;
        const navigation = this.generateNavigation();
        const isSettingsSelected =
            "pathname" in location &&
            (location["pathname"] === "/settings" ? true : false);
        return (
            <div className="flex flex-col border-r border-gray-800 pb-4 overflow-y-scroll h-full scrollbar scrollbar-thumb-gray-700 scrollbar-thin scrollbar-track-transparent">
                <div className="flex-grow flex flex-col bg-gray-900 p-2">
                    <nav
                        className="flex flex-col px-0 2xl:px-2 space-y-2"
                        aria-label="Sidebar"
                    >
                        {navigation.map((item) =>
                            !item.children ? (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={classNames(
                                        item.current
                                            ? "bg-gray-800 text-indigo-400 font-bold"
                                            : "bg-gray-900 text-gray-500 hover:bg-gray-700 hover:text-gray-200",
                                        "group w-full flex items-center justify-center pl-3 pr-2 py-2 text-lg 2xl:text-xl 2xl:justify-start font-bold rounded-md space-x-2"
                                    )}
                                >
                                    {item.icon !== undefined && (
                                        <FontAwesomeIcon
                                            icon={item.icon}
                                            className="text-gray-400"
                                        />
                                    )}
                                    <span className="hidden 2xl:inline-flex ml-2">
                                        {item.name}
                                    </span>
                                </Link>
                            ) : (
                                <Disclosure
                                    as="div"
                                    key={item.name}
                                    className="space-y-2"
                                >
                                    {({ open }) => (
                                        <Fragment>
                                            <Disclosure.Button
                                                className={classNames(
                                                    item.current
                                                        ? "text-indigo-300"
                                                        : "text-gray-300 hover:bg-gray-700 hover:text-gray-200",
                                                    "w-full flex items-center justify-center pl-3 pr-2 py-2 text-lg 2xl:text-xl 2xl:justify-start font-bold rounded-md space-x-2"
                                                )}
                                            >
                                                <Link
                                                    to={item.href}
                                                    className="flex flex-row space-x-2 items-center justify-center"
                                                >
                                                    {item.icon !==
                                                        undefined && (
                                                        <FontAwesomeIcon
                                                            icon={item.icon}
                                                            className="text-gray-400"
                                                        />
                                                    )}
                                                    <span className="hidden 2xl:inline-flex">
                                                        {item.name}
                                                    </span>
                                                </Link>
                                            </Disclosure.Button>
                                            <Disclosure.Panel
                                                className="space-y-2 bg-slate-900 rounded-lg p-2 2xl:p-2 border border-gray-800"
                                                static
                                            >
                                                {item.children.map(
                                                    (subItem) => (
                                                        <Disclosure.Button
                                                            key={subItem.name}
                                                            as="a"
                                                            onClick={() =>
                                                                this.handlePath(
                                                                    subItem.href
                                                                )
                                                            }
                                                            className={classNames(
                                                                subItem.current
                                                                    ? "bg-gray-800 text-indigo-300"
                                                                    : "text-gray-500 hover:bg-indigo-800 hover:text-gray-200",
                                                                "group w-full flex items-center justify-start pl-3 pr-2 py-2 text-sm lg:text-base 2xl:text-base font-medium rounded-md hover:text-gray-200 hover:bg-gray-700 cursor-pointer space-x-2"
                                                            )}
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={
                                                                    subItem.icon
                                                                }
                                                            />
                                                            <span className="hidden 2xl:inline-flex ml-2">
                                                                {subItem.name}
                                                            </span>
                                                        </Disclosure.Button>
                                                    )
                                                )}
                                            </Disclosure.Panel>
                                        </Fragment>
                                    )}
                                </Disclosure>
                            )
                        )}
                    </nav>
                </div>
                <div>
                    <Disclosure
                        as="div"
                        key={"menu-settings"}
                        className="px-4 2xl:px-4"
                    >
                        <Disclosure.Button
                            key={"menu-settings"}
                            as="a"
                            onClick={() => this.handlePath("/settings")}
                            className={classNames(
                                isSettingsSelected
                                    ? "text-indigo-300"
                                    : "text-gray-500 hover:bg-gray-800 hover:text-gray-200",
                                "group w-full flex items-center p-0 pl-0 2xl:p-2 2xl:pl-3 text-left text-lg 2xl:text-xl font-bold rounded-md focus:outline-none space-x-2 cursor-pointer"
                            )}
                        >
                            <FontAwesomeIcon
                                icon="gear"
                                className="text-gray-500"
                            />
                            <span className="hidden 2xl:inline-flex">
                                Settings
                            </span>
                        </Disclosure.Button>
                    </Disclosure>
                </div>
            </div>
        );
    }
}
withRouter(SideMenu);

SideMenu.defaultProps = {
    pages: [],
    templates: null,
    queries: null,
    showMenu: true,
};

export { SideMenu };
