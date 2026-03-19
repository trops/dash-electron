import React, { useContext } from "react";
import {
    Modal,
    Button,
    Button2,
    FontAwesomeIcon,
    ThemeContext,
} from "@trops/dash-react";

const STORAGE_KEY = "dash:kitchen-sink-prompted";

function markPrompted() {
    localStorage.setItem(STORAGE_KEY, "true");
}

const WelcomePrompt = ({ isOpen, onAccept, onDismiss }) => {
    const { currentTheme } = useContext(ThemeContext);

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
            <div
                className={`${currentTheme["bg-primary-very-dark"]} rounded-lg overflow-hidden`}
            >
                <div className="px-8 pt-8 pb-4 flex flex-col items-center text-center gap-4">
                    <div
                        className={`text-4xl ${currentTheme["text-tertiary-medium"]}`}
                    >
                        <FontAwesomeIcon icon="table-cells-large" />
                    </div>
                    <h2
                        className={`text-xl font-semibold ${currentTheme["text-primary-light"]}`}
                    >
                        Welcome to Dash!
                    </h2>
                    <p
                        className={`text-sm ${currentTheme["text-primary-medium"]} max-w-sm`}
                    >
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
