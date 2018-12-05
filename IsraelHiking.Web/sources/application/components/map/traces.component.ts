import { Component, AfterViewInit } from "@angular/core";
import { MapBrowserEvent, Feature, geom, Coordinate } from "openlayers";
import { MapComponent } from "ngx-openlayers";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { SpatialService } from "../../services/spatial.service";
import { RemoveMissingPartAction, SetVisibleTraceAction, SetMissingPartsAction } from "../../reducres/traces.reducer";
import { AddRouteAction } from "../../reducres/routes.reducer";
import { Trace, ApplicationState, LatLngAlt } from "../../models/models";
import { RouteLayerFactory } from "../../services/layers/routelayers/route-layer.factory";

@Component({
    selector: "traces",
    templateUrl: "./traces.component.html"
})
export class TracesComponent extends BaseMapComponent implements AfterViewInit {

    public readonly MISSING_PART = "missingPart";
    public readonly TRACE_CONFIG = "traceConfig";

    public visibleTrace: Trace;
    public traceCoordinates: Coordinate[];
    public selectedFeature: GeoJSON.Feature<GeoJSON.LineString>;
    public missingCoordinates: LatLngAlt;
    public missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    public isConfigOpen: boolean;

    @select((state: ApplicationState) => state.tracesState.visibleTraceId)
    private visibleTraceId$: Observable<string>;

    @select((state: ApplicationState) => state.tracesState.missingParts)
    private missingParts$: Observable<GeoJSON.FeatureCollection<GeoJSON.LineString>>;

    constructor(resources: ResourcesService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly host: MapComponent,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.isConfigOpen = false;
        this.traceCoordinates = [];
        this.visibleTraceId$.subscribe((id) => {
            this.visibleTrace = this.ngRedux.getState().tracesState.traces.find(t => t.id === id);
            this.traceCoordinates = [];
            if (this.visibleTrace == null) {
                return;
            }
            for (let route of this.visibleTrace.dataContainer.routes) {
                for (let segment of route.segments) {
                    this.traceCoordinates = this.traceCoordinates.concat(segment.latlngs.map(l => SpatialService.toCoordinate(l)));
                }
            }
        });
        this.missingParts$.subscribe(m => this.missingParts = m);
        this.clearSelection();
    }

    public ngAfterViewInit(): void {
        this.host.instance.on("singleclick", (event: MapBrowserEvent) => {
            let features = (event.map.getFeaturesAtPixel(event.pixel) || []) as Feature[];
            this.missingCoordinates = null;
            if (features.length === 0) {
                return;
            }
            if (features.find(f => f.getId() && f.getId() === this.TRACE_CONFIG) != null) {
                this.isConfigOpen = !this.isConfigOpen;
                return;
            }
            let missingFeature = features.find(f => f.getId() && f.getId().toString().startsWith(this.MISSING_PART));
            if (missingFeature == null) {
                return;
            }
            let index = +(missingFeature.getId().toString().replace(this.MISSING_PART, ""));
            this.selectedFeature = this.missingParts.features[index];
            this.missingCoordinates = SpatialService.fromViewCoordinate((missingFeature.getGeometry() as geom.Point).getCoordinates());
        });
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
            let routeToAdd = this.routeLayerFactory.createRouteData(route.name);
            routeToAdd.segments = route.segments;
            routeToAdd.markers = route.markers;
            this.ngRedux.dispatch(new AddRouteAction({
                routeData: routeToAdd
            }));
        }
        this.clearTrace();
    }
}