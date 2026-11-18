import { HttpClient } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";

import { Urls } from "../urls";
import type { ImageAttribution, ImageAttributionProvider } from "./image-attribution.service";

type UserImageMetadata = {
    osmUser: string;
};

/**
 * The images this site's users upload are stored in the user-images service, which serves the metadata
 * of a picture next to the picture itself, at the same address with a "json" extension.
 */
@Service()
export class UserImagesService implements ImageAttributionProvider {
    private readonly httpClient = inject(HttpClient);

    public isImageUrl(imageUrl: string): boolean {
        return this.getIdFromImageUrl(imageUrl) != null;
    }

    /**
     * Gets the id of the picture an image address points at, which doubles as the check that this is
     * one of our images at all. A resized image is the same picture, so a query is not a part of the id.
     * @param imageUrl the address of the image
     * @returns the id, or null when the image is not held by this service
     */
    private getIdFromImageUrl(imageUrl: string): string {
        if (imageUrl == null || !imageUrl.startsWith(Urls.userImages)) {
            return null;
        }
        const path = imageUrl.substring(Urls.userImages.length).split(/[?#]/)[0];
        return path.match(/^\/([0-9a-f]{32})\.(jpg|png|webp)$/)?.[1] ?? null;
    }

    /**
     * Gets who should be credited for an image, this also acts as a validation that the picture exists.
     * The credit links to the page of the image, which is where its license and the rest of its details are.
     * @param imageUrl the address of the image
     * @returns the attribution, or null when this is not one of our images or it can't be found
     */
    public async getAttributionForImage(imageUrl: string): Promise<ImageAttribution> {
        const id = this.getIdFromImageUrl(imageUrl);
        if (id == null) {
            return null;
        }
        try {
            const address = `${Urls.userImages}/${id}.json`;
            const metadata = await firstValueFrom(this.httpClient.get<UserImageMetadata>(address).pipe(timeout(3000)));
            if (!metadata?.osmUser) {
                return null;
            }
            return {
                author: metadata.osmUser,
                url: `${Urls.userImages}/${id}`
            };
        } catch {
            return null;
        }
    }
}
