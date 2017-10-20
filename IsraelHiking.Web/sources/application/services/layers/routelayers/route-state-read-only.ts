import * as L from "leaflet";
import * as _ from "lodash";

import { EditMode } from "./iroute-state";
import { RouteStateBase } from "./route-state-base";
import { IRouteLayer, EditModeString } from "./iroute.layer";
import { IconsService } from "../../icons.service";
import { ISnappingOptions } from "../../snapping.service";
import * as Common from "../../../common/IsraelHiking";

export class RouteStateReadOnly extends RouteStateBase {
    private readOnlyLayers: L.LayerGroup;

    constructor(context: IRouteLayer) {
        super(context);
        this.readOnlyLayers = L.layerGroup([]);
        this.initialize();
    }

    private addPolyline(latlngs: L.LatLng[]): void {
        let routePathOptions = { ...this.context.route.properties.pathOptions } as L.PathOptions;
        routePathOptions.dashArray = "30 10";
        routePathOptions.className = "segment-readonly-indicator";
        let polyline = L.polyline(latlngs, routePathOptions);
        this.readOnlyLayers.addLayer(polyline);
    }

    private createStartAndEndMarkers() {
        let startLatLng = this.context.route.segments[0].latlngs[0];
        let pathOptions = this.context.route.properties.pathOptions;
        this.readOnlyLayers.addLayer(L.marker(startLatLng,
            {
                opacity: pathOptions.opacity,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("green")
            }));
        let endLatLng = this.context.getLastLatLng();
        this.readOnlyLayers.addLayer(L.marker(endLatLng,
            {
                opacity: pathOptions.opacity,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("red")
            }));
    }

    public initialize() {
        this.context.mapService.map.addLayer(this.readOnlyLayers);
        this.readOnlyLayers.clearLayers();
        if (this.context.route.segments.length > 0) {
            this.createStartAndEndMarkers();
            for (let segment of this.context.route.segments) {
                segment.routePointMarker = null;
                segment.polyline = null;
            }
            let groupedLatLngs = this.context.mapService.getGroupedLatLngForAntPath(this.context.route.segments);
            for (let group of groupedLatLngs) {
                this.addPolyline(group);
            }
        }
        for (let marker of this.context.route.markers) {
            let markerWithTitle = this.createPoiMarker(marker, false);
            markerWithTitle.on("click", () => this.changeStateToEditPoi(markerWithTitle));
            this.readOnlyLayers.addLayer(markerWithTitle);
        }
        this.context.mapService.map.on("mousemove", this.onMouseMove);
    }

    public clear() {
        this.context.mapService.map.off("mousemove", this.onMouseMove);
        this.readOnlyLayers.clearLayers();
        this.context.mapService.map.removeLayer(this.readOnlyLayers);
    }

    public getEditMode(): EditMode {
        return EditModeString.none;
    }

    private onMouseMove = (e: L.LeafletMouseEvent): void => {
        let polylines = this.readOnlyLayers.getLayers().filter(f => f instanceof L.Polyline);
        let response = this.context.snappingService.snapTo(e.latlng, {
            sensitivity: 10,
            polylines: polylines
        } as ISnappingOptions);
        if (response.polyline == null) {
            this.context.polylineHovered.next(null);
        } else {
            this.context.polylineHovered.next(response.latlng);
        }
    }

    private changeStateToEditPoi(markerWithTitle: Common.IMarkerWithTitle) {
        let markerLatLng = markerWithTitle.getLatLng();
        this.context.setEditPoiState();
        // old markers are destroyed and new markers are created.
        let newMarker = _.find(this.context.route.markers, m => m.marker != null && m.marker.getLatLng().equals(markerLatLng));
        if (newMarker != null) {
            newMarker.marker.openPopup();
        }
    }
}