import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import {
    getWidgetsForWorkspace,
    getWorkspacesForWorkspace,
} from "../../../../utils/layout";
import { FontAwesomeIcon } from "@trops/dash-react";

function classNames(...classes) {
    return classes.filter(Boolean).join(" ");
}

export const LayoutQuickAddMenu = ({
    onClickItem = undefined,
    className = "",
    item,
    workspace,
}) => {
    const workspacesForWorkspace = getWorkspacesForWorkspace(item);
    const widgetsForWorkspace = getWidgetsForWorkspace(item);
    console.log(
        "widgets for workspace ",
        widgetsForWorkspace,
        workspacesForWorkspace
    );

    return (
        <Menu as="div" className="fixed inline-block text-left z-50">
            {/* <div>
                <Menu.Button
                    className={`inline-flex w-full justify-center gap-x-1.5 rounded-md px-3 py-1 text-sm font-semibold ${className} hover:bg-gray-800`}
                >
                    Add
                    <ChevronDownIcon
                        className="-mr-1 h-5 w-5 text-gray-400"
                        aria-hidden="true"
                    />
                </Menu.Button>
            </div> */}

            <div>
                <Menu.Button className="flex items-center rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-none">
                    <span className="sr-only">Open options</span>
                    <EllipsisVerticalIcon
                        className="h-5 w-5"
                        aria-hidden="true"
                    />
                </Menu.Button>
            </div>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className="fixed right-0 z-50 mt-2 w-64 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1 z-50">
                        {workspacesForWorkspace.length > 0 && (
                            <div className="px-4 py-3">
                                <p className="text-sm text-gray-400">
                                    Layout/Function
                                </p>
                            </div>
                        )}
                        {workspacesForWorkspace.map((w) => {
                            return (
                                <Menu.Item onClick={() => onClickItem(w)}>
                                    {({ active }) => (
                                        <span
                                            className={classNames(
                                                active
                                                    ? "bg-gray-100 text-gray-900"
                                                    : "text-gray-700",
                                                "block px-4 py-2 text-sm space-x-2 z-50"
                                            )}
                                        >
                                            <FontAwesomeIcon icon="square" />
                                            <span>{w.name}</span>
                                        </span>
                                    )}
                                </Menu.Item>
                            );
                        })}
                        {widgetsForWorkspace.length > 0 && (
                            <div className="px-4 py-3 z-50">
                                <p className="text-sm text-gray-400">Widgets</p>
                            </div>
                        )}
                        {widgetsForWorkspace.map((c) => {
                            return (
                                <Menu.Item onClick={() => onClickItem(c)}>
                                    {({ active }) => (
                                        <span
                                            className={classNames(
                                                active
                                                    ? "bg-gray-100 text-gray-900"
                                                    : "text-gray-700",
                                                "block px-4 py-2 text-sm space-x-2 z-50"
                                            )}
                                        >
                                            <FontAwesomeIcon icon="cog" />
                                            <span>{c.name}</span>
                                        </span>
                                    )}
                                </Menu.Item>
                            );
                        })}
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
};
