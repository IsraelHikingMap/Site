import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";

import { ResourcesService } from "./resources.service";
import { Urls } from "../urls";
import type { Immutable } from "immer";

export type TranslationResponse = {
    translatedText: string;
    detectedSourceLanguage: string;
};

@Service()
export class TranslationService {
    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private readonly translationCache = new Map<string, Promise<string>>();

    public isTranslationPossibleAndNeeded(feature: Immutable<GeoJSON.Feature>): boolean {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const description = feature.properties["description:" + language] ||
            feature.properties["poiExternalDescription:" + language];
        const isNeeded = description ? false : true;
        const isPossible = feature.properties.description != null ||
            feature.properties["description:en"] != null ||
            Object.keys(feature.properties).filter(key => key.startsWith("poiExternalDescription:")).length > 0;
        return isNeeded && isPossible;
    }

    public getBestDescription(feature: Immutable<GeoJSON.Feature>): string {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const keys = Object.keys(feature.properties).filter(key => key.startsWith("poiExternalDescription:"));

        const description: string = feature.properties["description:" + language] ||
            feature.properties["poiExternalDescription:" + language] ||
            feature.properties.description ||
            feature.properties["description:en"] ||
            (keys.length > 0 ? feature.properties[keys[0]] || "" : "");
        return description.trim();
    }

    /**
     * A translation is kept for as long as the app runs, and the request itself is shared rather than
     * repeated - reopening a point, or toggling the translation off and back on, must not pay for it
     * a second time, and two callers asking at once must not send two requests. The key is the text
     * rather than the point's id, so points sharing a description share a translation, and points
     * that have no id yet do not all collide onto one entry.
     */
    public getTranslatedDescription(feature: Immutable<GeoJSON.Feature>): Promise<string> {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const description = this.getBestDescription(feature);
        if (description.length === 0) {
            return Promise.resolve("");
        }
        const cacheKey = `${language}_${description}`;
        const cachedTranslation = this.translationCache.get(cacheKey);
        if (cachedTranslation != null) {
            return cachedTranslation;
        }
        const request = firstValueFrom(this.httpClient.post<TranslationResponse>(Urls.tranlation, {
            q: description,
            source: "auto",
            target: language,
            format: "text"
        }).pipe(timeout(60000))).then(response => response.translatedText).catch(() => {
            this.translationCache.delete(cacheKey);
            return "";
        });
        this.translationCache.set(cacheKey, request);
        return request;
    }
}