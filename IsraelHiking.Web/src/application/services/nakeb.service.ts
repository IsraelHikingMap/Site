import { HttpClient } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { firstValueFrom } from "rxjs";

import type { ImageAttribution, ImageAttributionProvider } from "./image-attribution.service";
import { Urls } from "../urls";

export type NakebMarker = {
    lat: number;
    lng: number;
    title: string;
}

export type NakebItem = {
    id: string;
    title: string;
    last_modified: string;
    start: {
        lat: number;
        lng: number;
    };
    length: number;
    picture: string;
    link: string;
    attributes: string[];
    prolog: string;
    latlngs: {
        lat: number;
        lng: number;
    }[];
    markers: NakebMarker[];
}

@Service()
export class NakebService implements ImageAttributionProvider {
    /** All the images of this source are credited to nakeb itself and not to the user that uploaded them */
    public static readonly USER_ID = "Nakeb";
    public static readonly USER_NAME = "נָאקֶבּ";

    private readonly NAKEB_LOGO = `${Urls.nakeb}/static/images/hikes/logo_1000x667.jpg`;

    private readonly httpClient = inject(HttpClient);

    public async getRoute(id: string): Promise<GeoJSON.Feature> {
        const response = await firstValueFrom(this.httpClient.get<NakebItem>(`${Urls.nakebHikes}/${id}`));
        let description = (response.prolog ?? "").trim();
        if (!description.endsWith(".")) {
            description += ".";
        }
        description += `\n${response.attributes.join(", ")}.`;
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: response.latlngs.map(l => [l.lng, l.lat])
            },
            properties: {
                identifier: response.id,
                poiId: "Nakeb_" + response.id,
                poiCategory: "Hiking",
                poiIcon: "icon-hike",
                poiIconColor: "black",
                poiSource: "Nakeb",
                poiSourceImageUrl: this.NAKEB_LOGO,
                name: response.title,
                "name:he": response.title,
                poiGeolocation: {
                    lat: response.start.lat,
                    lng: response.start.lng
                },
                length: response.length,
                image: response.picture,
                website: response.link,
                description: description,
                "description:he": description

            }
        };
        return feature;
    }

    public isImageUrl(imageUrl: string): boolean {
        return imageUrl.includes("nakeb.co.il");
    }

    public async getAttributionForImage(imageUrl: string): Promise<ImageAttribution> {
        if (!this.isImageUrl(imageUrl)) {
            return null;
        }
        return {
            author: NakebService.USER_NAME,
            url: Urls.nakeb,
            userId: NakebService.USER_ID
        };
    }
}