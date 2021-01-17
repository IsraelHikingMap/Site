import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";
import { first } from "rxjs/operators";
import { last } from "lodash";

import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoLocationService } from "./geo-location.service";
import { RoutesFactory } from "./layers/routelayers/routes.factory";
import { StopRecordingAction, StartRecordingAction } from "../reducres/route-editing-state.reducer";
import { TracesService } from "./traces.service";
import { SpatialService } from "./spatial.service";
import { AddTraceAction } from "../reducres/traces.reducer";
import { AddRouteAction, AddRecordingPointsAction } from "../reducres/routes.reducer";
import { TraceVisibility, DataContainer, ApplicationState, RouteData, ILatLngTime } from "../models/models";

@Injectable()
export class RecordedRouteService {
    private static readonly MAX_TIME_DIFFERENCE = 120; // seconds
    private static readonly MAX_SPPED = 55; // meters / seconds =~ 200 Km/hs
    private static readonly MIN_ACCURACY = 100; // meters

    private rejectedPosition: ILatLngTime;

    constructor(private readonly resources: ResourcesService,
                private readonly geoLocationService: GeoLocationService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly routesFactory: RoutesFactory,
                private readonly tracesService: TracesService,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.rejectedPosition = null;
    }

    public initialize() {
        let lastRecordedRoute = this.selectedRouteService.getRecordingRoute();
        if (lastRecordedRoute != null) {
            this.loggingService.info("[Record] Recording was interrupted");
            this.resources.languageChanged.pipe(first()).toPromise().then(() => {
                // let resources service get the strings
                this.toastService.confirm({
                    message: this.resources.continueRecording,
                    type: "YesNo",
                    confirmAction: () => {
                        this.loggingService.info("[Record] User choose to continue recording");
                        this.geoLocationService.enable();
                        this.selectedRouteService.setSelectedRoute(lastRecordedRoute.id);
                    },
                    declineAction: () => {
                        this.loggingService.info("[Record] User choose to stop recording");
                        this.stopRecording();
                    },
                });
            });
        }

        this.geoLocationService.positionChanged.subscribe(
            (position: Position) => {
                if (position != null) {
                    this.updateRecordingRoute([position]);
                }
            });
        this.geoLocationService.bulkPositionChanged.subscribe(
            (positions: Position[]) => {
                this.updateRecordingRoute(positions);
            });
    }

    public startRecording() {
        this.loggingService.info("[Record] Starting recording");
        this.rejectedPosition = null;
        let date = new Date();
        let name = this.resources.route + " " + date.toISOString().split("T")[0];
        if (!this.selectedRouteService.isNameAvailable(name)) {
            let dateString =
                `${date.toISOString().split("T")[0]} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
            name = this.resources.route + " " + dateString;
        }
        let route = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
        let currentLocation = this.geoLocationService.currentLocation;
        let routingType = this.ngRedux.getState().routeEditingState.routingType;
        route.segments.push({
            routingType,
            latlngs: [currentLocation, currentLocation],
            routePoint: currentLocation
        });
        route.segments.push({
            routingType,
            latlngs: [currentLocation],
            routePoint: currentLocation
        });
        this.ngRedux.dispatch(new AddRouteAction({
            routeData: route
        }));
        this.selectedRouteService.setSelectedRoute(route.id);
        this.ngRedux.dispatch(new StartRecordingAction({
            routeId: route.id
        }));
    }

    public isRecording() {
        return this.selectedRouteService.getRecordingRoute() != null;
    }

    public stopRecording() {
        this.loggingService.info("[Record] Stop recording");
        let recordingRoute = this.selectedRouteService.getRecordingRoute();
        this.ngRedux.dispatch(new StopRecordingAction({
            routeId: recordingRoute.id
        }));
        this.addRecordingToTraces(recordingRoute);
    }

    private async addRecordingToTraces(routeData: RouteData) {
        let latLngs = routeData.segments[0].latlngs;
        let northEast = { lat: Math.max(...latLngs.map(l => l.lat)), lng: Math.max(...latLngs.map(l => l.lng)) };
        let southWest = { lat: Math.min(...latLngs.map(l => l.lat)), lng: Math.min(...latLngs.map(l => l.lng)) };
        let container = {
            routes: [routeData],
            northEast,
            southWest
        } as DataContainer;

        let trace = {
            name: routeData.name,
            description: routeData.description,
            id: routeData.id,
            timeStamp: routeData.segments[0].latlngs[0].timestamp,
            dataContainer: container,
            tags: [],
            tagsString: "",
            visibility: "local" as TraceVisibility,
            isInEditMode: false,
            url: "",
            imageUrl: "",
            dataUrl: "",
            user: ""
        };
        let state = this.ngRedux.getState();
        if (state.configuration.isAutomaticRecordingUpload &&
            state.userState.userInfo != null) {
            try {
                await this.tracesService.uploadRouteAsTrace(routeData);
                this.toastService.success(this.resources.fileUploadedSuccessfullyItWillTakeTime);
            } catch {
                this.ngRedux.dispatch(new AddTraceAction({ trace }));
            }
        } else {
            this.ngRedux.dispatch(new AddTraceAction({ trace }));
        }
        if (state.userState.userInfo == null) {
            this.toastService.warning(this.resources.youNeedToLoginToSeeYourTraces);
        }
    }

    private updateRecordingRoute(positions: Position[]) {
        let recordingRoute = this.selectedRouteService.getRecordingRoute();
        if (recordingRoute == null) {
            return;
        }

        let lastValidLocation = last(last(this.selectedRouteService.getRecordingRoute().segments).latlngs);
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
        this.ngRedux.dispatch(new AddRecordingPointsAction({
            routeId: recordingRoute.id,
            latlngs: locations
        }));
    }

    private validateRecordingAndUpdateState(position: Position, lastValidLocation: ILatLngTime): boolean {
        let nonValidReason = this.isValid(lastValidLocation, position);
        if (nonValidReason === "") {
            this.loggingService.debug(`[Record] Valid position, updating: (${position.coords.latitude}, ${position.coords.longitude})`);
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

    private isValid(test: ILatLngTime, position: Position): string {
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
