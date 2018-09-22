import { IConfiguration } from "./configuration";

export interface IApplicationState {
    configuration: IConfiguration;
}

export const initialState =
    {
        configuration: {
            isAdvanced: false
        } as IConfiguration
    } as IApplicationState;