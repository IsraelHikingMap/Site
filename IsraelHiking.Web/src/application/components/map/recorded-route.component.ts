import { NgRedux, Select } from "@angular-redux2/store";
import { Component } from "@angular/core";
import { Observable } from "rxjs";

import { BaseMapComponent } from "../base-map.component";
import { RouteEditPoiInteraction } from "../intercations/route-edit-poi.interaction";
import { ResourcesService } from "../../services/resources.service";
import { SpatialService } from "../../services/spatial.service";
import { ApplicationState, RecordedRoute } from "../../models/models";

@Component({
    selector: "recorded-route",
    templateUrl: "./recorded-route.component.html"
})
export class RecordedRouteComponent extends BaseMapComponent {

    static readonly NUMBER_OF_POINTS_IN_ROUTE_SPLIT = 100;

    @Select((state: ApplicationState) => state.recordedRouteState.isAddingPoi)
    public isAddingPoi$: Observable<boolean>;

    @Select((state: ApplicationState) => state.recordedRouteState.route)
    public recordedRoute$: Observable<RecordedRoute>;

    public recordedRouteSegments: GeoJSON.FeatureCollection<GeoJSON.LineString>[];
    public startPointGeoJson: GeoJSON.Feature<GeoJSON.Point>;

    private lastSplit: number;

    constructor(resources: ResourcesService,
        private readonly routeEditPoiInteraction: RouteEditPoiInteraction,
        private readonly ngRedux: NgRedux<ApplicationState>) {
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

        this.recordedRoute$.subscribe(() => this.handleRecordingChanges());
    }

    public isRecording() {
        return this.ngRedux.getState().recordedRouteState.isRecording;
    }

    public markerDragEnd(index: number, event: any) {
        this.routeEditPoiInteraction.handleDragEnd(event.getLngLat(), index);
    }

    public trackByIndex(_segment: GeoJSON.FeatureCollection<GeoJSON.LineString>, index: number) {
        return index;
    }

    private handleRecordingChanges() {
        let recording = this.ngRedux.getState().recordedRouteState.route;
        if (recording == null || recording.latlngs.length === 0) {
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
            return;
        }
        let latlngs = [...recording.latlngs];
        if (this.startPointGeoJson.geometry.coordinates.length <= 0) {
            this.startPointGeoJson = {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: SpatialService.toCoordinate(latlngs[0])
                },
                properties: {}
            };
        }

        // Refresh the last segment with current data
        latlngs.splice(0, this.lastSplit);
        this.recordedRouteSegments.pop();
        this.recordedRouteSegments.push({
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: latlngs.map(l => SpatialService.toCoordinate(l))
                },
                properties: {}
            }]
        });
        if (recording.latlngs.length - this.lastSplit > RecordedRouteComponent.NUMBER_OF_POINTS_IN_ROUTE_SPLIT) {
            // In case the segment is too long, update last split point and create an empty segment to allow the next updates to refresh it
            this.lastSplit = recording.latlngs.length - 1;
            this.recordedRouteSegments.push({
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: []
                    },
                    properties: {}
                }]
            });
        }
    }
}
