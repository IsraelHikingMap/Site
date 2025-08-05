import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";

import { ResourcesService } from "./resources.service";
import { firstValueFrom, timeout } from "rxjs";
import { GeoJSONUtils } from "./geojson-utils";

type WikiDataPage = {
    sitelinks: { [key: string]: { site: string, title: string } };
    statements: { [key: string]: { value: { content: any } }[] };
    labels?: { [key: string]: string };
    descriptions?: { [key: string]: string };
}

export type WikiMetadata = {
    Artist?: {
        value: string;
    };
    Attribution?: {
        value: string;
    };
    LicenseShortName?: {
        value: string;
    }
};

export type WikiPage = {
    query: {
        pages: {
            [key: string]: {
                extract: string,
                original?: {
                    source: string
                };
                revisions?: [Record<string, string>];
                imageinfo: {
                    url?: string;
                    extmetadata: WikiMetadata;
                }[];
            }
        },
    }
}

@Injectable()
export class WikidataService {

    private readonly resources: ResourcesService = inject(ResourcesService);
    private readonly httpClient: HttpClient = inject(HttpClient);

    public async enritchFeatureFromWikimedia(feature: GeoJSON.Feature, language: string): Promise<void> {
        const languageShort = language || this.resources.getCurrentLanguageCodeSimplified();
        const wikidata = await this.getWikidataFromId(feature.properties.wikidata);
        await this.setDescriptionAndImages(wikidata, feature, languageShort);
    }

    public async createFeatureFromPageId(wikidataId: string, language: string): Promise<GeoJSON.Feature> {
        const wikidata = await this.getWikidataFromId(wikidataId);

        const feature: GeoJSON.Feature<GeoJSON.Point> = {
            type: "Feature",
            properties: {
                identifier: wikidataId,
                wikidata: wikidataId,
                poiSource: "Wikidata",
                poiId: "Wikidata_" + wikidataId,
                poiIcon: "icon-wikipedia-w",
                poiCategory: "Wikipedia",
                poiIconColor: "black",
                poiSourceImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Wikidata-logo.svg/128px-Wikidata-logo.svg.png",
                poiLanguage: language
            },
            geometry: {
                type: "Point",
                coordinates: []
            }
        };
        await this.setDescriptionAndImages(wikidata, feature, language || this.resources.getCurrentLanguageCodeSimplified());
        const lngLat = this.setLocation(wikidata, feature);
        feature.geometry.coordinates = [lngLat.lng, lngLat.lat];
        for (const link of Object.keys(wikidata.sitelinks).filter(l => l.endsWith("wiki"))) {
            const lang = link.replace("wiki", "");
            feature.properties["name:" + lang] = wikidata.sitelinks[link].title;
        }
        feature.properties.name = wikidata.labels?.mul || wikidata.sitelinks[Object.keys(wikidata.sitelinks)[0]]?.title;
        for (const lang of Object.keys(wikidata.labels || {})) {
            if (lang === "mul") {
                continue;
            }
            if (!feature.properties["name:" + lang]) {
                feature.properties["name:" + lang] = wikidata.labels[lang];
            }
        }
        if (!feature.properties.description && !feature.properties.poiExternalDescription && !feature.properties["description:" + language]) {
            GeoJSONUtils.setDescription(feature, wikidata.descriptions?.[language] || this.resources.noDescriptionAvailableInYourLanguage, language);
        }
        if (!feature.properties.website) {
            GeoJSONUtils.setProperty(feature, "website", `https://www.wikidata.org/wiki/${wikidataId}`);
        }
        return feature;
    }

    private async getWikidataFromId(wikidataId: string): Promise<WikiDataPage> {
        const url = `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${wikidataId}`;
        return await firstValueFrom(this.httpClient.get(url).pipe(timeout(3000))) as unknown as WikiDataPage;
    }

    private async setDescriptionAndImages(wikidata: WikiDataPage, feature: GeoJSON.Feature, language: string): Promise<void> {
        await this.setImageFromWikidata(wikidata, feature);
        const title = wikidata.sitelinks[`${language}wiki`]?.title;
        if (!title) {
            return;
        }
        const indexString = GeoJSONUtils.setProperty(feature, "website", `https://${language}.wikipedia.org/wiki/${title}`);
        feature.properties["poiSourceImageUrl" + indexString] = "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/128px-Wikipedia-logo-v2.svg.png";
        const wikipediaPage = await firstValueFrom(this.httpClient.get(`https://${language}.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|pageimages&piprop=original&exintro=&redirects=1&explaintext=&titles=${title}&origin=*`).pipe(timeout(3000))) as unknown as WikiPage;
        const pagesIds = Object.keys(wikipediaPage.query.pages);
        if (pagesIds.length === 0) {
            return;
        }
        const page = wikipediaPage.query.pages[pagesIds[0]];
        feature.properties.poiExternalDescription = page.extract;
        if (page.original?.source) {
            GeoJSONUtils.setPropertyUnique(feature, "image", page.original.source);
        }
    }

    private setLocation(wikidata: WikiDataPage, feature: GeoJSON.Feature) {
        const latLng = { lat: 0, lng: 0 };
        if (wikidata.statements.P625 && wikidata.statements.P625.length > 0) {
            const coordinates = wikidata.statements.P625[0].value.content;
            latLng.lat = coordinates.latitude;
            latLng.lng = coordinates.longitude;
        }
        GeoJSONUtils.setLocation(feature, latLng);
        return latLng;
    }

    private async setImageFromWikidata(wikidata: WikiDataPage, feature: GeoJSON.Feature) {
        if (!wikidata.statements.P18?.length) {
            return;
        }
        const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${wikidata.statements.P18[0].value.content}&prop=imageinfo&iiprop=url&redirects&format=json&origin=*`;
        const imagePage = await firstValueFrom(this.httpClient.get(url).pipe(timeout(3000))) as unknown as WikiPage;
        const pagesIds = Object.keys(imagePage.query.pages);
        if (pagesIds.length === 0) {
            return;
        }
        const page = imagePage.query.pages[pagesIds[0]];
        if (page.imageinfo?.length > 0 && page.imageinfo[0].url) {
            GeoJSONUtils.setPropertyUnique(feature, "image", page.imageinfo[0].url);
        }
    }
}