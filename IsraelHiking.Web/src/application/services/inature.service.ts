import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";

import { GeoJSONUtils } from "./geojson-utils";
import { Urls } from "../urls";

type INatureRsponse = {
    query: {
        pages: Record<string, {
            pageid: number;
            ns: number;
            title: string;
            revisions: Array<{
                "*": string;
            }>;
        }>;
    };
}

@Injectable()
export class INatureService {
    private readonly API_URL = "https://inature.info/w/api.php";
    private readonly TIMEOUT = 3000;
    
    private readonly httpClient: HttpClient = inject(HttpClient);

    public async createFeatureFromPageId(pageId: string): Promise<GeoJSON.Feature> {
        const address = this.getContnetRetrivalAddress(pageId, true);
        const {content, title} = await this.getPageContentAndTitleFromAddress(address);
        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Point",
                coordinates: []
            }
        };
        const lngLat = this.setLocation(content, feature);
        this.setImageWebsiteAndExternalDescription(content, feature, title);
        feature.geometry = await this.getGeometryFromContent(content) ?? {
            type: "Point",
            coordinates: [lngLat.lng, lngLat.lat]
        };
        feature.properties.poiSource = "iNature";
        feature.properties.poiCategory = "iNature";
        feature.properties.poiId = "iNature_" + pageId;
        feature.properties.identifier = pageId;
        feature.properties.name = title;
        if (feature.geometry.type !== "Point") {
            feature.properties.poiIcon = "icon-hike";
            feature.properties.poiCategory = "Hiking";
            feature.properties.poiIconColor = "black";
            feature.properties.name = feature.properties.name + " - טבע ונופים";
        } else {
            feature.properties.poiIcon = "icon-inature";
            feature.properties.poiCategory = "iNature";
            feature.properties.poiIconColor = "#116C00";
        }
        return feature;
    }

    public async enritchFeatureFromINature(feature: GeoJSON.Feature): Promise<void> {
        const iNatureRef = feature.properties["ref:IL:inature"];
        const address = this.getContnetRetrivalAddress(iNatureRef, false);
        const contentAndTitle = await this.getPageContentAndTitleFromAddress(address);
        this.setImageWebsiteAndExternalDescription(contentAndTitle.content, feature, iNatureRef);
    }

    private setLocation(content: string, feature: GeoJSON.Feature) {
        const regexp = /נצ=(\d+\.\d+)\s*,\s*(\d+\.\d+)/;
        const match = content.match(regexp);
        const latLng = { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        GeoJSONUtils.setLocation(feature, latLng);
        return latLng;
    }

    private setImageWebsiteAndExternalDescription(content: string, feature: GeoJSON.Feature, title: string) {
        feature.properties["poiExternalDescription:he"] = content.match(/סקירה=(.*)/)[1];
        const indexString = GeoJSONUtils.setProperty(feature, "website", `https://inature.info/wiki/${title}`);
        feature.properties["poiSourceImageUrl" + indexString] = "https://user-images.githubusercontent.com/3269297/37312048-2d6e7488-2652-11e8-9dbe-c1465ff2e197.png";
        const image = content.match(/תמונה=(.*)/)[1];
        const imageSrc = `https://inature.info/w/index.php?title=Special:Redirect/file/${image}`;
        GeoJSONUtils.setProperty(feature, "image", imageSrc);
    }

    private getContnetRetrivalAddress(key: string, isPageId: boolean): string {
        const baseAddress = `${this.API_URL}?action=query&prop=revisions&rvprop=content&format=json&origin=*`
        if (isPageId) {
            return baseAddress + `&pageids=${key}`;
        }
        return baseAddress + `&titles=${key}`;
    }

    private async getPageContentAndTitleFromAddress(address: string): Promise<{content: string, title: string}> {
        const iNatureJson = await firstValueFrom(this.httpClient.get<INatureRsponse>(address).pipe(timeout(this.TIMEOUT)));
        const pageData = iNatureJson.query.pages[Object.keys(iNatureJson.query.pages)[0]];
        return {
            content: pageData.revisions[0]["*"],
            title: pageData.title
        }
    }

    private async getGeometryFromContent(content: string): Promise<GeoJSON.Geometry> {
        const shareRegexp = /israelhiking\.osm\.org\.il\/share\/(.*?)["']/i;
        const match = content.match(shareRegexp);
        if (match == null) {
            return null;
        }
        const shareId = match[1];
        const url = Urls.urls + shareId + "?format=geojson";
        const geojson = await firstValueFrom(this.httpClient.get<GeoJSON.FeatureCollection>(url));
        return geojson.features.find(f => f.geometry.type !== "Point")?.geometry;
    }
}
