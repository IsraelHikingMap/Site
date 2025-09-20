import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";

import { ResourcesService } from "./resources.service";
import { Urls } from "../urls";

export type TranslationResponse = {
    translatedText: string;
    detectedSourceLanguage: string;
};

export class TranslationService {
    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private translationCache = new Map<string, string>();

    public isTranslationPossibleAndNeeded(feature: GeoJSON.Feature): boolean {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const description = feature.properties["description:" + language] ||
            feature.properties["poiExternalDescription:" + language];
        const isNeeded = description ? false : true;
        const isPossible = feature.properties.description != null || 
            feature.properties["description:en"] != null ||
            Object.keys(feature.properties).filter(key => key.startsWith("poiExternalDescription:")).length > 0;
        return isNeeded && isPossible;
    }

    public getBestDescription(feature: GeoJSON.Feature): string {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const keys = Object.keys(feature.properties).filter(key => key.startsWith("poiExternalDescription:"));

        return feature.properties["description:" + language] ||
            feature.properties["poiExternalDescription:" + language] ||
            feature.properties.description ||
            feature.properties["description:en"] || 
            (keys.length > 0 ? feature.properties[keys[0]] : "");
    }

    public async getTranslatedDescription(feature: GeoJSON.Feature): Promise<string> {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const cacheKey = `${feature.properties.poiId}_${language}`;
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }
        try {
            const translatedResponse = await firstValueFrom(this.httpClient.post<TranslationResponse>(Urls.tranlation, {
                q: this.getBestDescription(feature),
                source: "auto",
                target: language,
                format: "text"
            }).pipe(timeout(2000)));
            this.translationCache.set(cacheKey, translatedResponse.translatedText);
            return translatedResponse.translatedText;
        }
        catch {
            return "";
        }
        
    }
}