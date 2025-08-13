import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoLocationService } from "./geo-location.service";
import { RoutesFactory } from "./routes.factory";
import { TracesService } from "./traces.service";
import { SpatialService } from "./spatial.service";
import { RunningContextService } from "./running-context.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { StopRecordingAction, StartRecordingAction, AddRecordingRoutePointsAction, AddPendingProcessingRoutePointAction, ClearPendingProcessingRoutePointsAction } from "../reducers/recorded-route.reducer";
import { AddTraceAction } from "../reducers/traces.reducer";
import { AddRouteAction } from "../reducers/routes.reducer";
import { SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import type { TraceVisibility, DataContainer, ApplicationState, RouteData, LatLngAltTime, RecordedRoute, MarkerData } from "../models";

@Injectable()
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

    public initialize() {
        if (this.isRecording()) {
            this.loggingService.info("[Record] Recording was interrupted");
            this.updateRecordingRoute(null); // This will add the last position to the route that might have not been processed.
            this.stopRecording(false);
            this.toastService.warning(this.resources.lastRecordingDidNotEndWell);
        }

        this.store.select((state: ApplicationState) => state.gpsState.currentPosition).subscribe(position => {
            this.updateRecordingRoute(position);
        });
        this.geoLocationService.positionWhileInBackground.subscribe((position: GeolocationPosition) => {
            if (this.isRecording()) {
                this.store.dispatch(new AddPendingProcessingRoutePointAction(position));
            }
        });
        this.geoLocationService.backToForeground.subscribe(() => {
            this.updateRecordingRoute(null);
        });
    }

    public startRecording() {
        this.loggingService.info("[Record] Starting recording");
        this.rejectedPosition = null;
        const gpsState = this.store.selectSnapshot((s: ApplicationState) => s.gpsState);
        const currentLocation = GeoLocationService.positionToLatLngTime(gpsState.currentPosition);
        this.store.dispatch(new StartRecordingAction());
        this.store.dispatch(new AddRecordingRoutePointsAction([currentLocation]));
    }

    public canRecord(): boolean {
        const gpsState = this.store.selectSnapshot((s: ApplicationState) => s.gpsState);
        return gpsState.tracking === "tracking"
            && gpsState.currentPosition != null && this.runningContextService.isCapacitor;
    }

    public isRecording() {
        return this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording;
    }

    public stopRecording(withToast = true) {
        this.loggingService.info("[Record] Stop recording");
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
        const name = "Recorded using IHM at " + dateString;
        const routeData = this.routesFactory.createRouteData(name);
        const routingType = this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType;
        routeData.markers = structuredClone(route.markers) as MarkerData[];
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
            user: ""
        };

        this.store.dispatch(new AddRouteAction(routeData));
        this.store.dispatch(new SetSelectedRouteAction(routeData.id));
        this.store.dispatch(new AddTraceAction(trace));
        await this.tracesService.uploadLocalTracesIfNeeded();
    }

    private updateRecordingRoute(position: GeolocationPosition) {
        if (!this.isRecording()) {
            return;
        }
        const readOnlyPositions = this.store.selectSnapshot((state: ApplicationState) => state.recordedRouteState.pendingProcessing) || [];
        const positions = [...readOnlyPositions];
        if (positions.length > 0) {
            this.loggingService.debug(`[Record] Processing ${positions.length} pending positions`);
            this.store.dispatch(new ClearPendingProcessingRoutePointsAction());
        }
        if (position != null) {
            positions.push(position);
        }
        if (positions.length === 0) {
            return;
        }
        const validPositions = [];
        const routeLatLngs = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState.route).latlngs;
        let lastValidLocation = routeLatLngs[routeLatLngs.length - 1];
        for (const position of positions) {
            if (this.validateRecordingAndUpdateState(position, lastValidLocation)) {
                validPositions.push(position);
                lastValidLocation = GeoLocationService.positionToLatLngTime(position);
            }
        }
        if (validPositions.length === 0) {
            return;
        }
        const locations = validPositions.map(p => GeoLocationService.positionToLatLngTime(p));
        this.store.dispatch(new AddRecordingRoutePointsAction(locations));
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
                JSON.stringify(GeoLocationService.positionToLatLngTime(position)));
            this.rejectedPosition = null;
            return true;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = GeoLocationService.positionToLatLngTime(position);
            this.loggingService.debug(`[Record] Rejecting position, reason: ${nonValidReason} ` +
                JSON.stringify(GeoLocationService.positionToLatLngTime(position)));
            return false;
        }
        nonValidReason = this.isValid(this.rejectedPosition, position);
        if (nonValidReason === "") {
            this.loggingService.debug("[Record] Validating a rejected position: " +
                JSON.stringify(GeoLocationService.positionToLatLngTime(position)));
            this.rejectedPosition = null;
            return true;
        }
        this.rejectedPosition = GeoLocationService.positionToLatLngTime(position);
        this.loggingService.debug("[Record] Rejecting position for rejected: " +
            JSON.stringify(this.rejectedPosition) + " reason: " + nonValidReason);
        return false;
    }

    private isValid(test: LatLngAltTime, position: Immutable<GeolocationPosition>): string {
        const positionLatLng = GeoLocationService.positionToLatLngTime(position);
        const distance = SpatialService.getDistanceInMeters(test, positionLatLng);
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
