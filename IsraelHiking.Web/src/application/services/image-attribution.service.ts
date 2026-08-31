import { inject, Service } from "@angular/core";
import type { Immutable } from "immer";

import { GeoJSONUtils } from "./geojson-utils";
import { INatureService } from "./inature.service";
import { NakebService } from "./nakeb.service";
import { PanoramaxService } from "./panoramax.service";
import { ShareUrlsService } from "./share-urls.service";
import { WikidataService } from "./wikidata.service";

export type ImageAttribution = {
    author: string;
    url: string;
    userId?: string;
};

/**
 * A service of a specific images source, it knows which images are its own and who should be credited for them
 */
export type ImageAttributionProvider = {
    /** Tells whether an image url belongs to this source and whether it can be shown by the app */
    isImageUrl(imageUrl: string): boolean;
    /** Gets the images this source holds for a feature, based on the tags of this source. Sources that only use the "image" tags don't need this */
    getImageUrls?(feature: Immutable<GeoJSON.Feature>): string[];
    getAttributionForImage(imageUrl: string): Promise<ImageAttribution>;
};

/**
 * Decides which of a feature's images can be shown and who should be credited for them,
 * the knowledge of every specific source lives in that source's service.
 */
@Service()
export class ImageAttributionService {
    /** Hosts of images that can be shown but have no service of their own, they are credited by their origin */
    private static readonly HOSTS_WITHOUT_A_SERVICE = ["jeepolog.com", "israelhiking.osm.org.il"];

    private readonly attributionImageCache = new Map<string, Promise<ImageAttribution>>();

    private readonly attributionProviders: ImageAttributionProvider[] = [
        inject(INatureService),
        inject(NakebService),
        inject(PanoramaxService),
        inject(ShareUrlsService),
        inject(WikidataService)
    ];

    /**
     * Gets the images a feature holds in its "image" tags, these are also the images that can be edited in OSM
     */
    public getValidImageUrls(feature: Immutable<GeoJSON.Feature>): string[] {
        return GeoJSONUtils.getImageUrls(feature).filter(u => this.isValidImageUrl(u));
    }

    /**
     * Gets the images that can be shown for a feature - the ones in its "image" tags followed by the ones the
     * different sources hold for it. Images that can't be credited are left out since they can't be shown.
     */
    public async getImagesThatHaveAttribution(feature: Immutable<GeoJSON.Feature>): Promise<string[]> {
        let imagesUrls = [...this.getValidImageUrls(feature), ...this.getImageUrlsFromSources(feature)];
        const imageAttributions = await Promise.all(imagesUrls.map(u => this.getAttributionForImage(u)));
        imagesUrls = imagesUrls.filter((_, i) => imageAttributions[i] != null);
        return [...new Set(imagesUrls.map(url => {
            try {
                return decodeURIComponent(url);
            } catch {
                return url;
            }
        }))];
    }

    private getImageUrlsFromSources(feature: Immutable<GeoJSON.Feature>): string[] {
        return this.attributionProviders.flatMap(p => p.getImageUrls?.(feature) ?? []);
    }

    private isValidImageUrl(imageUrl: string): boolean {
        // an image that was captured or picked in the app and was not uploaded yet
        if (imageUrl.startsWith("data:image")) {
            return true;
        }
        if (ImageAttributionService.HOSTS_WITHOUT_A_SERVICE.some(h => imageUrl.includes(h))) {
            return true;
        }
        return this.attributionProviders.some(p => p.isImageUrl(imageUrl));
    }

    public async getAttributionForImage(imageUrl: string): Promise<ImageAttribution> {
        if (imageUrl == null) {
            return null;
        }
        if (this.attributionImageCache.has(imageUrl)) {
            return this.attributionImageCache.get(imageUrl);
        }
        const provider = this.attributionProviders.find(p => p.isImageUrl(imageUrl));
        if (provider != null) {
            const imageAttribution = provider.getAttributionForImage(imageUrl);
            this.attributionImageCache.set(imageUrl, imageAttribution);
            return imageAttribution;
        }
        const url = new URL(imageUrl);
        if (!url.hostname) {
            // this is the case of a base64 image for example
            return null;
        }
        const imageAttribution = {
            author: url.origin,
            url: url.origin
        };
        this.attributionImageCache.set(imageUrl, Promise.resolve(imageAttribution));
        return imageAttribution;
    }
}
