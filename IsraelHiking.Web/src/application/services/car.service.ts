import { inject, Injectable } from "@angular/core";
import { registerPlugin } from "@capacitor/core";
import { Store } from "@ngxs/store";

import { SelectedRouteService } from "./selected-route.service";
import { SetLocationAction } from "../reducers/location.reducer";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetPannedAction, SetCarConnectedAction } from "../reducers/in-memory.reducer";
import type { LocationWithBearing } from "./location.service";
import type { ApplicationState } from "../models";

type CarMoveEndEvent = {
    zoom: number;
    lat: number;
    lng: number;
}

type CarConnectedEvent = {
    connected: boolean;
}

type CarMessage = {
    type: string;
    payload: object;
}

interface CarPlugin {
    sendMessage(message: CarMessage): Promise<void>;
    getConnectionState(): Promise<CarConnectedEvent>;
    addListener(eventName: "moveend", listener: (event: CarMoveEndEvent) => void): Promise<void>;
    addListener(eventName: "connected", listener: (event: CarConnectedEvent) => void): Promise<void>;
}

const Car = registerPlugin<CarPlugin>("Car");

@Injectable()
export class CarService {

    private readonly store = inject(Store);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);

    public initialize() {
        if (!this.runningContextService.isCapacitor || this.runningContextService.isIos) {
            // Only android is supported right now.
            return;
        }

        Car.addListener("moveend", (event) => {
            this.store.dispatch(new SetPannedAction(new Date()));
            this.store.dispatch(new SetLocationAction(event.lng, event.lat, event.zoom));
        });
        Car.addListener("connected", (event) => {
            this.loggingService.info(`[Car] connected: ${event.connected}`);
            this.store.dispatch(new SetCarConnectedAction(event.connected));
        });
        Car.getConnectionState().then((event) => {
            this.loggingService.info(`[Car] connected: ${event.connected}`);
            this.store.dispatch(new SetCarConnectedAction(event.connected));
        });
    }

    public updateGpsPosition(location: LocationWithBearing) {
        if (!this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.carConnected)) {
            return;
        }
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
                points,
                weight: route.weight,
                color: route.color,
                opacity: route.opacity
            }
        });
    }
}