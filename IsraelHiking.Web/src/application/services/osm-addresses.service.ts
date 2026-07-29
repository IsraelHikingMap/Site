import { inject, Injectable, computed } from "@angular/core";
import { Urls } from "../urls";
import { Store } from "@ngxs/store";

import type { ApplicationState } from "../models";

@Injectable()
export class OsmAddressesService {

    private readonly store = inject(Store);

    // Signal-backed so callers binding to getOsmAddress() (e.g. the OSM attribution link) react to
    // POI selection / map location changes under OnPush.
    private readonly poiState = this.store.selectSignal((s: ApplicationState) => s.poiState);
    private readonly locationState = this.store.selectSignal((s: ApplicationState) => s.locationState);

    public readonly osmAddress = computed(() => {
        const poiState = this.poiState();
        if (poiState.selectedPointOfInterest != null &&
            poiState.selectedPointOfInterest.properties.poiSource.toLocaleLowerCase() === "osm") {
            return this.getEditElementOsmAddress(poiState.selectedPointOfInterest.properties.identifier);
        }
        const currentLocation = this.locationState();
        return this.getEditOsmLocationAddress(
            currentLocation.zoom + 1,
            currentLocation.latitude,
            currentLocation.longitude);
    });

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