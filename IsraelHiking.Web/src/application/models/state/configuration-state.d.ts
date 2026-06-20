import { Language } from "../language";

export type BatteryOptimizationType = "screen-on" | "dark" | "screen-off";

export type Theme = "light" | "dark";

export type ConfigurationState = {
    batteryOptimizationType: BatteryOptimizationType;
    theme: Theme;
    isAutomaticRecordingUpload: boolean;
    isGotLostWarnings: boolean;
    isShowBatteryConfirmation: boolean;
    isShowSlope: boolean;
    isShowKmMarker: boolean;
    isShowIntro: boolean;
    version: number;
    language: Language;
    units: "metric" | "imperial";
    dateFormat: string;
};
