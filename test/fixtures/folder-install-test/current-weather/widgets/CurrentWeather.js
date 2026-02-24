import React from "react";
import { Panel, FontAwesomeIcon } from "@trops/dash-react";

const conditions = {
    icon: "sun",
    label: "Sunny",
    temp: 72,
    humidity: 45,
    wind: 8,
    feelsLike: 70,
};

const CurrentWeather = (props) => {
    const {
        title = "Current Weather",
        location = "San Francisco, CA",
        ...rest
    } = props;

    return (
        <Panel {...rest}>
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                <FontAwesomeIcon icon="sun" className="h-4 w-4 text-white/70" />
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>

            <div className="px-3 pb-3">
                <p className="text-xs text-white/50 mb-2">{location}</p>

                <div className="flex items-center gap-3 mb-3">
                    <FontAwesomeIcon
                        icon={conditions.icon}
                        className="h-8 w-8 text-yellow-300"
                    />
                    <div>
                        <p className="text-3xl font-bold text-white">
                            {conditions.temp}°F
                        </p>
                        <p className="text-xs text-white/60">
                            {conditions.label}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 rounded p-2">
                        <FontAwesomeIcon
                            icon="droplet"
                            className="h-3 w-3 text-blue-300 mb-1"
                        />
                        <p className="text-xs text-white/80">
                            {conditions.humidity}%
                        </p>
                        <p className="text-xs text-white/40">Humidity</p>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                        <FontAwesomeIcon
                            icon="wind"
                            className="h-3 w-3 text-blue-300 mb-1"
                        />
                        <p className="text-xs text-white/80">
                            {conditions.wind} mph
                        </p>
                        <p className="text-xs text-white/40">Wind</p>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                        <FontAwesomeIcon
                            icon="temperature-half"
                            className="h-3 w-3 text-blue-300 mb-1"
                        />
                        <p className="text-xs text-white/80">
                            {conditions.feelsLike}°F
                        </p>
                        <p className="text-xs text-white/40">Feels Like</p>
                    </div>
                </div>
            </div>
        </Panel>
    );
};

export default CurrentWeather;
