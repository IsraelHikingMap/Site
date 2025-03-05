export type LanguageCode = "en-US" | "he" | "ru" | "ar";

export type Language = {
    code: LanguageCode;
    rtl: boolean;
    label: string;
};
