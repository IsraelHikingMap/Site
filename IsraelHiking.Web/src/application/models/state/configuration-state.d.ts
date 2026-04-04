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
    version: number;
    language: Language;
    units: "metric" | "imperial";
    dateFormate: "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY";
};
