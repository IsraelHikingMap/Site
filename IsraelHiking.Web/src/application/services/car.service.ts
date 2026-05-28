import { inject, Injectable } from "@angular/core";
import { registerPlugin } from "@capacitor/core";
import { Store } from "@ngxs/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { LayersService } from "./layers.service";
import { DefaultStyleService } from "./default-style.service";
import { ResourcesService } from "./resources.service";
import { SetCarConnectedAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models";

type CarConnectedEvent = {
    connected: boolean;
}

type CarStoreKey = "style" | "route" | "config";

type CarStoreMessage = {
    key: CarStoreKey;
    value: object | null;
}

interface CarPlugin {
    storeValue(message: CarStoreMessage): Promise<void>;
    getConnectionState(): Promise<CarConnectedEvent>;
    addListener(eventName: "connected", listener: (event: CarConnectedEvent) => void): Promise<void>;
}

const Car = registerPlugin<CarPlugin>("Car");

@Injectable()
export class CarService {

    private readonly store = inject(Store);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly resources = inject(ResourcesService);

    public async initialize() {
        if (!this.runningContextService.isCapacitor || this.runningContextService.isIos) {
            // Only android is supported right now.
            return;
        }

        this.store.select((state: ApplicationState) => state.layersState.selectedBaseLayerKey).subscribe(() => {
            this.setStyle();
        });
        this.store.select((state: ApplicationState) => state.routes.present).subscribe(() => {
            this.setRoutes();
        });
        // Style is language-specific, so re-send it whenever the language changes.
        this.store.select((state: ApplicationState) => state.configuration.language).subscribe(() => {
            this.setStyle();
            this.setConfig();
        });
        this.store.select((state: ApplicationState) => state.configuration.units).subscribe(() => {
            this.setConfig();
        });

        const event = await Car.getConnectionState();
        this.loggingService.info(`[Car] Initialization completed, connected: ${event.connected}`);
        this.store.dispatch(new SetCarConnectedAction(event.connected));
    }

    private async setStyle() {
        this.loggingService.info("[Car] Setting style");
        const layerData = this.layersService.getSelectedBaseLayer();
        const styleLike = await this.defaultStyleService.getSourcesAndLayers(layerData, true, "car");
        Car.storeValue({ key: "style", value: styleLike });
    }

    private setRoutes() {
        this.loggingService.info("[Car] Setting routes");
        const routes = this.store.selectSnapshot((state: ApplicationState) => state.routes.present);

        const routesValue = (!routes || !routes.length || routes.every(r => !r.segments || r.segments.length === 0))
            ? []
            : routes.map(route => ({
                points: route.segments.flatMap(s => s.latlngs.map(p => ([p.lng, p.lat]))),
                weight: route.weight,
                color: route.color,
                opacity: route.opacity
            }));

        Car.storeValue({ key: "route", value: { routes: routesValue } });
    }

    private setConfig() {
        Car.storeValue({
            key: "config",
            value: {
                language: this.resources.getCurrentLanguageCodeSimplified(),
                units: this.store.selectSnapshot((state: ApplicationState) => state.configuration.units)
            }
        });
    }
}
