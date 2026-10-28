import { EventEmitter, NgZone, inject, Service } from "@angular/core";
import { BackgroundGeolocation, Location, CallbackError } from "@capgo/background-geolocation";
import { App } from "@capacitor/app";
import { Store } from "@ngxs/store";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { SelectedRouteService } from "./selected-route.service";
import { SpatialHelper } from "./spatial.helper";
import { SetCurrentPositionAction, SetTrackingStateAction } from "../reducers/gps.reducer";
import type { ApplicationState, LatLngAltTime } from "../models";

@Service()
export class GeoLocationService {
    private static readonly LOCATION_LOG_READ_LIMIT = 10000;

    private isBackground = false;
    private wasInitialized = false;
    private lastLocationLogId: number | undefined;
    private locationLogReads: Promise<GeolocationPosition[]> = Promise.resolve([]);
    private isLocationLogReadWaiting = false;

    /**
     * Emits every position the plugin logged, in the order it received them, including the ones that came while
     * the app was in the background or killed. Nothing is logged in the browser, so it never emits there.
     */
    public readonly positionsReceived = new EventEmitter<GeolocationPosition[]>();
    public readonly backToForeground = new EventEmitter<void>();

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

    /**
     * Picks tracking back up where the last session left it. Deliberately not part of initialize:
     * it asks for the location permission, which should only happen once there is a map to show the
     * position on, never to someone who just opened a content page.
     */
    public restoreTracking() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking !== "disabled") {
            this.store.dispatch(new SetTrackingStateAction("disabled"));
            this.enable();
        }
    }

    public initialize() {
        this.store.select((s: ApplicationState) => s.routes.present).subscribe(() => {
            this.sendPlannedRouteToPluginIfNeeded();
        });

        if (!this.runningContextService.isCapacitor) {
            return;
        }

        App.addListener("appStateChange", (state) => {
            this.isBackground = !state.isActive;
            const appStateMessage = `[GeoLocation] Now in ${this.isBackground ? "back" : "fore"}ground`;
            this.loggingService.info(appStateMessage);
            this.loggingService.info(appStateMessage, "gps");
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
                    await this.readLocationLog();
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
            this.loggingService.warning("[GeoLocation] Background tracking already started, skipping...");
            return;
        }
        this.loggingService.info("[GeoLocation] Starting background tracking");
        try {
            await BackgroundGeolocation.start({
                backgroundMessage: this.resources.runningInBackground,
                backgroundTitle: "Mapeak",
                requestPermissions: true,
                stale: true,
                distanceFilter: 2,
                locationLog: true
            }, (location?: Location, error?: CallbackError) => {
                if (location) {
                    this.loggingService.info(`[GeoLocation] Received position: lat: ${location.latitude}, lng: ${location.longitude}, time: ${new Date(location.time).toISOString()}, accuracy: ${location.accuracy}, background: ${this.isBackground}`, "gps");
                    const position = this.locationToPosition(location);
                    const latLng = GeoLocationService.positionToLatLngTime(position);
                    if (SpatialHelper.isJammingTarget(latLng)) {
                        this.toastService.info(this.resources.jammedPositionReceived);
                        return;
                    }
                    if (this.isBackground) {
                        return;
                    }
                    if (!this.runningContextService.isCapacitor) {
                        this.handlePositionChange(position);
                        return;
                    }
                    this.readLocationLog();
                    return;
                } else if (error) {
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
            this.sendPlannedRouteToPluginIfNeeded();
        } catch {
            // ignore errors.
        }
    }

    /**
     * Reads the positions the plugin logged since the previous read, hands them to the listeners and clears them
     * from the log, so the log only holds what the app has not seen yet. Reads run one after the other, as each
     * one carries on from where the previous one left off, and a call made while a read is already waiting gets that
     * read, so the burst of callbacks that arrives when the app returns from the background does not queue a read each.
     * The current position moves once, to the newest one.
     */
    public readLocationLog(): Promise<GeolocationPosition[]> {
        if (this.isLocationLogReadWaiting) {
            return this.locationLogReads;
        }
        this.isLocationLogReadWaiting = true;
        this.locationLogReads = this.locationLogReads.then(async () => {
            this.isLocationLogReadWaiting = false;
            const positions = await this.readAllLocationsFromLog();
            if (positions.length > 0) {
                this.positionsReceived.next(positions);
                this.handlePositionChange(positions.at(-1));
            }
            return positions;
        });
        return this.locationLogReads;
    }

    private async readAllLocationsFromLog(): Promise<GeolocationPosition[]> {
        let positions: GeolocationPosition[] = [];
        try {
            const { entries } = await BackgroundGeolocation.getLocationLog({
                afterId: this.lastLocationLogId,
                limit: GeoLocationService.LOCATION_LOG_READ_LIMIT
            });
            if (entries.length === 0) {
                return positions;
            }
            this.lastLocationLogId = entries.at(-1).id;
            positions = entries.map(e => this.locationToPosition(e))
                .filter(p => !SpatialHelper.isJammingTarget(GeoLocationService.positionToLatLngTime(p)));
            await BackgroundGeolocation.clearLocationLog({ upToId: this.lastLocationLogId });
            if (entries.length < GeoLocationService.LOCATION_LOG_READ_LIMIT) {
                return positions;
            }
            return [...positions, ...await this.readAllLocationsFromLog()];
        } catch (ex) {
            this.loggingService.error(`[GeoLocation] Failed to read the location log: ${(ex as Error).message}`);
            return positions;
        }
    }

    private async stopWatching() {
        this.store.dispatch(new SetTrackingStateAction("disabled"));
        this.store.dispatch(new SetCurrentPositionAction(null));
        if (this.wasInitialized) {
            this.loggingService.info("[GeoLocation] Stopping background tracking");
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

    private sendPlannedRouteToPluginIfNeeded() {
        if (!this.wasInitialized ||
            !this.store.selectSnapshot((s: ApplicationState) => s.configuration).isGotLostWarnings) {
            return;
        }
        const route = this.selectedRouteService.getSelectedRoute();
        const routePoints = route?.segments.map(segment => segment.latlngs.map(l => ([l.lng, l.lat] as [number, number]))).flat(1) || [];
        BackgroundGeolocation.setPlannedRoute({ route: routePoints, soundFile: "content/uh-oh.mp3", distance: 50 });
    }
}
