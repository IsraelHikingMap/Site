import { HttpClient } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";
import { validate as validateUuid } from "uuid";
import type { Immutable } from "immer";

import { Urls } from "../urls";
import type { ImageAttribution, ImageAttributionProvider } from "./image-attribution.service";

type PanoramaxProvider = {
    name: string;
    roles: string[];
};

type PanoramaxSearchResponse = {
    features: {
        id: string;
        providers?: PanoramaxProvider[];
    }[];
};

/**
 * Panoramax is an open street level imagery platform.
 * OSM entities can point to a picture in it using the "panoramax" tag which holds the picture's id.
 * The pictures are served by the federated api which redirects to the instance holding the picture.
 */
@Service()
export class PanoramaxService implements ImageAttributionProvider {
    private readonly httpClient = inject(HttpClient);

    /**
     * Gets the images urls of an OSM feature based on its "panoramax" tag, a tag can hold several ids separated by ";"
     * @param feature the feature to get the images from
     * @returns a list of image urls, empty when the feature has no valid panoramax id
     */
    public getImageUrls(feature: Immutable<GeoJSON.Feature>): string[] {
        return Object.keys(feature.properties)
            .filter(k => k === "panoramax" || k.startsWith("panoramax:"))
            .flatMap(k => (feature.properties[k] as string).split(";"))
            .map(id => id.trim())
            .filter(id => validateUuid(id))
            .map(id => this.getImageUrl(id));
    }

    public getImageUrl(id: string): string {
        return `${Urls.panoramaxPictures}${id}/sd.jpg`;
    }

    public isImageUrl(imageUrl: string): boolean {
        return this.getIdFromImageUrl(imageUrl) != null;
    }

    private getIdFromImageUrl(imageUrl: string): string {
        if (imageUrl == null || !imageUrl.startsWith(Urls.panoramaxPictures)) {
            return null;
        }
        const id = imageUrl.substring(Urls.panoramaxPictures.length).split("/")[0];
        return validateUuid(id) ? id : null;
    }

    /**
     * Gets the attribution of a panoramax image, this also acts as a validation that the picture exists
     * @param imageUrl a url created by {@link getImageUrl}
     * @returns the attribution or null when this is not a panoramax image or the picture can't be found
     */
    public async getAttributionForImage(imageUrl: string): Promise<ImageAttribution> {
        const id = this.getIdFromImageUrl(imageUrl);
        if (id == null) {
            return null;
        }
        try {
            const address = `${Urls.panoramaxSearch}?ids=${id}`;
            const response = await firstValueFrom(this.httpClient.get<PanoramaxSearchResponse>(address).pipe(timeout(3000)));
            const picture = response.features?.find(f => f.id === id);
            if (picture == null) {
                return null;
            }
            // a picture can have several producers, for example the account that uploaded it and the artist from the exif data
            const producers = picture.providers?.filter(p => p.roles?.includes("producer")).map(p => p.name) ?? [];
            return {
                author: producers.length > 0 ? producers.join(", ") : "Panoramax",
                url: `${Urls.panoramaxViewer}#focus=pic&pic=${id}`
            };
        } catch {
            return null;
        }
    }
}
