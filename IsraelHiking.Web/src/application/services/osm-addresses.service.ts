import { inject, Injectable } from "@angular/core";
import { Urls } from "../urls";
import { Store } from "@ngxs/store";

import type { ApplicationState } from "../models";

@Injectable()
export class OsmAddressesService {

    private readonly store = inject(Store);

    public getOsmAddress() {
        const poiState = this.store.selectSnapshot((s: ApplicationState) => s.poiState);
        if (poiState.selectedPointOfInterest != null &&
            poiState.selectedPointOfInterest.properties.poiSource.toLocaleLowerCase() === "osm") {
            return this.getEditElementOsmAddress(poiState.selectedPointOfInterest.properties.identifier);
        }
        const currentLocation = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        return this.getEditOsmLocationAddress(
            currentLocation.zoom + 1,
            currentLocation.latitude,
            currentLocation.longitude);
    }

    private getEditOsmLocationAddress(zoom: number, latitude: number, longitude: number): string {
        return `${Urls.osmBase}/edit#map=${zoom}/${latitude}/${longitude}`;
    }

    public getEditOsmGpxAddress(gpxId: string) {
        return `${Urls.osmBase}/edit?gpx=${gpxId}#`;
    }

    private getEditElementOsmAddress(id: string) {
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