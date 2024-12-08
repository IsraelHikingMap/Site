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
        const wikidataFileUrl = imageUrl.startsWith("File:");
        if (!url.hostname && !wikidataFileUrl) {
            return null;
        }
        if (!url.hostname.includes("upload.wikimedia") && !wikidataFileUrl) {
            const imageAttribution = {
                author: url.origin,
                url: url.origin
            };
            this.attributionImageCache.set(imageUrl, imageAttribution);
            return imageAttribution;
        }

        const imageName = imageUrl.split("/").pop().replace(/^File:/, "");
        let wikiPrefix = "https://commons.wikimedia.org/";
        let languageMatch = imageUrl.match(/https:\/\/upload\.wikimedia\.org\/wikipedia\/(.*?)\//);
        if (languageMatch) {
            wikiPrefix = `https://${languageMatch[1]}.wikipedia.org/`;
        }
        const address = `${wikiPrefix}w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*&titles=File:${imageName}`;
        try {
            const response: any = await firstValueFrom(this.httpClient.get(address).pipe(timeout(3000)));
            const extmetadata = response.query.pages[Object.keys(response.query.pages)[0]].imageinfo[0].extmetadata;
            let attribution = extmetadata?.Artist?.value || extmetadata?.Attribution?.value;
            if (attribution) {
                const author = this.extractPlainText(attribution);
                const imageAttribution = {
                    author,
                    url: `${wikiPrefix}/wiki/File:${imageName}`
                };
                this.attributionImageCache.set(imageUrl, imageAttribution);
                return imageAttribution;
            }
        } catch {} // eslint-disable-line
        return null;
    }
}
