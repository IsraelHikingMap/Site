import { inject, computed, Service } from "@angular/core";
import { Store } from "@ngxs/store";
import { v4 as uuidv4 } from "uuid";
import type { Immutable } from "immer";

import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoLocationService } from "./geo-location.service";
import { RoutesFactory } from "./routes.factory";
import { TracesService } from "./traces.service";
import { SpatialHelper } from "./spatial.helper";
import { RunningContextService } from "./running-context.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { StopRecordingAction, StartRecordingAction, AddRecordingRoutePointsAction } from "../reducers/recorded-route.reducer";
import { AddTraceAction } from "../reducers/traces.reducer";
import { AddRouteAction } from "../reducers/routes.reducer";
import { SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import type { TraceVisibility, DataContainer, ApplicationState, RouteData, LatLngAltTime, RecordedRoute, MarkerData } from "../models";

@Service()
export class RecordedRouteService {
    private static readonly MAX_SPPED = 55; // meters / seconds =~ 200 Km/hs
    private static readonly MIN_ACCURACY = 100; // meters

    private rejectedPosition: LatLngAltTime;

    private readonly resources = inject(ResourcesService);
    private readonly geoLocationService = inject(GeoLocationService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly routesFactory = inject(RoutesFactory);
    private readonly tracesService = inject(TracesService);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);

    private readonly gpsStateSignal = this.store.selectSignal((s: ApplicationState) => s.gpsState);
    private readonly recordedRouteStateSignal = this.store.selectSignal((s: ApplicationState) => s.recordedRouteState);

    // Reactive derived state exposed as signals (not methods) so the reactive contract is explicit in
    // the type: consumers read canRecord()/isRecording() and any change away from a signal breaks them.
    public readonly canRecord = computed(() => {
        const gpsState = this.gpsStateSignal();
        return gpsState.tracking === "tracking"
            && gpsState.currentPosition != null && this.runningContextService.isCapacitor;
    });

    public readonly isRecording = computed(() => this.recordedRouteStateSignal().isRecording);

    public async initialize() {
        if (this.isRecording()) {
            const recordingInterruptedMessage = "[Record] Recording was interrupted";
            this.loggingService.info(recordingInterruptedMessage);
            this.loggingService.info(recordingInterruptedMessage, "gps");
            this.addPositionsToRecording(await this.geoLocationService.readLocationLog());
            this.stopRecording(false);
            this.toastService.warning(this.resources.lastRecordingDidNotEndWell);
        }
        this.geoLocationService.positionsReceived.subscribe((positions: GeolocationPosition[]) => {
            this.addPositionsToRecording(positions);
        });
    }

    public startRecording() {
        const startRecordingMessage = "[Record] Starting recording";
        this.loggingService.info(startRecordingMessage);
        this.loggingService.info(startRecordingMessage, "gps");
        this.rejectedPosition = null;
        const gpsState = this.store.selectSnapshot((s: ApplicationState) => s.gpsState);
        const currentLocation = GeoLocationService.positionToLatLngTime(gpsState.currentPosition);
        this.store.dispatch(new StartRecordingAction());
        this.store.dispatch(new AddRecordingRoutePointsAction([currentLocation]));
    }

    public stopRecording(withToast = true) {
        const stopRecordingMessage = "[Record] Stop recording";
        this.loggingService.info(stopRecordingMessage);
        this.loggingService.info(stopRecordingMessage, "gps");
        const recordedRoute = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route;
        this.store.dispatch(new StopRecordingAction());
        this.addRecordingToTraces(recordedRoute);
        if (withToast === false) {
            return;
        }
        if (this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo == null) {
            this.toastService.warning(this.resources.youNeedToLoginToSeeYourTraces);
        } else if (!this.store.selectSnapshot((s: ApplicationState) => s.configuration).isAutomaticRecordingUpload) {
            this.toastService.warning(this.resources.tracesAreOnlySavedLocally);
        } else {
            this.toastService.success(this.resources.fileUploadedSuccessfullyItWillTakeTime);
        }
    }

    private recordedRouteToRouteData(route: Immutable<RecordedRoute>): RouteData {
        const date = new Date();
        const dateString = date.toISOString().split("T")[0] +
            ` ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
        const name = "Recorded using Mapeak at " + dateString;
        const routeData = this.routesFactory.createRouteData(name);
        const routingType = this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType;
        routeData.markers = structuredClone(route.markers) as MarkerData[];
        for (const marker of routeData.markers) {
            marker.id = uuidv4();
        }
        routeData.segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(route.latlngs, routingType);
        return routeData;
    }

    private async addRecordingToTraces(route: Immutable<RecordedRoute>) {
        const latLngs = route.latlngs;
        const northEast = { lat: Math.max(...latLngs.map(l => l.lat)), lng: Math.max(...latLngs.map(l => l.lng)) };
        const southWest = { lat: Math.min(...latLngs.map(l => l.lat)), lng: Math.min(...latLngs.map(l => l.lng)) };
        const routeData = this.recordedRouteToRouteData(route);
        const container = {
            routes: [routeData],
            northEast,
            southWest
        } as DataContainer;

        const trace = {
            name: routeData.name,
            description: routeData.description,
            id: routeData.id,
            timeStamp: new Date(route.latlngs[0].timestamp),
            dataContainer: container,
            tags: [] as string[],
            tagsString: "",
            visibility: "local" as TraceVisibility,
            isInEditMode: false,
            url: "",
            imageUrl: "",
            dataUrl: "",
            user: "",
            start: routeData.segments[0]?.latlngs?.[0]
        };

        this.store.dispatch(new AddRouteAction(routeData));
        this.store.dispatch(new SetSelectedRouteAction(routeData.id));
        this.store.dispatch(new AddTraceAction(trace));
        await this.tracesService.uploadLocalTracesIfNeeded();
    }

    /**
     * Adds the received positions that are newer than the last one recorded, as the positions of a recording
     * interrupted by the app being killed can be received again when it starts.
     */
    private addPositionsToRecording(positions: GeolocationPosition[]) {
        if (!this.isRecording()) {
            return;
        }
        if (positions.length > 1) {
            this.loggingService.debug(`[Record] Processing ${positions.length} positions`, "gps");
        }
        const routeLatLngs = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState.route).latlngs;
        const lastLatLng = routeLatLngs[routeLatLngs.length - 1];
        const newPositions = positions.filter(p => p.timestamp > new Date(lastLatLng.timestamp).getTime());
        const locations = this.getValidLocations(newPositions, lastLatLng);
        if (locations.length > 0) {
            this.store.dispatch(new AddRecordingRoutePointsAction(locations));
        }
    }

    private getValidLocations(positions: GeolocationPosition[], lastValidLocation: LatLngAltTime): LatLngAltTime[] {
        const locations = [];
        for (const position of positions) {
            if (this.validateRecordingAndUpdateState(position, lastValidLocation)) {
                lastValidLocation = GeoLocationService.positionToLatLngTime(position);
                locations.push(lastValidLocation);
            }
        }
        return locations;
    }

    private validateRecordingAndUpdateState(position: Immutable<GeolocationPosition>, lastValidLocation: LatLngAltTime): boolean {
        if (position.timestamp === new Date(lastValidLocation.timestamp).getTime()) {
            // Ignore positions with the same timestamp as the last valid position without any logging 
            // as this can happen when the device comes back from background and the GPS position is not updated yet.
            return false;
        }
        let nonValidReason = this.isValid(lastValidLocation, position);
        if (nonValidReason === "") {
            this.loggingService.debug("[Record] Valid position, updating. " +
                JSON.stringify(GeoLocationService.positionToLatLngTime(position)), "gps");
            this.rejectedPosition = null;
            return true;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = GeoLocationService.positionToLatLngTime(position);
            this.loggingService.debug(`[Record] Rejecting position, reason: ${nonValidReason} ` +
                JSON.stringify(GeoLocationService.positionToLatLngTime(position)), "gps");
            return false;
        }
        nonValidReason = this.isValid(this.rejectedPosition, position);
        if (nonValidReason === "") {
            this.loggingService.debug("[Record] Validating a rejected position: " +
                JSON.stringify(GeoLocationService.positionToLatLngTime(position)), "gps");
            this.rejectedPosition = null;
            return true;
        }
        this.rejectedPosition = GeoLocationService.positionToLatLngTime(position);
        this.loggingService.debug("[Record] Rejecting position for rejected: " +
            JSON.stringify(this.rejectedPosition) + " reason: " + nonValidReason, "gps");
        return false;
    }

    private isValid(test: LatLngAltTime, position: Immutable<GeolocationPosition>): string {
        const positionLatLng = GeoLocationService.positionToLatLngTime(position);
        const distance = SpatialHelper.getDistanceInMeters(test, positionLatLng);
        const timeDifference = (position.timestamp - new Date(test.timestamp).getTime()) / 1000;
        if (timeDifference <= 0) {
            return `Time difference below or zero: ${timeDifference}`;
        }
        if (distance / timeDifference > RecordedRouteService.MAX_SPPED) {
            return `Speed too high: ${distance / timeDifference}`;
        }
        if (position.coords.accuracy > RecordedRouteService.MIN_ACCURACY) {
            return `Accuracy too low: ${position.coords.accuracy}`;
        }
        return "";
    }
}
