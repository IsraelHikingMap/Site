import { inject, Injectable } from "@angular/core";
import { registerPlugin } from "@capacitor/core";
import { Store } from "@ngxs/store";

import { SelectedRouteService } from "./selected-route.service";
import { SetLocationAction } from "../reducers/location.reducer";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { LayersService } from "./layers.service";
import { DefaultStyleService } from "./default-style.service";
import { MapService } from "./map.service";
import { SetPannedAction, SetCarConnectedAction } from "../reducers/in-memory.reducer";
import { LocationService, type LocationWithBearing } from "./location.service";
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

    private lastLocation: LocationWithBearing = null;
    private lastMoveEndTime = new Date();

    private readonly store = inject(Store);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly locationService = inject(LocationService);
    private readonly mapService = inject(MapService);

    public async initialize() {
        if (!this.runningContextService.isCapacitor || this.runningContextService.isIos) {
            // Only android is supported right now.
            return;
        }

        Car.addListener("moveend", (event) => {
            this.store.dispatch(new SetPannedAction(new Date()));
            this.store.dispatch(new SetLocationAction(event.lng, event.lat, event.zoom));
            this.lastMoveEndTime = new Date();
        });
        Car.addListener("connected", (event) => {
            this.loggingService.info(`[Car] connected: ${event.connected}`);
            this.store.dispatch(new SetCarConnectedAction(event.connected));
            this.setStyle();
            this.setRoute();
            this.setCenter();
        });
        this.store.select((state: ApplicationState) => state.layersState.selectedBaseLayerKey).subscribe(() => {
            this.setStyle();
        });
        this.store.select((state: ApplicationState) => state.routes.present).subscribe(() => {
            this.setRoute();
        });
        this.store.select((state: ApplicationState) => state.locationState).subscribe(() => {
            if (new Date().getTime() - this.lastMoveEndTime.getTime() < 100) {
                return;
            }
            this.setCenter();
        });
        this.locationService.changed.subscribe(location => {
            this.lastLocation = location;
            this.setLocation();
        });


        const event = await Car.getConnectionState();
        this.loggingService.info(`[Car] Initialization completed, connected: ${event.connected}`);
        this.store.dispatch(new SetCarConnectedAction(event.connected));
    }

    private async setStyle() {
        this.loggingService.info(`[Car] Setting style`);
        const layerData = this.layersService.getSelectedBaseLayer();
        const styleLike = await this.defaultStyleService.getSourcesAndLayers(layerData, true, "car");
        Car.sendMessage({
            type: "style",
            payload: {
                style: styleLike
            }
        });
        this.setRoute();
        this.setCenter();
        this.setLocation();
    }

    private setLocation() {
        if (this.lastLocation == null) {
            Car.sendMessage({
                type: "location",
                payload: null
            });
            return;
        }
        Car.sendMessage({
            type: "location",
            payload: {
                bearing: this.lastLocation.bearing,
                lat: this.lastLocation.center.lat,
                lng: this.lastLocation.center.lng,
                acc: this.lastLocation.accuracy,
            }
        });
    }

    private setRoute() {
        const route = this.selectedRouteService.getClosestRouteToGPS(this.locationService.getLocationCenter(), this.lastLocation?.bearing ?? 0) ??
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

    private setCenter() {
        var locationState = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        Car.sendMessage({
            type: "center",
            payload: {
                lat: locationState.latitude,
                lng: locationState.longitude,
                zoom: locationState.zoom,
                bearing: this.mapService.getBearing()
            }
        });
    }
}