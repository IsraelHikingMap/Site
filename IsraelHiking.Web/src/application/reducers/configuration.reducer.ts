import { Action, AbstractReducer, ReducerActions } from "@angular-redux2/store";

import type { ConfigurationState, Language, BatteryOptimizationType } from "../models/models";


export type SetLanguagePayload = {
    language: Language;
};

export type SetBatteryOptimizationTypePayload = {
    batteryOptimizationType: BatteryOptimizationType;
};

export class ConfigurationReducer extends AbstractReducer {
    static actions: ReducerActions<ConfigurationReducer>;

    @Action
    public setBatteryOptimization(lastState: ConfigurationState, payload: SetBatteryOptimizationTypePayload): ConfigurationState {
        lastState.batteryOptimizationType = payload.batteryOptimizationType;
        return lastState;
    }

    @Action
    public toggleAutomaticRecordingUpload(lastState: ConfigurationState): ConfigurationState {
        lastState.isAutomaticRecordingUpload = !lastState.isAutomaticRecordingUpload;
        return lastState;
    }

    @Action
    public toggleGotLostWarnings(lastState: ConfigurationState): ConfigurationState {
        lastState.isGotLostWarnings = !lastState.isGotLostWarnings;
        return lastState;
    }

    @Action
    public toggleIsShowSlope(lastState: ConfigurationState): ConfigurationState {
        lastState.isShowSlope = !lastState.isShowSlope;
        return lastState;
    }

    @Action
    public toggleIsShowKmMarkers(lastState: ConfigurationState): ConfigurationState {
        lastState.isShowKmMarker = !lastState.isShowKmMarker;
        return lastState;
    }

    @Action
    public stopShowingBatteryConfirmation(lastState: ConfigurationState): ConfigurationState {
        lastState.isShowBatteryConfirmation = false;
        return lastState;
    }

    @Action
    public stopShowingIntro(lastState: ConfigurationState): ConfigurationState {
        lastState.isShowIntro = false;
        return lastState;
    }

    @Action
    public setLanguage(lastState: ConfigurationState, payload: SetLanguagePayload): ConfigurationState {
        lastState.language = payload.language;
        return lastState;
    }
}