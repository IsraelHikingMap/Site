import { Action } from "redux";
import { Action as ReduxAction, createReducerFromClass } from "@angular-redux2/store";

import { initialState, BaseAction } from "./initial-state";
import type { Configuration, Language } from "../models/models";
import { BatteryOptimizationType } from "application/models/state/configuration";

const IS_BATTERY_OPTIMIZATION_TOGGLE = "IS_BATTERY_OPTIMIZATION_TOGGLE";
const IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE = "IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE";
const IS_GOT_LOST_WARNINGS_TOGGLE = "IS_GOT_LOST_WARNINGS_TOGGLE";
const STOP_SHOW_BATTERY_CONFIRMATION = "STOP_SHOW_BATTERY_CONFIRMATION";
const STOP_SHOW_INTRO = "STOP_SHOW_INTRO";
const SET_LANGUAGE = "SET_LANGUAGE";
const SET_BATTERY_OPTIMIZATION_TYPE = "SET_BATTERY_OPTIMIZATION_TYPE";

export class ConfigurationActions {
    public static readonly toggleIsBatteryOptimizationAction: Action = { type: IS_BATTERY_OPTIMIZATION_TOGGLE };
    public static readonly toggleIsAutomaticRecordingUploadAction: Action = { type: IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE };
    public static readonly toggleIsGotLostWarningsAction: Action = { type: IS_GOT_LOST_WARNINGS_TOGGLE };
    public static readonly stopShowBatteryConfirmationAction: Action = { type: STOP_SHOW_BATTERY_CONFIRMATION };
    public static readonly stopShowIntroAction: Action = { type: STOP_SHOW_INTRO };
}

export type SetLanguagePayload = {
    language: Language;
};

export type SetBatteryOptimizationTypePayload = {
    batteryOptimizationType: BatteryOptimizationType;
};

export class SetLanguageAction extends BaseAction<SetLanguagePayload> {
    constructor(payload: SetLanguagePayload) {
        super(SET_LANGUAGE, payload);
    }
}

export class SetBatteryOptimizationTypeAction extends BaseAction<SetBatteryOptimizationTypePayload> {
    constructor(payload: SetBatteryOptimizationTypePayload) {
        super(SET_BATTERY_OPTIMIZATION_TYPE, payload);
    }
}

class ConfigurationReducer {
    @ReduxAction(SET_BATTERY_OPTIMIZATION_TYPE)
    public toggleBatteryOptimization(lastState: Configuration, action: SetBatteryOptimizationTypeAction): Configuration {
        return {
            ...lastState,
            batteryOptimizationType: action.payload.batteryOptimizationType
        };
    }

    @ReduxAction(IS_AUTOMATIC_RECORDING_UPLOAD_TOGGLE)
    public toggleAutomaticRecordingUpload(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isAutomaticRecordingUpload: !lastState.isAutomaticRecordingUpload
        };
    }

    @ReduxAction(IS_GOT_LOST_WARNINGS_TOGGLE)
    public toggleGotLostWarnings(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isGotLostWarnings: !lastState.isGotLostWarnings
        };
    }

    @ReduxAction(STOP_SHOW_BATTERY_CONFIRMATION)
    public stopShowingBatteryConfirmation(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isShowBatteryConfirmation: false
        };
    }

    @ReduxAction(STOP_SHOW_INTRO)
    public stopShowingIntro(lastState: Configuration, _: Action): Configuration {
        return {
            ...lastState,
            isShowIntro: false
        };
    }

    @ReduxAction(SET_LANGUAGE)
    public setLanugage(lastState: Configuration, action: SetLanguageAction): Configuration {
        return {
            ...lastState,
            language: action.payload.language
        };
    }
}

export const configurationReducer = createReducerFromClass(ConfigurationReducer, initialState.configuration);
