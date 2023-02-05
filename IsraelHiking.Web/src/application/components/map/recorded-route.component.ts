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

    constructor(resources: ResourcesService,
        private readonly routeEditPoiInteraction: RouteEditPoiInteraction,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);

        this.recordedRouteSegments = [];

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

        if (latlngs.length / RecordedRouteComponent.NUMBER_OF_POINTS_IN_ROUTE_SPLIT <= this.recordedRouteSegments.length) {
            this.recordedRouteSegments.pop(); // remove last segmenet
        }
        latlngs.splice(0, RecordedRouteComponent.NUMBER_OF_POINTS_IN_ROUTE_SPLIT * this.recordedRouteSegments.length - 1);

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
    }
}
