import { EditMode } from "./IRouteState";
import { RouteStateBase } from "./RouteStateBase";
import { IRouteLayer, EditModeString } from "./IRouteLayer";
import { IconsService } from "../../IconsService";
import { ISnappingOptions } from "../../SnappingService";
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
                keyboard: false,
                icon: IconsService.createRoundIcon("green")
            }));
        let lastSegmentLatLngs = this.context.route.segments[this.context.route.segments.length - 1].latlngs;
        let endLatLng = lastSegmentLatLngs[lastSegmentLatLngs.length - 1];
        this.readOnlyLayers.addLayer(L.marker(endLatLng,
            {
                opacity: pathOptions.opacity,
                draggable: false,
                clickable: false,
                keyboard: false,
                icon: IconsService.createRoundIcon("red")
            }));
    }

    public initialize() {
        this.context.mapService.map.addLayer(this.readOnlyLayers);
        this.readOnlyLayers.clearLayers();
        if (this.context.route.segments.length > 0) {
            this.createStartAndEndMarkers();
            let groupedLatLngs = [] as L.LatLng[]; // gourp as many segment in order for the ant path to look smoother
            for (let segment of this.context.route.segments) {
                segment.routePointMarker = null;
                segment.polyline = null;
                if (groupedLatLngs.length === 0) {
                    groupedLatLngs = segment.latlngs;
                    continue;
                }
                if (groupedLatLngs[groupedLatLngs.length - 1].equals(segment.latlngs[0])) {
                    groupedLatLngs = groupedLatLngs.concat(segment.latlngs);
                    continue;
                }
                this.addPolyline(groupedLatLngs);
                groupedLatLngs = segment.latlngs;
            }
            this.addPolyline(groupedLatLngs);
        }
        for (let marker of this.context.route.markers) {
            this.readOnlyLayers.addLayer(this.createPoiMarker(marker, false));
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

    private onMouseMove = (e: L.MouseEvent): void => {
        let response = this.context.snappingService.snapTo(e.latlng, {
            sensitivity: 10,
            layers: this.readOnlyLayers
        } as ISnappingOptions);
        if (response.polyline == null) {
            this.context.polylineHovered.next(null);
        } else {
            this.context.polylineHovered.next(response.latlng);
        }
    }
}