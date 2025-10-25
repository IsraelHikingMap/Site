import { Injectable } from "@angular/core";
import { Urls } from "../urls";

@Injectable()
export class OsmAddressesService {
    public getEditOsmLocationAddress(zoom: number, latitude: number, longitude: number): string {
        return `${Urls.osmBase}/edit#map=${zoom}/${latitude}/${longitude}`;
    }

    public getEditOsmGpxAddress(gpxId: string) {
        return `${Urls.osmBase}/edit?gpx=${gpxId}#`;
    }

    public getEditElementOsmAddress(id: string) {
        const elementType = id.split("_")[0];
        const elementId = id.split("_")[1];
        return `${Urls.osmBase}/edit?${elementType}=${elementId}#`;
    }

    public getElementOsmAddress(id: string) {
        const elementType = id.split("_")[0];
        const elementId = id.split("_")[1];
        return `${Urls.osmBase}/${elementType}/${elementId}`;
    }
}