export type LanguageCode = "en-US" | "he" | "ru" | "ar" | "es";

export type Language = {
    code: LanguageCode;
    rtl: boolean;
    label: string;
};
