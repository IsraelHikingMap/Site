import { Action, AbstractReducer, ActionPayload } from "@angular-redux2/store";

import type { Configuration, Language } from "../models/models";
import { BatteryOptimizationType } from "application/models/state/configuration";

export type SetLanguagePayload = {
    language: Language;
};

export type SetBatteryOptimizationTypePayload = {
    batteryOptimizationType: BatteryOptimizationType;
};

export class ConfigurationReducer extends AbstractReducer {
    static actions: {
        setBatteryOptimization: ActionPayload<SetBatteryOptimizationTypePayload>;
        toggleAutomaticRecordingUpload: ActionPayload<void>;
        toggleGotLostWarnings: ActionPayload<void>;
        stopShowingBatteryConfirmation: ActionPayload<void>;
        stopShowingIntro: ActionPayload<void>;
        setLanguage: ActionPayload<SetLanguagePayload>;
    };

    @Action
    public setBatteryOptimization(lastState: Configuration, payload: SetBatteryOptimizationTypePayload): Configuration {
        lastState.batteryOptimizationType = payload.batteryOptimizationType;
        return lastState;
    }

    @Action
    public toggleAutomaticRecordingUpload(lastState: Configuration): Configuration {
        lastState.isAutomaticRecordingUpload = !lastState.isAutomaticRecordingUpload;
        return lastState;
    }

    @Action
    public toggleGotLostWarnings(lastState: Configuration): Configuration {
        lastState.isGotLostWarnings = !lastState.isGotLostWarnings;
        return lastState;
    }

    @Action
    public stopShowingBatteryConfirmation(lastState: Configuration): Configuration {
        lastState.isShowBatteryConfirmation = false;
        return lastState;
    }

    @Action
    public stopShowingIntro(lastState: Configuration): Configuration {
        lastState.isShowIntro = false;
        return lastState;
    }

    @Action
    public setLanguage(lastState: Configuration, payload: SetLanguagePayload): Configuration {
        lastState.language = payload.language;
        return lastState;
    }
}
