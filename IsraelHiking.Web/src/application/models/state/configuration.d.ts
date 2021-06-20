import { Language } from "../language";

export interface Configuration {
    isBatteryOptimization: boolean;
    isAutomaticRecordingUpload: boolean;
    //isFindMissingRoutesAfterUpload: boolean;
    isGotLostWarnings: boolean;
    isShowBatteryConfirmation: boolean;
    version: string;
    language: Language;
}
