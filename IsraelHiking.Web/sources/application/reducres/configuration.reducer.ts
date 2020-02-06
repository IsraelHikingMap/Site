import { Action } from "redux";

import { Configuration } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, createReducerFromClass } from "./reducer-action-decorator";

const IS_ADVANCED_TOGGLE = "IS_ADVANCED_TOGGLE";
const IS_BATTERY_OPTIMIZATION_TOGGLE = "IS_BATTERY_OPTIMIZATION_TOGGLE";
const IS_AUTOMATIC_RECORDING_UPLOAD = "IS_AUTOMATIC_RECORDING_UPLOAD";
const IS_FIND_MISSING_ROUTES_AFTER_UPLOAD = "IS_FIND_MISSING_ROUTES_AFTER_UPLOAD";

export class ConfigurationActions {
    public static readonly toggleIsAdvanceAction: Action = { type: IS_ADVANCED_TOGGLE };
    public static readonly toggleIsBatteryOptimizationAction: Action = { type: IS_BATTERY_OPTIMIZATION_TOGGLE };
    public static readonly toggleIsAutomaticRecordingUploadAction: Action = { type: IS_AUTOMATIC_RECORDING_UPLOAD };
    // public static readonly toggleFindMissingRoutesAfterUploadAction: Action = { type: IS_FIND_MISSING_ROUTES_AFTER_UPLOAD };
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

    @ReduxAction(IS_AUTOMATIC_RECORDING_UPLOAD)
    public toggleAutomaticRecordingUpload(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isAutomaticRecordingUpload: !lastState.isAutomaticRecordingUpload
        };
    }

    // @ReduxAction(IS_FIND_MISSING_ROUTES_AFTER_UPLOAD)
    // public toggleFindMissingRoutesAfterUpload(lastState: Configuration, _: Action): Configuration {
    //     return {
    //         ...lastState,
    //         isFindMissingRoutesAfterUpload: !lastState.isFindMissingRoutesAfterUpload
    //     };
    // }
}

export const configurationReducer = createReducerFromClass(ConfigurationReducer, initialState.configuration);
