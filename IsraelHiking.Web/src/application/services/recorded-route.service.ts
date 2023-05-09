import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";

import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoLocationService } from "./geo-location.service";
import { RoutesFactory } from "./routes.factory";
import { TracesService } from "./traces.service";
import { SpatialService } from "./spatial.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { StopRecordingAction, StartRecordingAction, AddRecordingRoutePointsAction } from "../reducers/recorded-route.reducer";
import { AddTraceAction } from "../reducers/traces.reducer";
import { AddRouteAction } from "../reducers/routes.reducer";
import { SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import type { TraceVisibility, DataContainer, ApplicationState, RouteData, LatLngAltTime, RecordedRoute } from "../models/models";

@Injectable()
export class RecordedRouteService {
    private static readonly MAX_TIME_DIFFERENCE = 120; // seconds
    private static readonly MAX_SPPED = 55; // meters / seconds =~ 200 Km/hs
    private static readonly MIN_ACCURACY = 100; // meters

    private rejectedPosition: LatLngAltTime;
    private lastValidLocation: LatLngAltTime;

    @Select((state: ApplicationState) => state.gpsState.currentPosition)
    private currentPosition$: Observable<GeolocationPosition>;

    constructor(private readonly resources: ResourcesService,
                private readonly geoLocationService: GeoLocationService,
                private readonly routesFactory: RoutesFactory,
                private readonly tracesService: TracesService,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService,
                private readonly store: Store) {
        this.rejectedPosition = null;
        this.lastValidLocation = null;
    }

    public initialize() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording) {
            this.loggingService.info("[Record] Recording was interrupted");
            this.stopRecording(false);
            this.toastService.warning(this.resources.lastRecordingDidNotEndWell);
        }

        this.currentPosition$.subscribe(
            (position: GeolocationPosition) => {
                if (position != null) {
                    this.updateRecordingRoute([position]);
                }
            });
        this.geoLocationService.bulkPositionChanged.subscribe(
            (positions: GeolocationPosition[]) => {
                this.updateRecordingRoute(positions);
            });
    }

    public startRecording() {
        this.loggingService.info("[Record] Starting recording");
        this.rejectedPosition = null;
        let gpsState = this.store.selectSnapshot((s: ApplicationState) => s.gpsState);
        let currentLocation = GeoLocationService.positionToLatLngTime(gpsState.currentPosition);
        this.lastValidLocation = currentLocation;
        this.store.dispatch(new StartRecordingAction());
        this.store.dispatch(new AddRecordingRoutePointsAction([currentLocation]));
    }

    public isRecording() {
        return this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording;
    }

    public stopRecording(withToast = true) {
        this.loggingService.info("[Record] Stop recording");
        let recordedRoute = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route;
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

    private recordedRouteToRouteData(route: RecordedRoute): RouteData {
        let date = new Date();
        let dateString = date.toISOString().split("T")[0] +
            ` ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
        let name = this.resources.route + " " + dateString;
        let routeData = this.routesFactory.createRouteData(name);
        let routingType = this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType;
        routeData.markers = route.markers;
        routeData.segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(route.latlngs, routingType);
        return routeData;
    }

    private async addRecordingToTraces(route: RecordedRoute) {
        let latLngs = route.latlngs;
        let northEast = { lat: Math.max(...latLngs.map(l => l.lat)), lng: Math.max(...latLngs.map(l => l.lng)) };
        let southWest = { lat: Math.min(...latLngs.map(l => l.lat)), lng: Math.min(...latLngs.map(l => l.lng)) };
        let routeData = this.recordedRouteToRouteData(route);
        let container = {
            routes: [routeData],
            northEast,
            southWest
        } as DataContainer;

        let trace = {
            name: routeData.name,
            description: routeData.description,
            id: routeData.id,
            timeStamp: route.latlngs[0].timestamp,
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

    private updateRecordingRoute(positions: GeolocationPosition[]) {
        if (!this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording) {
            return;
        }
        let validPositions = [];
        for (let position of positions) {
            if (this.validateRecordingAndUpdateState(position)) {
                validPositions.push(position);
                this.lastValidLocation = GeoLocationService.positionToLatLngTime(position);
            }
        }
        if (validPositions.length === 0) {
            return;
        }
        let locations = validPositions.map(p => GeoLocationService.positionToLatLngTime(p));
        this.store.dispatch(new AddRecordingRoutePointsAction(locations));
    }

    private validateRecordingAndUpdateState(position: GeolocationPosition): boolean {
        let nonValidReason = this.isValid(this.lastValidLocation, position);
        if (nonValidReason === "") {
            this.loggingService.debug("[Record] Valid position, updating. coord: " +
                `(${position.coords.latitude}, ${position.coords.longitude}), time: ${new Date(position.timestamp).toISOString()}`);
            this.rejectedPosition = null;
            return true;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = GeoLocationService.positionToLatLngTime(position);
            this.loggingService.debug(`[Record] Rejecting position, reason: ${nonValidReason}` +
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

    private isValid(test: LatLngAltTime, position: GeolocationPosition): string {
        let distance = SpatialService.getDistanceInMeters(test, GeoLocationService.positionToLatLngTime(position));
        let timeDifference = Math.abs(position.timestamp - test.timestamp.getTime()) / 1000;
        if (timeDifference === 0) {
            return "Time difference is 0";
        }
        if (distance / timeDifference > RecordedRouteService.MAX_SPPED) {
            return "Speed too high: " + distance / timeDifference;
        }
        if (timeDifference > RecordedRouteService.MAX_TIME_DIFFERENCE) {
            return "Time difference too high: " + timeDifference;
        }
        if (position.coords.accuracy > RecordedRouteService.MIN_ACCURACY) {
            return "Accuracy too low: " + position.coords.accuracy;
        }
        return "";
    }
}
