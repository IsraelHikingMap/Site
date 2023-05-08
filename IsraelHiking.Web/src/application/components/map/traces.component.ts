import { Component } from "@angular/core";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { SpatialService } from "../../services/spatial.service";
import { RoutesFactory } from "../../services/routes.factory";
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

    @Select((state: ApplicationState) => state.tracesState.visibleTraceId)
    private visibleTraceId$: Observable<string>;

    @Select((state: ApplicationState) => state.tracesState.missingParts)
    private missingParts$: Observable<GeoJSON.FeatureCollection<GeoJSON.LineString>>;

    constructor(resources: ResourcesService,
                private readonly routesFactory: RoutesFactory,
                private readonly tracesService: TracesService,
                private readonly store: Store) {
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
        this.store.dispatch(new RemoveMissingPartAction(this.missingParts.features.indexOf(this.selectedFeature)));
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
        this.store.dispatch(new SetMissingPartsAction(null));
        this.store.dispatch(new SetVisibleTraceAction(null));
    }

    public async convertToRoute() {
        let traceId = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).visibleTraceId;
        let trace = await this.tracesService.getTraceById(traceId);
        for (let route of trace.dataContainer.routes) {
            let routeToAdd = this.routesFactory.createRouteData(route.name);
            routeToAdd.segments = route.segments;
            routeToAdd.markers = route.markers;
            this.store.dispatch(new AddRouteAction(routeToAdd));
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
