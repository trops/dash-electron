import React from "react";
import { Heading } from "@trops/dash-react";

export const LayoutTitlePane = ({ title, description }) => {
    return (
        <div className="flex flex-col rounded font-medium justify-between">
            <div className="flex flex-col rounded font-medium justify-between overflow-clip">
                <div className="flex flex-col rounded p-6 py-10 space-y-4 w-full">
                    <div className="flex flex-row w-full">
                        <Heading
                            title={title || "Choose a Layout"}
                            padding={false}
                            textColor="text-gray-300"
                        />
                    </div>
                    <p className="text-lg font-normal text-gray-300">
                        {description ||
                            "Select a layout template to get started with your new dashboard."}
                    </p>
                </div>
            </div>
        </div>
    );
};
