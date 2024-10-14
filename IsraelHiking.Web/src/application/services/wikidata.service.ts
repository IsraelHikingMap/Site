import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";

import { ResourcesService } from "./resources.service";
import { firstValueFrom, timeout } from "rxjs";
import { GeoJSONUtils } from "./geojson-utils";

type WikiDataPage = {
    sitelinks: { [key: string]: { site: string, title: string } };
    statements: { [key: string]: { value: { content: any } }[] };
}

type WikipediaPage = {
    query: {
        pages: {
            [key: string]: {
                extract: string
            }
        }
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
                wikidata: wikidataId,
                poiSource: "Wikidata",
                poiId: "Wikidata_" + wikidataId,
                poiIcon: "icon-wikipedia-w",
                poiCategory: "Wikipedia",
                poiIconColor: "black",
                poiSourceImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Wikidata-logo.svg/128px-Wikidata-logo.svg.png",
                poiLanguage: language
            },
            geometry: {
                type: "Point",
                coordinates: []
            }
        };
        await this.enritchFeatureFromWikimedia(feature, language);
        const lngLat = this.setLocation(wikidata, feature);
        feature.geometry.coordinates = [lngLat.lng, lngLat.lat];
        feature.properties.name = this.getTitle(wikidata, language);
        return feature;
    }

    private async getWikidataFromId(wikidataId: string): Promise<WikiDataPage> {
        const url = `https://www.wikidata.org/w/rest.php/wikibase/v0/entities/items/${wikidataId}`;
        return await firstValueFrom(this.httpClient.get(url).pipe(timeout(3000))) as unknown as WikiDataPage;
    }

    private async setDescriptionAndImages(wikidata: WikiDataPage, feature: GeoJSON.Feature, language: string): Promise<void> {
        if (wikidata.statements.P18 && wikidata.statements.P18.length > 0) {
            GeoJSONUtils.setProperty(feature, "image", `File:${wikidata.statements.P18[0].value.content}`);
        }
        const title = this.getTitle(wikidata, language);
        if (title) {
            const indexString = GeoJSONUtils.setProperty(feature, "website", `https://${language}.wikipedia.org/wiki/${title}`);
            feature.properties["poiSourceImageUrl" + indexString] = "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/128px-Wikipedia-logo-v2.svg.png";
        }
        const wikipediaPage = await firstValueFrom(this.httpClient.get(`http://${language}.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=${title}&origin=*`).pipe(timeout(3000))) as unknown as WikipediaPage;
        const pagesIds = Object.keys(wikipediaPage.query.pages);
        if (pagesIds.length > 0) {
            feature.properties.poiExternalDescription = wikipediaPage.query.pages[pagesIds[0]].extract;
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

    private getTitle(wikidata: WikiDataPage, language: string): string {
        return wikidata.sitelinks[`${language}wiki`]?.title;
    }
}