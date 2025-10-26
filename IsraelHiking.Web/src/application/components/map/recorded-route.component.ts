import { Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AsyncPipe } from "@angular/common";
import { Observable, combineLatest, throttleTime } from "rxjs";
import { Store } from "@ngxs/store";
import { SourceDirective, GeoJSONSourceComponent, LayerComponent, MarkerComponent } from "@maplibre/ngx-maplibre-gl";
import type { Immutable } from "immer";

import { PrivatePoiOverlayComponent } from "../overlays/private-poi-overlay.component";
import { RouteEditPoiInteraction } from "../intercations/route-edit-poi.interaction";
import { ResourcesService } from "../../services/resources.service";
import { SpatialService } from "../../services/spatial.service";
import { ApplicationState, LatLngAltTime, RecordedRoute } from "../../models";

@Component({
    selector: "recorded-route",
    templateUrl: "./recorded-route.component.html",
    imports: [SourceDirective, GeoJSONSourceComponent, LayerComponent, MarkerComponent, PrivatePoiOverlayComponent, AsyncPipe]
})
export class RecordedRouteComponent {

    static readonly NUMBER_OF_POINTS_IN_ROUTE_SPLIT = 4000;

    public isAddingPoi$: Observable<boolean>;
    public recordedRouteSegments: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    public lastRouteSegment: GeoJSON.Feature<GeoJSON.LineString>;
    public startPointGeoJson: GeoJSON.Feature<GeoJSON.Point> = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: []
        },
        properties: {}
    };
    public recordedRoute$: Observable<Immutable<RecordedRoute>>;
    
    private currentPosition$: Observable<Immutable<GeolocationPosition>>;
    private lastSplit: number = 0;

    public readonly resources = inject(ResourcesService);

    private readonly routeEditPoiInteraction = inject(RouteEditPoiInteraction);
    private readonly store = inject(Store);

    constructor() {
        this.recordedRoute$ = this.store.select((state: ApplicationState) => state.recordedRouteState.route);
        this.currentPosition$ = this.store.select((state: ApplicationState) => state.gpsState.currentPosition);

        // Combine streams to work when both current location and recorded route changes, added throttle to avoid a double update of the UI
        combineLatest([this.recordedRoute$, this.currentPosition$]).pipe(throttleTime(50, undefined, { trailing: true }), takeUntilDestroyed())
            .subscribe(() => this.handleRecordingChanges());

        this.isAddingPoi$ = this.store.select((state: ApplicationState) => state.recordedRouteState.isAddingPoi);
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
