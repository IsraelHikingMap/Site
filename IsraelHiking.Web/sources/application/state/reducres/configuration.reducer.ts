import { Action, Reducer } from "redux";
import { IConfiguration } from "../models/configuration";

export class ConfigurationActions {
    public static readonly IS_ADVANCED_TOGGLE = "IS_ADVANCED_TOGGLE";
    public static readonly toggleIsAdvanceAction: Action = { type: ConfigurationActions.IS_ADVANCED_TOGGLE };
}

export const configurationReducer: Reducer<IConfiguration, Action> =
    (lastState: IConfiguration = { isAdvanced: false }, action: Action): IConfiguration => {
        switch (action.type) {
            case ConfigurationActions.IS_ADVANCED_TOGGLE:
                return {
                    ...lastState,
                    isAdvanced: !lastState.isAdvanced
                };
            default:
                return lastState;
        }
    };