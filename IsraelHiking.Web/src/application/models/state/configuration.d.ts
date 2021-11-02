import { Language } from "../language";

export type BatteryOptimizationType = "screen-on" | "dark" | "screen-off"

export type Configuration = {
    batteryOptimizationType: BatteryOptimizationType;
    isAutomaticRecordingUpload: boolean;
    isGotLostWarnings: boolean;
    isShowBatteryConfirmation: boolean;
    isShowIntro: boolean;
    version: string;
    language: Language;
}
