import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

type NakebItem = {
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
    markers: {
        lat: number;
        lng: number;
        title: string;
    }[];
}

@Injectable()
export class NakebService {
    private readonly NAKEB_BASE_ADDRESS = "https://www.nakeb.co.il/api/hikes";
    private readonly NAKEB_LOGO = "https://www.nakeb.co.il/static/images/hikes/logo_1000x667.jpg";

    private readonly httpClient = inject(HttpClient);

    public async getRoute(id: string): Promise<GeoJSON.Feature> {
        const response = await firstValueFrom(this.httpClient.get<NakebItem>(`${this.NAKEB_BASE_ADDRESS}/${id}`));
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
                    lng: response.start.lng,
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
}