import { Component } from "@angular/core";
import { Observable, combineLatest, throttleTime } from "rxjs";
import { Store, Select } from "@ngxs/store";
import type { Immutable } from "immer";

import { BaseMapComponent } from "../base-map.component";
import { RouteEditPoiInteraction } from "../intercations/route-edit-poi.interaction";
import { ResourcesService } from "../../services/resources.service";
import { SpatialService } from "../../services/spatial.service";
import { GeoLocationService } from "../../services/geo-location.service";
import { ApplicationState, LatLngAltTime, RecordedRoute } from "../../models/models";

@Component({
    selector: "recorded-route",
    templateUrl: "./recorded-route.component.html"
})
export class RecordedRouteComponent extends BaseMapComponent {

    static readonly NUMBER_OF_POINTS_IN_ROUTE_SPLIT = 4000;

    @Select((state: ApplicationState) => state.recordedRouteState.isAddingPoi)
    public isAddingPoi$: Observable<boolean>;

    @Select((state: ApplicationState) => state.recordedRouteState.route)
    public recordedRoute$: Observable<Immutable<RecordedRoute>>;

    @Select((state: ApplicationState) => state.gpsState.currentPosition)
    public currentPosition$: Observable<Immutable<GeolocationPosition>>;

    public recordedRouteSegments: GeoJSON.Feature<GeoJSON.LineString>[];
    public lastRouteSegment: GeoJSON.Feature<GeoJSON.LineString>;
    public startPointGeoJson: GeoJSON.Feature<GeoJSON.Point>;

    private lastSplit: number;

    constructor(resources: ResourcesService,
        private readonly routeEditPoiInteraction: RouteEditPoiInteraction,
        private readonly store: Store) {
        super(resources);

        this.recordedRouteSegments = [];
        this.lastSplit = 0;
        this.startPointGeoJson = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: []
            },
            properties: {}
        };

        // Combine streams to work when both current location and recorded route changes, added throttle to avoid a double update of the UI
        combineLatest([this.recordedRoute$, this.currentPosition$]).pipe(throttleTime(50, undefined, { trailing: true }))
            .subscribe(() => this.handleRecordingChanges());
    }

    public isRecording() {
        return this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording;
    }

    public markerDragEnd(index: number, event: any) {
        this.routeEditPoiInteraction.handleDragEnd(event.getLngLat(), index);
    }

    public trackByIndex(_segment: GeoJSON.FeatureCollection<GeoJSON.LineString>, index: number) {
        return index;
    }

    private handleRecordingChanges() {
        const recording = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route;
        if (recording == null || recording.latlngs.length === 0) {
            this.recordedRouteSegments = [];
            this.lastSplit = 0;
            this.startPointGeoJson = null;
            return;
        }
        const latlngs = [...recording.latlngs];
        if (!this.startPointGeoJson) {
            this.startPointGeoJson = SpatialService.getPointFeature(latlngs[0]);
        }

        latlngs.splice(0, this.lastSplit);
        if (recording.latlngs.length - this.lastSplit <= RecordedRouteComponent.NUMBER_OF_POINTS_IN_ROUTE_SPLIT) {
            // Refresh the last segment with current data
            this.lastRouteSegment = this.getFeatureFromLatLngs(latlngs);
        } else {
            // In case the segment is too long, update last split point, move the current segment to the list and create a segment with last position and current position
            this.lastSplit = recording.latlngs.length - 1;
            this.recordedRouteSegments.push(this.getFeatureFromLatLngs(latlngs));
            this.lastRouteSegment = this.getFeatureFromLatLngs([latlngs[latlngs.length - 1]]);
        }
    }

    private getFeatureFromLatLngs(latlngs: LatLngAltTime[]): GeoJSON.Feature<GeoJSON.LineString> {
        if (latlngs.length === 1) {
            return SpatialService.getLineString([latlngs[0], latlngs[0]]);
        }
        return SpatialService.getLineString(latlngs);
    }
}
