import React from "react";
import { Modal, Button, Button2, FontAwesomeIcon } from "@trops/dash-react";

const STORAGE_KEY = "dash:kitchen-sink-prompted";

function markPrompted() {
    localStorage.setItem(STORAGE_KEY, "true");
}

const WelcomePrompt = ({ isOpen, onAccept, onDismiss }) => {
    const handleAccept = () => {
        markPrompted();
        onAccept();
    };

    const handleDismiss = () => {
        markPrompted();
        onDismiss();
    };

    return (
        <Modal
            isOpen={isOpen}
            setIsOpen={handleDismiss}
            width="w-[520px]"
            height="h-auto"
        >
            <div className="bg-white dark:bg-zinc-900 rounded-lg overflow-hidden">
                <div className="px-8 pt-8 pb-4 flex flex-col items-center text-center gap-4">
                    <div className="text-4xl text-blue-500">
                        <FontAwesomeIcon icon="table-cells-large" />
                    </div>
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        Welcome to Dash!
                    </h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm">
                        Get started with a sample dashboard that showcases
                        widgets for AI chat, notes, GitHub, Slack, Gmail,
                        Calendar, and more — all in a ready-made 4x3 grid.
                    </p>
                </div>
                <Modal.Footer>
                    <div className="flex flex-row gap-3 w-full justify-end">
                        <Button2 title="Start Fresh" onClick={handleDismiss} />
                        <Button
                            title="Load Sample Dashboard"
                            onClick={handleAccept}
                        />
                    </div>
                </Modal.Footer>
            </div>
        </Modal>
    );
};

export { WelcomePrompt, STORAGE_KEY };
