import { Component } from "@angular/core";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { SpatialService } from "../../services/spatial.service";
import { RemoveMissingPartAction, SetVisibleTraceAction, SetMissingPartsAction } from "../../reducres/traces.reducer";
import { AddRouteAction } from "../../reducres/routes.reducer";
import { RoutesFactory } from "../../services/layers/routelayers/routes.factory";
import { Trace, ApplicationState, LatLngAlt } from "../../models/models";


@Component({
    selector: "traces",
    templateUrl: "./traces.component.html"
})
export class TracesComponent extends BaseMapComponent {

    public readonly MISSING_PART = "missingPart";
    public readonly TRACE_CONFIG = "traceConfig";

    public visibleTrace: Trace;
    public selectedTrace: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    public selectedTraceStart: LatLngAlt;
    public selectedFeature: GeoJSON.Feature<GeoJSON.LineString>;
    public missingCoordinates: LatLngAlt;
    public missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    public isConfigOpen: boolean;

    @select((state: ApplicationState) => state.tracesState.visibleTraceId)
    private visibleTraceId$: Observable<string>;

    @select((state: ApplicationState) => state.tracesState.missingParts)
    private missingParts$: Observable<GeoJSON.FeatureCollection<GeoJSON.LineString>>;

    constructor(resources: ResourcesService,
        private readonly routesFactory: RoutesFactory,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.isConfigOpen = false;
        this.selectedTrace = null;
        this.selectedTraceStart = null;
        this.clearSelection();
        this.missingParts = {
            type: "FeatureCollection",
            features: []
        };
        this.visibleTraceId$.subscribe((id) => {
            this.visibleTrace = this.ngRedux.getState().tracesState.traces.find(t => t.id === id);
            let traceCoordinates = [];
            if (this.visibleTrace == null) {
                this.clearTraceSource();
                return;
            }
            for (let route of this.visibleTrace.dataContainer.routes) {
                for (let segment of route.segments) {
                    traceCoordinates = traceCoordinates.concat(segment.latlngs.map(l => SpatialService.toCoordinate(l)));
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
                    id: id,
                    properties: { id: id },
                    geometry: {
                        type: "LineString",
                        coordinates: traceCoordinates
                    }
                }]
            };

            this.selectedTraceStart = { lat: traceCoordinates[0][1], lng: traceCoordinates[0][0] };
        });
        this.missingParts$.subscribe(m => {
            if (m != null) {
                for (let missingIndex = 0; missingIndex < m.features.length; missingIndex++) {
                    m.features[missingIndex].properties.index = missingIndex;
                }
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
    }

    public clearTrace() {
        this.ngRedux.dispatch(new SetMissingPartsAction({
            missingParts: null
        }));
        this.ngRedux.dispatch(new SetVisibleTraceAction({
            traceId: null
        }));
    }

    public convertToRoute() {
        for (let route of this.visibleTrace.dataContainer.routes) {
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

    public setSelectedFeature(feature, event: Event) {
        this.selectedFeature = feature;
        this.missingCoordinates = this.getLatLngForFeature(this.selectedFeature);
        event.stopPropagation();
    }
}