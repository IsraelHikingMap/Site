import { Component, AfterViewInit, ViewEncapsulation, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { Dir } from "@angular/cdk/bidi";
import { MatAnchor, MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { MapComponent, SourceDirective, GeoJSONSourceComponent, LayerComponent, PopupComponent, MarkerComponent } from "@maplibre/ngx-maplibre-gl";
import { MapLayerMouseEvent } from "maplibre-gl";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { RoutePointOverlayComponent } from "../overlays/route-point-overlay.component";
import { PrivatePoiOverlayComponent } from "../overlays/private-poi-overlay.component";
import { RoutesPathComponent } from "./routes-path.component";
import { SelectedRouteService } from "../../services/selected-route.service";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { RouteEditPoiInteraction } from "../intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "../intercations/route-edit-route.interaction";
import { Urls } from "../../urls";
import type { LatLngAltTime, ApplicationState, RouteData } from "../../models";

interface RoutePointViewData {
    latlng: LatLngAltTime;
    segmentIndex: number;
}

@Component({
    selector: "routes",
    templateUrl: "./routes.component.html",
    styleUrls: ["./routes.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [SourceDirective, GeoJSONSourceComponent, LayerComponent, PopupComponent, RoutePointOverlayComponent, Dir, MatAnchor, MatTooltip, MatButton, MarkerComponent, PrivatePoiOverlayComponent, RoutesPathComponent]
})
export class RoutesComponent implements AfterViewInit {

    public routePointPopupData: RoutePointViewData;
    public nonEditRoutePointPopupData: { latlng: LatLngAltTime; wazeAddress: string; googleMapsAddress: string; routeId: string };
    public editingRouteGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = {
        type: "FeatureCollection",
        features: []
    };
    public routesGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = {
        type: "FeatureCollection",
        features: []
    };
    public routes: Immutable<RouteData[]> = [];

    public readonly resources = inject(ResourcesService);

    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly routeEditPoiInteraction = inject(RouteEditPoiInteraction);
    private readonly routeEditRouteInteraction = inject(RouteEditRouteInteraction);
    private readonly fileService = inject(FileService);
    private readonly mapComponent = inject(MapComponent);
    private readonly store = inject(Store);

    constructor() {
        this.routeEditRouteInteraction.onRoutePointClick.pipe(takeUntilDestroyed()).subscribe(this.handleRoutePointClick);
        this.store.select((state: ApplicationState) => state.routes.present).pipe(takeUntilDestroyed()).subscribe(routes => this.handleRoutesChanges(routes));
        this.store.select((state: ApplicationState) => state.routeEditingState.selectedRouteId).pipe(takeUntilDestroyed()).subscribe(() => this.handleRoutesChanges(this.routes));
        this.store.select((state: ApplicationState) => state.recordedRouteState.isAddingPoi).pipe(takeUntilDestroyed()).subscribe(() => this.setInteractionAccordingToState());
    }

    private handleRoutesChanges(routes: Immutable<RouteData[]>) {
        this.routes = routes;
        this.setInteractionAccordingToState();
        this.buildFeatureCollections();
    }

    private buildFeatureCollections() {
        let features = [] as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Point>[];
        let editingFeatures = [] as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Point>[];
        for (const route of this.routes) {
            if (route.state === "Hidden") {
                continue;
            }
            if (route.state === "Route") {
                editingFeatures = this.selectedRouteService.createFeaturesForEditingRoute(route);
                continue;
            }
            features = features.concat(this.selectedRouteService.createFeaturesForRoute(route));
        }
        this.routesGeoJson = {
            type: "FeatureCollection",
            features
        };
        this.editingRouteGeoJson = {
            type: "FeatureCollection",
            features: editingFeatures
        };
        this.routeEditRouteInteraction.setData(this.editingRouteGeoJson);
    }

    private handleRoutePointClick = (pointIndex: number) => {
        if (pointIndex == null || (this.routePointPopupData != null && this.routePointPopupData.segmentIndex === pointIndex)) {
            this.routePointPopupData = null;
            return;
        }
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        const segment = selectedRoute.segments[pointIndex];
        setTimeout(() => {
            // allow angular to draw this as it seems not to do it without this timeout...
            this.routePointPopupData = {
                latlng: segment.routePoint,
                segmentIndex: pointIndex,
            };
        }, 0);
    };

    public closeRoutePointPopup() {
        this.routePointPopupData = null;
    }


    private setInteractionAccordingToState() {
        if (this.mapComponent.mapInstance == null) {
            return;
        }
        this.routeEditPoiInteraction.setActive(false, this.mapComponent.mapInstance);
        this.routeEditRouteInteraction.setActive(false, this.mapComponent.mapInstance);
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.mapComponent.mapInstance.getCanvas().style.cursor = "";
        if (this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isAddingPoi ||
            (selectedRoute && selectedRoute.state === "Poi")) {
            this.routeEditPoiInteraction.setActive(true, this.mapComponent.mapInstance);
            this.mapComponent.mapInstance.getCanvas().style.cursor = "pointer";
        } else if (selectedRoute && selectedRoute.state === "Route") {
            this.routeEditRouteInteraction.setActive(true, this.mapComponent.mapInstance);
            this.mapComponent.mapInstance.getCanvas().style.cursor = "pointer";
        }
    }

    public markerDragEnd(index: number, event: any) {
        this.routeEditPoiInteraction.handleDragEnd(event.getLngLat(), index);
    }

    public ngAfterViewInit(): void {
        this.mapComponent.mapLoad.subscribe(async () => {
            this.setInteractionAccordingToState();
        });
    }

    private isEditMode(): boolean {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route");
    }

    public isRouteInEditPoiMode(route: Immutable<RouteData>) {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.id === route.id && selectedRoute.state === "Poi";
    }

    public routeLineMouseEnter(event: any) {
        this.mapComponent.mapInstance.getCanvas().style.cursor = "pointer";
        this.routeLineMouseOver(event);
    }

    public routeLineMouseOver(event: any) {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return;
        }
        if (event.features == null || event.features.length === 0) {
            return;
        }
        if (event.features[0].properties.id !== selectedRoute.id) {
            return;
        }
        this.selectedRouteService.raiseHoverSelectedRoute(event.lngLat);
    }

    public routeLineMouseLeave() {
        this.selectedRouteService.raiseHoverSelectedRoute(null);
        if (!this.isEditMode()) {
            this.mapComponent.mapInstance.getCanvas().style.cursor = "";
        }
    }

    public routeLineClick(event: MapLayerMouseEvent) {
        if (event.features == null || event.features.length === 0) {
            return;
        }
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        const clickedRoute = this.selectedRouteService.getRouteById(event.features[0].properties.id);
        if (clickedRoute != null && clickedRoute !== selectedRoute && !this.isEditMode()) {
            this.selectedRouteService.setSelectedRoute(clickedRoute.id);
        }
    }

    public nonEditRoutePointClick(event: MapLayerMouseEvent) {
        // this event is only fired for routes that are not in edit mode since other interactions are handled in the route edit class
        if (this.isEditMode()) {
            return;
        }
        const pointId = event.features[0].properties.id as string;
        const routeId = pointId.replace("_start", "").replace("_end", "");
        this.nonEditRoutePointPopupData = {
            latlng: event.lngLat,
            wazeAddress: `${Urls.waze}${event.lngLat.lat},${event.lngLat.lng}`,
            googleMapsAddress: `${Urls.googleMaps}${event.lngLat.lat},${event.lngLat.lng}`,
            routeId
        };
    }

    public switchToEditMode(routeId: string) {
        this.selectedRouteService.setSelectedRoute(routeId);
        this.selectedRouteService.changeRouteEditState(routeId, "Route");
        this.nonEditRoutePointPopupData = null;
    }
}
