import { Component } from "@angular/core";
import { Observable } from "rxjs";
import { NgRedux, select } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { SpatialService } from "../../services/spatial.service";
import { RoutesFactory } from "../../services/layers/routelayers/routes.factory";
import { TracesService } from "../../services/traces.service";
import { AddRouteAction } from "../../reducers/routes.reducer";
import { RemoveMissingPartAction, SetVisibleTraceAction, SetMissingPartsAction } from "../../reducers/traces.reducer";
import type { ApplicationState, LatLngAlt } from "../../models/models";

@Component({
    selector: "traces",
    templateUrl: "./traces.component.html"
})
export class TracesComponent extends BaseMapComponent {

    public visibleTraceName: string;
    public selectedTrace: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    public selectedTraceStart: LatLngAlt;
    public selectedFeature: GeoJSON.Feature<GeoJSON.LineString>;
    public missingCoordinates: LatLngAlt;
    public missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    public selectedFeatureSource: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    public isConfigOpen: boolean;

    @select((state: ApplicationState) => state.tracesState.visibleTraceId)
    private visibleTraceId$: Observable<string>;

    @select((state: ApplicationState) => state.tracesState.missingParts)
    private missingParts$: Observable<GeoJSON.FeatureCollection<GeoJSON.LineString>>;

    constructor(resources: ResourcesService,
                private readonly routesFactory: RoutesFactory,
                private readonly tracesService: TracesService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.isConfigOpen = false;
        this.selectedTrace = null;
        this.selectedTraceStart = null;
        this.visibleTraceName = "";
        this.clearSelection();
        this.missingParts = {
            type: "FeatureCollection",
            features: []
        };
        this.visibleTraceId$.subscribe(async (id) => {
            if (id == null)
            {
                this.clearTraceSource();
                return;
            }
            let visibleTrace = await this.tracesService.getTraceById(id);
            let traceCoordinates = [] as [number, number][];
            let points: GeoJSON.Feature<GeoJSON.Point>[] = [];
            this.visibleTraceName = visibleTrace.name;
            for (let route of visibleTrace.dataContainer.routes) {
                for (let segment of route.segments) {
                    traceCoordinates = traceCoordinates.concat(segment.latlngs.map(l => SpatialService.toCoordinate(l)));
                }
                for (let marker of route.markers) {
                    points.push({
                        type: "Feature",
                        properties: {
                            title: marker.title
                        },
                        geometry: {
                            type: "Point",
                            coordinates: SpatialService.toCoordinate(marker.latlng)
                        }
                    });
                }
            }
            if (traceCoordinates.length === 0) {
                this.clearTraceSource();
                return;
            }
            this.selectedTrace = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    id,
                    properties: { id },
                    geometry: {
                        type: "LineString",
                        coordinates: traceCoordinates
                    }
                }, ...points]
            };

            this.selectedTraceStart = { lat: traceCoordinates[0][1], lng: traceCoordinates[0][0] };
        });
        this.missingParts$.subscribe(m => {
            if (m != null) {
                this.missingParts = m;
            } else {
                this.missingParts = {
                    type: "FeatureCollection",
                    features: []
                };
            }
        });
    }

    private clearTraceSource() {
        this.selectedTrace = {
            type: "FeatureCollection",
            features: []
        };
        this.selectedTraceStart = null;
    }

    public removeMissingPart() {
        this.ngRedux.dispatch(new RemoveMissingPartAction({
            missingPartIndex: this.missingParts.features.indexOf(this.selectedFeature)
        }));
        this.clearSelection();
    }

    public clearSelection() {
        this.selectedFeature = null;
        this.missingCoordinates = null;
        this.selectedFeatureSource = {
            type: "FeatureCollection",
            features: []
        };
    }

    public clearTrace() {
        this.ngRedux.dispatch(new SetMissingPartsAction({
            missingParts: null
        }));
        this.ngRedux.dispatch(new SetVisibleTraceAction({
            traceId: null
        }));
    }

    public async convertToRoute() {
        let traceId = this.ngRedux.getState().tracesState.visibleTraceId;
        let trace = await this.tracesService.getTraceById(traceId);
        for (let route of trace.dataContainer.routes) {
            let routeToAdd = this.routesFactory.createRouteData(route.name);
            routeToAdd.segments = route.segments;
            routeToAdd.markers = route.markers;
            this.ngRedux.dispatch(new AddRouteAction({
                routeData: routeToAdd
            }));
        }
        this.clearTrace();
    }

    public getLatLngForFeature(feautre: GeoJSON.Feature<GeoJSON.LineString>) {
        return SpatialService.toLatLng(feautre.geometry.coordinates[0] as [number, number]);
    }

    public setSelectedFeature(feature: GeoJSON.Feature<GeoJSON.LineString>, event: Event) {
        this.selectedFeature = feature;
        this.missingCoordinates = this.getLatLngForFeature(this.selectedFeature);
        this.selectedFeatureSource = {
            type: "FeatureCollection",
            features: [this.selectedFeature]
        };
        event.stopPropagation();
    }
}
