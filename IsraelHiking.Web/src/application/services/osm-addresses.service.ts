import { Injectable } from "@angular/core";
import { Urls } from "../urls";

@Injectable()
export class OsmAddressesService {
    public getEditOsmLocationAddress(baseLayerAddress: string, zoom: number, latitude: number, longitude: number): string {
        const background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${Urls.osmBase}/edit#${background}&map=${zoom}/${latitude}/${longitude}`;
    }

    public getEditOsmGpxAddress(baseLayerAddress: string, gpxId: string) {
        const background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${Urls.osmBase}/edit?gpx=${gpxId}#${background}`;
    }

    public getEditElementOsmAddress(baseLayerAddress: string, id: string) {
        const elementType = id.split("_")[0];
        const elementId = id.split("_")[1];
        const background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${Urls.osmBase}/edit?${elementType}=${elementId}#${background}`;
    }

    public getElementOsmAddress(id: string) {
        const elementType = id.split("_")[0];
        const elementId = id.split("_")[1];
        return `${Urls.osmBase}/${elementType}/${elementId}`;
    }

    private getBackgroundStringForOsmAddress(baseLayerAddress: string): string {
        let background = "background=bing";
        if (baseLayerAddress !== "") {
            if (baseLayerAddress.startsWith("/")) {
                baseLayerAddress = Urls.baseTilesAddress + baseLayerAddress;
            }
            const address = baseLayerAddress.replace("{s}", "s");
            background = `background=custom:${encodeURIComponent(address)}`;
        }
        return background;
    }
}