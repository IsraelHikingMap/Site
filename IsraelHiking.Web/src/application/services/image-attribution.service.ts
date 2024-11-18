import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";

export type ImageAttribution = {
    author: string;
    url: string;
};

@Injectable()
export class ImageAttributionService {
    private attributionImageCache = new Map<string, ImageAttribution>();

    private readonly httpClient = inject(HttpClient);

    private extractPlainText(html: string): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return doc.documentElement.textContent.replace(/([ \t]*\n[ \t]*)+/g, '\n').replace(/[ \t]+/g, ' ').trim();
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
        const address = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*` +
            `&titles=File:${imageName}`;
        try {
            const response: any = await firstValueFrom(this.httpClient.get(address).pipe(timeout(3000)));
            const extmetadata = response.query.pages[Object.keys(response.query.pages)[0]].imageinfo[0].extmetadata;
            if (extmetadata?.Artist.value) {
                const author = this.extractPlainText(extmetadata.Artist.value as string);
                const imageAttribution = {
                    author,
                    url: `https://commons.wikimedia.org/wiki/File:${imageName}`
                };
                this.attributionImageCache.set(imageUrl, imageAttribution);
                return imageAttribution;
            }
        } catch {} // eslint-disable-line
        return null;
    }
}
