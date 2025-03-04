export type LanguageCode = "en-US" | "he" | "ru";

export type Language = {
    code: LanguageCode;
    rtl: boolean;
    label: string;
};
