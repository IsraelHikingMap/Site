import { Language } from "../language";

export type BatteryOptimizationType = "screen-on" | "dark" | "screen-off";

export type ConfigurationState = {
    batteryOptimizationType: BatteryOptimizationType;
    isAutomaticRecordingUpload: boolean;
    isGotLostWarnings: boolean;
    isShowBatteryConfirmation: boolean;
    isShowSlope: boolean;
    isShowKmMarker: boolean;
    isShowIntro: boolean;
    version: string;
    language: Language;
};
