import { Injectable } from "@angular/core";
import { last } from "lodash-es";
import { Observable } from "rxjs";
import { NgRedux, Select } from "@angular-redux2/store";

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

    @Select((state: ApplicationState) => state.gpsState.currentPoistion)
    private currentPosition$: Observable<GeolocationPosition>;

    constructor(private readonly resources: ResourcesService,
                private readonly geoLocationService: GeoLocationService,
                private readonly routesFactory: RoutesFactory,
                private readonly tracesService: TracesService,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.rejectedPosition = null;
    }

    public initialize() {
        if (this.ngRedux.getState().recordedRouteState.isRecording) {
            this.loggingService.info("[Record] Recording was interrupted");
            this.toastService.confirm({
                message: this.resources.continueRecording,
                type: "YesNo",
                confirmAction: () => {
                    this.loggingService.info("[Record] User choose to continue recording");
                    this.geoLocationService.enable();
                },
                declineAction: () => {
                    this.loggingService.info("[Record] User choose to stop recording");
                    this.stopRecording();
                },
            });
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
        let currentLocation = this.geoLocationService.positionToLatLngTime(this.ngRedux.getState().gpsState.currentPoistion);
        this.ngRedux.dispatch(new StartRecordingAction());
        this.ngRedux.dispatch(new AddRecordingRoutePointsAction({
            latlngs: [currentLocation]
        }));
    }

    public isRecording() {
        return this.ngRedux.getState().recordedRouteState.isRecording;
    }

    public stopRecording() {
        this.loggingService.info("[Record] Stop recording");
        let recordedRoute = this.ngRedux.getState().recordedRouteState.route;
        this.ngRedux.dispatch(new StopRecordingAction());
        this.addRecordingToTraces(recordedRoute);
    }

    private recordedRouteToRouteData(route: RecordedRoute): RouteData {
        let date = new Date();
        let dateString = date.toISOString().split("T")[0] +
            ` ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
        let name = this.resources.route + " " + dateString;
        let routeData = this.routesFactory.createRouteData(name);
        let routingType = this.ngRedux.getState().routeEditingState.routingType;
        let firstLatlng = route.latlngs[0];
        routeData.segments.push({
            latlngs: [firstLatlng, firstLatlng],
            routePoint: firstLatlng,
            routingType
        });
        routeData.segments.push({
            routingType,
            latlngs: [...route.latlngs],
            routePoint: route.latlngs[route.latlngs.length - 1]
        });
        GpxDataContainerConverterService.splitRouteSegments(routeData);
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

        this.ngRedux.dispatch(new AddRouteAction({
            routeData
        }));
        this.ngRedux.dispatch(new SetSelectedRouteAction({
            routeId: routeData.id
        }));

        this.ngRedux.dispatch(new AddTraceAction({ trace }));
        await this.tracesService.uploadLocalTracesIfNeeded();

        if (this.ngRedux.getState().userState.userInfo == null) {
            this.toastService.warning(this.resources.youNeedToLoginToSeeYourTraces);
        } else if (!this.ngRedux.getState().configuration.isAutomaticRecordingUpload) {
            this.toastService.warning(this.resources.tracesAreOnlySavedLocally);
        } else {
            this.toastService.success(this.resources.fileUploadedSuccessfullyItWillTakeTime);
        }
    }

    private updateRecordingRoute(positions: GeolocationPosition[]) {
        if (!this.ngRedux.getState().recordedRouteState.isRecording) {
            return;
        }
        let lastValidLocation = last(this.ngRedux.getState().recordedRouteState.route.latlngs);
        let validPositions = [];
        for (let position of positions) {
            if (this.validateRecordingAndUpdateState(position, lastValidLocation)) {
                validPositions.push(position);
                lastValidLocation = this.geoLocationService.positionToLatLngTime(position);
            }
        }
        if (validPositions.length === 0) {
            return;
        }
        let locations = validPositions.map(p => this.geoLocationService.positionToLatLngTime(p));
        setTimeout(() => {
            // This is needed when dispatching an action within a @Select subscription event
            this.ngRedux.dispatch(new AddRecordingRoutePointsAction({
                latlngs: locations
            }));
        }, 0);
    }

    private validateRecordingAndUpdateState(position: GeolocationPosition, lastValidLocation: LatLngAltTime): boolean {
        let nonValidReason = this.isValid(lastValidLocation, position);
        if (nonValidReason === "") {
            this.loggingService.debug("[Record] Valid position, updating. coord: " +
                `(${position.coords.latitude}, ${position.coords.longitude}), time: ${new Date(position.timestamp).toISOString()}`);
            this.rejectedPosition = null;
            return true;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = this.geoLocationService.positionToLatLngTime(position);
            this.loggingService.debug(`[Record] Rejecting position, reason: ${nonValidReason}` +
                JSON.stringify(this.geoLocationService.positionToLatLngTime(position)));
            return false;
        }
        nonValidReason = this.isValid(this.rejectedPosition, position);
        if (nonValidReason === "") {
            this.loggingService.debug("[Record] Validating a rejected position: " +
                JSON.stringify(this.geoLocationService.positionToLatLngTime(position)));
            this.rejectedPosition = null;
            return true;
        }
        this.rejectedPosition = this.geoLocationService.positionToLatLngTime(position);
        this.loggingService.debug("[Record] Rejecting position for rejected: " + JSON.stringify(position) + " reason: " + nonValidReason);
        return false;
    }

    private isValid(test: LatLngAltTime, position: GeolocationPosition): string {
        let distance = SpatialService.getDistanceInMeters(test, this.geoLocationService.positionToLatLngTime(position));
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
