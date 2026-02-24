import React, { useContext, Fragment } from "react";
import { Transition, Dialog } from "@headlessui/react";
// import { ThemeContext } from "../../Context/ThemeContext";
import { ThemeContext } from "@trops/dash-react"; // Assuming ThemeContext is re-exported from dash-react

const MenuSlideOverlay = ({ open, setOpen, children }) => {
    const { currentTheme } = useContext(ThemeContext);
    return (
        currentTheme && (
            <Transition.Root show={open} as={Fragment}>
                <Dialog
                    as="div"
                    className="fixed inset-0 overflow-clip"
                    onClose={setOpen}
                >
                    <div className="absolute inset-0 overflow-clip z-30">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-in-out duration-400"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="ease-in-out duration-300"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <Dialog.Overlay className="absolute inset-0 bg-gray-900 bg-opacity-75 transition-opacity" />
                        </Transition.Child>
                        <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full pl-0">
                            <Transition.Child
                                as={Fragment}
                                enter="transform transition ease-in-out duration-400 sm:duration-700"
                                enterFrom="-translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-300 sm:duration-700"
                                leaveFrom="translate-x-0"
                                leaveTo="-translate-x-full"
                            >
                                <div className="pointer-events-auto max-w-2xl xl:max-w-3xl overflow-clip">
                                    <div
                                        className={`flex h-full flex-col shadow-xl ${currentTheme["bg-secondary-very-dark"]} ${currentTheme["text-secondary-light"]} scrollbar scrollbar-thumb-gray-700 scrollbar-thin scrollbar-track-transparent overflow-clip`}
                                    >
                                        <div className="relative mt-6 flex-1 px-6 sm:px-6 overflow-clip h-full">
                                            {children}
                                        </div>
                                    </div>
                                </div>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>
        )
    );
};

export { MenuSlideOverlay };
