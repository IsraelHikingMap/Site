import { Action } from "redux";

import { Configuration } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, createReducerFromClass } from "./reducer-action-decorator";

const IS_ADVANCED_TOGGLE = "IS_ADVANCED_TOGGLE";
const IS_BATTERY_OPTIMIZATION_TOGGLE = "IS_BATTERY_OPTIMIZATION_TOGGLE";

export class ConfigurationActions {
    public static readonly toggleIsAdvanceAction: Action = { type: IS_ADVANCED_TOGGLE };
    public static readonly toggleIsBatteryOptimizationAction: Action = { type: IS_BATTERY_OPTIMIZATION_TOGGLE };
}

class ConfigurationReducer {
    @ReduxAction(IS_ADVANCED_TOGGLE)
    public toggleAdvance(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isAdvanced: !lastState.isAdvanced
        };
    }

    @ReduxAction(IS_BATTERY_OPTIMIZATION_TOGGLE)
    public toggleBatteryOptimization(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isBatteryOptimization: !lastState.isBatteryOptimization
        };
    }
}

export const configurationReducer = createReducerFromClass(ConfigurationReducer, initialState.configuration);
