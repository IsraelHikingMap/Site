import { inject, Injectable } from "@angular/core";
import { registerPlugin } from '@capacitor/core';
import { Store } from "@ngxs/store";

import { SelectedRouteService } from "./selected-route.service";
import type { LocationWithBearing } from "./location.service";
import { SetLocationAction } from "../reducers/location.reducer";
import { ApplicationState } from "../models";
import { SetPannedAction } from "../reducers/in-memory.reducer";

type CarMoveEndEvent = {
    zoom: number;
    lat: number;
    lng: number;
}

type CarMessage = {
    type: string;
    payload: object;
}

interface CarPlugin {
    sendMessage(message: CarMessage): Promise<void>;
    addListener(eventName: 'moveend', listener: (event: CarMoveEndEvent) => void): Promise<void>;
    addListener(eventName: 'connected', listener: (event: CarMoveEndEvent) => void): Promise<void>;
}

const Car = registerPlugin<CarPlugin>('Car');

@Injectable()
export class CarService {

    private readonly store = inject(Store);
    private readonly selectedRouteService = inject(SelectedRouteService);

    constructor() {
        Car.addListener('moveend', (event) => {
            this.store.dispatch(new SetPannedAction(new Date()));
            this.store.dispatch(new SetLocationAction(event.lng, event.lat, event.zoom));
        });
        Car.addListener('connected', (event) => {
            console.log("car connected", event);
        });
    }

    public updateGpsPosition(location: LocationWithBearing) {
        Car.sendMessage({
            type: "location",
            payload: {
                bearing: location.bearing,
                lat: location.center.lat,
                lng: location.center.lng,
                acc: location.accuracy,
                zoom: this.store.selectSnapshot((s: ApplicationState) => s.locationState.zoom)
            }
        });
        const route = this.selectedRouteService.getClosestRouteToGPS(location.center, location.bearing) ??
            this.selectedRouteService.getSelectedRoute();

        const points = route.segments.flatMap(s => s.latlngs.map(p => ([p.lng, p.lat])));

        Car.sendMessage({
            type: "route",
            payload: {
                points
            }
        });
    }
}