import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";

import { ResourcesService } from "./resources.service";

export type ImageAttribution = {
    author: string;
    url: string;
};

@Injectable()
export class ImageAttributionService {
    private attributionImageCache: Map<string, ImageAttribution>;

    constructor(private readonly resources: ResourcesService,
        private readonly httpClient: HttpClient) {
        this.attributionImageCache = new Map<string, ImageAttribution>();
    }

    public async getAttributionForImage(imageUrl: string): Promise<ImageAttribution> {
        if (imageUrl == null) {
            return null;
        }
        if (this.attributionImageCache.has(imageUrl)) {
            return this.attributionImageCache.get(imageUrl);
        }
        const url = new URL(imageUrl);
        if (!url.hostname) {
            return null;
        }
        if (!url.hostname.includes("upload.wikimedia")) {
            const imageAttribution = {
                author: url.origin,
                url: url.origin
            };
            this.attributionImageCache.set(imageUrl, imageAttribution);
            return imageAttribution;
        }

        const imageName = imageUrl.split("/").pop();
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const address = `https://${language}.wikipedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*` +
            `&titles=File:${imageName}`;
        try {
            const response: any = await firstValueFrom(this.httpClient.get(address).pipe(timeout(3000)));
            const extmetadata = response.query.pages[-1].imageinfo[0].extmetadata;
            if (extmetadata?.Artist.value) {
                const match = extmetadata.Artist.value.match(/<[^>]*>([^<]*)<\/[^>]*>/);
                let author = extmetadata.Artist.value as string;
                if (match) {
                    author = match[1]; // Extract the content between the opening and closing tags
                }
                const imageAttribution = {
                    author,
                    url: `https://${language}.wikipedia.org/wiki/File:${imageName}`
                };
                this.attributionImageCache.set(imageUrl, imageAttribution);
                return imageAttribution;
            }
        } catch {} // eslint-disable-line
        return null;
    }
}
