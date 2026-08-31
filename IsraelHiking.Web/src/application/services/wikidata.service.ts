import { HttpClient } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import type { Immutable } from "immer";

import { Urls } from "../urls";
import { ResourcesService } from "./resources.service";
import { firstValueFrom, timeout } from "rxjs";
import { GeoJSONUtils } from "./geojson-utils";
import type { ImageAttribution, ImageAttributionProvider } from "./image-attribution.service";

type WikiDataPage = {
    sitelinks: Record<string, { site: string, title: string }>;
    statements: {
        /** Coordinate location */
        P625?: { value: { content: { latitude: number, longitude: number } } }[];
        /** Image file name in wikimedia commons */
        P18?: { value: { content: string } }[];
    };
    labels?: Record<string, string>;
    descriptions?: Record<string, string>;
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
        pages: Record<string, {
            extract: string,
            original?: {
                source: string
            };
            revisions?: [Record<string, string>];
            imageinfo: {
                url?: string;
                extmetadata: WikiMetadata;
            }[];
        }>
    }
}

@Service()
export class WikidataService implements ImageAttributionProvider {

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
                poiSourceImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Wikidata-logo.svg/120px-Wikidata-logo.svg.png"
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
        if (!feature.properties.description && !feature.properties.poiExternalDescription && !feature.properties["description:" + language] && wikidata.descriptions?.[language]) {
            GeoJSONUtils.setDescription(feature, wikidata.descriptions[language], language);
        }
        if (language !== "en" && wikidata.sitelinks["enwiki"]) {
            feature.properties["name:en"] = wikidata.sitelinks["enwiki"].title;
            const imageAndDescription = await this.getDescriptionAndImageByLanguageAndTitle("en", wikidata.sitelinks["enwiki"].title);
            if (imageAndDescription) {
                feature.properties["description:en"] = imageAndDescription.description;
            }
        }
        if (!feature.properties.website) {
            GeoJSONUtils.setProperty(feature, "website", `${Urls.wikidata}/wiki/${wikidataId}`);
        }
        return feature;
    }

    private async getWikidataFromId(wikidataId: string): Promise<WikiDataPage> {
        const url = Urls.wikidataEntities + wikidataId;
        return await firstValueFrom(this.httpClient.get<WikiDataPage>(url).pipe(timeout(3000)));
    }

    private async setDescriptionAndImages(wikidata: WikiDataPage, feature: GeoJSON.Feature, language: string): Promise<void> {
        await this.setImageFromWikidata(wikidata, feature);
        const title = wikidata.sitelinks[`${language}wiki`]?.title;
        if (!title) {
            return;
        }
        const indexString = GeoJSONUtils.setProperty(feature, "website", `https://${language}.wikipedia.org/wiki/${title}`);
        feature.properties["poiSourceImageUrl" + indexString] = "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/120px-Wikipedia-logo-v2.svg.png";
        const imageAndDescription = await this.getDescriptionAndImageByLanguageAndTitle(language, title);
        if (imageAndDescription?.image) {
            GeoJSONUtils.setPropertyUnique(feature, "image", imageAndDescription.image);
        }
        if (imageAndDescription?.description) {
            feature.properties["poiExternalDescription:" + language] = imageAndDescription.description;
        }
    }

    private async getDescriptionAndImageByLanguageAndTitle(language: string, title: string): Promise<{ image?: string; description?: string }> {
        const wikipediaPage = await firstValueFrom(this.httpClient.get<WikiPage>(`https://${language}.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|pageimages&piprop=original&exintro=&redirects=1&explaintext=&titles=${title}&origin=*`).pipe(timeout(3000)));
        const pagesIds = Object.keys(wikipediaPage.query.pages);
        if (pagesIds.length === 0) {
            return null;
        }
        const page = wikipediaPage.query.pages[pagesIds[0]];
        return {
            description: page.extract,
            image: page.original?.source
        };
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
        const url = `${Urls.wikimediaCommons}w/api.php?action=query&titles=File:${wikidata.statements.P18[0].value.content}&prop=imageinfo&iiprop=url&redirects&format=json&origin=*`;
        const imagePage = await firstValueFrom(this.httpClient.get<WikiPage>(url).pipe(timeout(3000)));
        const pagesIds = Object.keys(imagePage.query.pages);
        if (pagesIds.length === 0) {
            return;
        }
        const page = imagePage.query.pages[pagesIds[0]];
        if (page.imageinfo?.length > 0 && page.imageinfo[0].url) {
            GeoJSONUtils.setPropertyUnique(feature, "image", page.imageinfo[0].url);
        }
    }

    public isImageUrl(imageUrl: string): boolean {
        if (imageUrl.startsWith("File:")) {
            return true;
        }
        if (!imageUrl.includes("wikimedia.org")) {
            return false;
        }
        // the placeholder of an item that has no free image yet is not a picture of the point,
        // and svg files are logos and diagrams rather than photos
        return !imageUrl.includes("Building_no_free_image_yet") &&
            !imageUrl.endsWith("svg.png") &&
            !imageUrl.endsWith("svg");
    }

    /**
     * Gets the images of an OSM feature based on its "wikimedia_commons" tag, a tag can hold several values separated by ";"
     * @param feature the feature to get the images from
     * @returns a list of "File:" references, empty when the feature has no image in wikimedia commons
     */
    public getImageUrls(feature: Immutable<GeoJSON.Feature>): string[] {
        return Object.keys(feature.properties)
            .filter(k => k === "wikimedia_commons" || k.startsWith("wikimedia_commons:"))
            .flatMap(k => (feature.properties[k] as string).split(";"))
            .map(value => value.trim())
            // a value can also point to a commons category, which is a list of images and not an image
            .filter(value => value.startsWith("File:"));
    }

    /**
     * Gets the attribution of an image hosted in wikimedia
     * @param imageUrl an "upload.wikimedia.org" url or a "File:" reference to wikimedia commons
     * @returns the attribution, or null when there's no author and the license does not allow using the image
     */
    public async getAttributionForImage(imageUrl: string): Promise<ImageAttribution> {
        const imageName = imageUrl.split("/").pop().replace(/^File:/, "");
        let wikiPrefix: string = Urls.wikimediaCommons;
        const languageMatch = imageUrl.match(/https:\/\/upload\.wikimedia\.org\/wikipedia\/(.*?)\//);
        if (languageMatch && languageMatch[1] !== "commons") {
            wikiPrefix = `https://${languageMatch[1]}.wikipedia.org/`;
        }
        const address = `${wikiPrefix}w/api.php?action=query&prop=imageinfo|revisions&iiprop=extmetadata&rvprop=content&format=json&origin=*&titles=File:${imageName}`;
        try {
            const response = await firstValueFrom(this.httpClient.get<WikiPage>(address).pipe(timeout(3000)));
            const pagesIds = Object.keys(response.query.pages);
            if (pagesIds.length === 0) {
                return null;
            }
            const extmetadata = response.query.pages[pagesIds[0]].imageinfo[0].extmetadata;
            let author = this.extractAuthorFromMetadata(extmetadata);
            if (!author) {
                author = this.extractAuthorFromRevisions(response.query.pages[pagesIds[0]].revisions?.[0]);
            }
            if (author) {
                return {
                    author,
                    url: `${wikiPrefix}wiki/File:${imageName}`
                };
            }
            const licenseLower = extmetadata?.LicenseShortName?.value.toLowerCase() || "";
            if ((licenseLower.includes("cc") && !licenseLower.includes("nc")) || licenseLower.includes("public domain")) {
                return {
                    author: "Unknown",
                    url: `${wikiPrefix}wiki/File:${imageName}`
                };
            }
        } catch { } // eslint-disable-line
        return null;
    }

    private extractAuthorFromMetadata(extmetadata: WikiMetadata): string {
        const attribution = extmetadata?.Artist?.value || extmetadata?.Attribution?.value;
        if (attribution) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(attribution, "text/html");
            return doc.documentElement.textContent.replace(/([ \t]*\n[ \t]*)+/g, "\n").replace(/[ \t]+/g, " ").trim();
        }
        return null;
    }

    private extractAuthorFromRevisions(revisions: Record<string, string>): string {
        if (revisions == null || revisions["*"] == null) {
            return null;
        }
        const rawContent = revisions["*"];
        const authorMatch = rawContent.match(/\|author=(.*?)(?:\n|\||$)/);

        if (authorMatch) {
            const authorRaw = authorMatch[1].trim();

            // Remove surrounding brackets if it’s a link
            const linkMatch = authorRaw.match(/\[.*?\s+([^\]]+)\]/);
            const author = linkMatch ? linkMatch[1] : authorRaw;

            return author;
        }
        return null;
    }
}