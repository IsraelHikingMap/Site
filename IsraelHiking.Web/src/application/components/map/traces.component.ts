import { Component, inject } from "@angular/core";
import { NgIf, NgClass, NgFor } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Angulartics2OnModule } from "angulartics2";
import { SourceDirective, GeoJSONSourceComponent, LayerComponent, MarkerComponent, PopupComponent } from "@maplibre/ngx-maplibre-gl";
import { Store } from "@ngxs/store";

import { CoordinatesComponent } from "../coordinates.component";
import { MissingPartOverlayComponent } from "../overlays/missing-part-overlay.component";
import { ResourcesService } from "../../services/resources.service";
import { SpatialService } from "../../services/spatial.service";
import { RoutesFactory } from "../../services/routes.factory";
import { TracesService } from "../../services/traces.service";
import { AddRouteAction } from "../../reducers/routes.reducer";
import { RemoveMissingPartAction, SetVisibleTraceAction, SetMissingPartsAction } from "../../reducers/traces.reducer";
import type { ApplicationState, LatLngAlt } from "../../models";

@Component({
    selector: "traces",
    templateUrl: "./traces.component.html",
    imports: [SourceDirective, GeoJSONSourceComponent, LayerComponent, NgIf, MarkerComponent, PopupComponent, Dir, NgClass, MatButton, Angulartics2OnModule, MatTooltip, CoordinatesComponent, MissingPartOverlayComponent, NgFor]
})
export class TracesComponent {

    public visibleTraceName: string = "";
    public selectedTrace: GeoJSON.FeatureCollection<GeoJSON.Geometry> = null;
    public selectedTraceStart: LatLngAlt = null;
    public selectedFeature: GeoJSON.Feature<GeoJSON.LineString>;
    public missingCoordinates: LatLngAlt = null;
    public missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: "FeatureCollection",
        features: []
    };
    public selectedFeatureSource: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    public isConfigOpen: boolean = false;

    public readonly resources = inject(ResourcesService);

    private readonly routesFactory = inject(RoutesFactory);
    private readonly tracesService = inject(TracesService);
    private readonly store = inject(Store);

    constructor() {
        this.clearSelection();
        this.store.select((state: ApplicationState) => state.tracesState.visibleTraceId).pipe(takeUntilDestroyed()).subscribe(async (id) => {
            if (id == null) {
                this.clearTraceSource();
                return;
            }
            const visibleTrace = await this.tracesService.getTraceById(id);
            let traceCoordinates = [] as [number, number][];
            const points: GeoJSON.Feature<GeoJSON.Point>[] = [];
            this.visibleTraceName = visibleTrace.name;
            for (const route of visibleTrace.dataContainer.routes) {
                for (const segment of route.segments) {
                    traceCoordinates = traceCoordinates.concat(segment.latlngs.map(l => SpatialService.toCoordinate(l)));
                }
                for (const marker of route.markers) {
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
        this.store.select((state: ApplicationState) => state.tracesState.missingParts).pipe(takeUntilDestroyed()).subscribe(m => {
            if (m != null) {
                this.missingParts = structuredClone(m) as GeoJSON.FeatureCollection<GeoJSON.LineString>;
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
        this.clearSelection();
    }

    public async convertToRoute() {
        const traceId = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).visibleTraceId;
        const trace = await this.tracesService.getTraceById(traceId);
        for (const route of trace.dataContainer.routes) {
            const routeToAdd = this.routesFactory.createRouteData(route.name);
            routeToAdd.segments = route.segments;
            routeToAdd.markers = route.markers;
            this.store.dispatch(new AddRouteAction(routeToAdd));
        }
        this.clearTrace();
    }

    public getLatLngLikeForFeature(feautre: GeoJSON.Feature<GeoJSON.LineString>): GeoJSON.Position {
        return feautre.geometry.coordinates[0];
    }

    public setSelectedFeature(feature: GeoJSON.Feature<GeoJSON.LineString>, event: Event) {
        this.selectedFeature = feature;
        const coordinates = this.getLatLngLikeForFeature(this.selectedFeature);
        this.missingCoordinates = { lat: coordinates[1], lng: coordinates[0] };
        this.selectedFeatureSource = {
            type: "FeatureCollection",
            features: [this.selectedFeature]
        };
        event.stopPropagation();
    }
}
