import { Injectable, EventEmitter, NgZone, inject } from "@angular/core";
import { BackgroundGeolocation, Location, CallbackError } from "@capgo/background-geolocation";
import { App } from "@capacitor/app";
import { Store } from "@ngxs/store";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { SelectedRouteService } from "./selected-route.service";
import { SpatialService } from "./spatial.service";
import { SetCurrentPositionAction, SetTrackingStateAction } from "../reducers/gps.reducer";
import type { ApplicationState, LatLngAltTime } from "../models";

@Injectable()
export class GeoLocationService {
    private isBackground = false;
    private wasInitialized = false;
    private lastReceivedPosition: GeolocationPosition | null = null;

    public positionWhileInBackground = new EventEmitter<GeolocationPosition>();
    public backToForeground = new EventEmitter<void>();

    private readonly resources = inject(ResourcesService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);
    private readonly ngZone = inject(NgZone);
    private readonly store = inject(Store);

    public static positionToLatLngTime(position: GeolocationPosition): LatLngAltTime {
        if (position == null) {
            return null;
        }
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: new Date(position.timestamp).toISOString()
        };
    }

    public initialize() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking !== "disabled") {
            this.store.dispatch(new SetTrackingStateAction("disabled"));
            this.enable();
        }

        this.store.select((s: ApplicationState) => s.routes.present).subscribe(() => {
            if (!this.store.selectSnapshot((s: ApplicationState) => s.configuration).isGotLostWarnings) {
                return;
            }
            const route = this.selectedRouteService.getSelectedRoute();
            const routePoints = route?.segments.map(segment => segment.latlngs.map(l => ([l.lng, l.lat] as [number, number]))).flat(1) || [];
            BackgroundGeolocation.setPlannedRoute({ route: routePoints, soundFile: "content/uh-oh.mp3", distance: 50 });
        });

        if (!this.runningContextService.isCapacitor) {
            return;
        }

        App.addListener("appStateChange", (state) => {
            this.isBackground = !state.isActive;
            this.loggingService.info(`[GeoLocation] Now in ${this.isBackground ? "back" : "fore"}ground`);
            if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "disabled") {
                return;
            }
            if (this.isBackground &&
                !this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording &&
                !this.store.selectSnapshot((s: ApplicationState) => s.configuration).isGotLostWarnings &&
                this.wasInitialized) {
                BackgroundGeolocation.stop();
                this.wasInitialized = false;
                return;
            }
            if (!this.isBackground &&
                !this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording &&
                !this.store.selectSnapshot((s: ApplicationState) => s.configuration).isGotLostWarnings &&
                !this.wasInitialized) {
                this.startWatching();
            }
            if (!this.isBackground) {
                this.ngZone.run(async () => {
                    this.handlePositionChange(this.lastReceivedPosition);
                    this.backToForeground.next();
                });
            }
        });
    }

    public async uninitialize() {
        const stateBefore = this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking;
        await this.disable();
        this.store.dispatch(new SetTrackingStateAction(stateBefore));
    }

    public enable() {
        switch (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking) {
            case "disabled":
                this.startWatching();
                return;
            case "searching":
            case "tracking":
                return;

        }
    }

    public async disable() {
        switch (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking) {
            case "disabled":
                return;
            case "searching":
            case "tracking":
                await this.stopWatching();
                return;
        }
    }

    private async startWatching() {
        this.store.dispatch(new SetTrackingStateAction("searching"));
        if (this.wasInitialized) {
            this.loggingService.debug("[GeoLocation] Background tracking already started, skipping...");
            return;
        }
        this.loggingService.info("[GeoLocation] Starting background tracking");
        try {
            await BackgroundGeolocation.start({
                backgroundMessage: this.resources.runningInBackground,
                backgroundTitle: "Mapeak",
                requestPermissions: true,
                stale: true,
                distanceFilter: 2
            }, (location?: Location, error?: CallbackError) => {
                if (location) {
                    this.loggingService.debug("[GeoLocation] Received position: " + `lat: ${location.latitude}, lng: ${location.longitude}, time: ${new Date(location.time).toISOString()}, accuracy: ${location.accuracy}, background: ${this.isBackground}`);
                    const position = this.locationToPosition(location);
                    const latLng = GeoLocationService.positionToLatLngTime(position);
                    if (SpatialService.isJammingTarget(latLng)) {
                        this.toastService.info(this.resources.jammedPositionReceived);
                        return;
                    }
                    this.lastReceivedPosition = position;
                    if (this.isBackground) {
                        this.positionWhileInBackground.next(this.lastReceivedPosition);
                        return;
                    }
                    this.handlePositionChange(this.lastReceivedPosition);
                    return;
                }
                if (error) {
                    this.loggingService.error(`[GeoLocation] Failed to start background tracking: ${error.message} code: ${error.code}`);
                    this.disable();
                    if (this.runningContextService.isIos) {
                        // Apple do not allow opening the app when the app starts,
                        // to avoid complexity, this simply tells the user there's no permissions...
                        this.toastService.warning(this.resources.noLocationPermission);
                        return;
                    }
                    if (error.code === "3") {
                        // Location timeout in the browser, don't do anything...
                        return;
                    }
                    if (error.code === "1" || error.code === "2") {
                        // brwoser permission denied or location unavailable
                        this.toastService.warning(this.resources.pleaseAllowLocationTracking);
                        return;
                    }
                    this.toastService.confirm({
                        message: this.resources.noLocationPermissionOpenAppSettings,
                        type: "OkCancel",
                        confirmAction: () => BackgroundGeolocation.openSettings(),
                        declineAction: () => { }
                    });
                }
            });
            this.wasInitialized = true;
        } catch {
            // ignore errors.
        }
    }

    private async stopWatching() {
        this.store.dispatch(new SetTrackingStateAction("disabled"));
        this.store.dispatch(new SetCurrentPositionAction(null));
        if (this.wasInitialized) {
            this.loggingService.debug("[GeoLocation] Stopping background tracking");
            await BackgroundGeolocation.stop();
            this.wasInitialized = false;
        }
    }

    private handlePositionChange(position: GeolocationPosition): void {
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "searching") {
            this.store.dispatch(new SetTrackingStateAction("tracking"));
        }
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking !== "tracking") {
            return;
        }
        this.store.dispatch(new SetCurrentPositionAction(position));
    }

    private locationToPosition(location: Location): GeolocationPosition {
        return {
            coords: {
                accuracy: location.accuracy,
                altitude: location.altitude,
                latitude: location.latitude,
                longitude: location.longitude,
                speed: location.speed,
                heading: location.bearing
            },
            timestamp: location.time
        } as GeolocationPosition;
    }
}
