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
        let url = new URL(imageUrl);
        if (!url.hostname) {
            return null;
        }
        if (!url.hostname.includes("upload.wikimedia")) {
            let imageAttribution = {
                author: url.origin,
                url: url.origin
            };
            this.attributionImageCache.set(imageUrl, imageAttribution);
            return imageAttribution;
        }

        let imageName = imageUrl.split("/").pop();
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let address = `https://${language}.wikipedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*` +
            `&titles=File:${imageName}`;
        try {
            let response: any = await firstValueFrom(this.httpClient.get(address).pipe(timeout(3000)));
            let extmetadata = response.query.pages[-1].imageinfo[0].extmetadata;
            if (extmetadata?.Artist.value) {
                const match = extmetadata.Artist.value.match(/<[^>]*>([^<]*)<\/[^>]*>/);
                let author = extmetadata.Artist.value as string;
                if (match) {
                    author = match[1]; // Extract the content between the opening and closing tags
                }
                let imageAttribution = {
                    author,
                    url: `https://${language}.wikipedia.org/wiki/File:${imageName}`
                };
                this.attributionImageCache.set(imageUrl, imageAttribution);
                return imageAttribution;
            }
        } catch {}
        return null;
    }
}
