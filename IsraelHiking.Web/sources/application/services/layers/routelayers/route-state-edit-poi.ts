import * as L from "leaflet";
import * as _ from "lodash";

import { RouteStateEditBase } from "./route-state-edit-base";
import { IconsService } from "../../icons.service";
import { IRouteLayer, EditModeString, IMarkerWithData } from "./iroute.layer";
import { EditMode } from "./iroute-state";
import { DrawingPoiMarkerPopupComponent } from "../../../components/markerpopup/drawing-poi-marker-popup.component";
import { HoverHandlerState } from "./hover-handler-base";
import { HoverHandlerPoi } from "./hover-handler-poi";
import * as Common from "../../../common/IsraelHiking";


export class RouteStateEditPoi extends RouteStateEditBase {
    constructor(context: IRouteLayer) {
        super(context);
        this.hoverHandler = new HoverHandlerPoi(context);
        this.initialize();
    }

    public initialize(): void {
        super.initialize();
        this.createStartAndEndMarkers();
        for (let routeMarkerWithData of this.context.route.markers) {
            routeMarkerWithData.marker = this.createPoiMarker(routeMarkerWithData, true);
            this.addComponentToPoiMarker(routeMarkerWithData.marker);
        }
    }

    private createStartAndEndMarkers() {
        if (this.context.route.segments.length <= 0) {
            return;
        }
        let pathOptions = this.context.route.properties.pathOptions;
        let marker = L.marker(this.context.route.segments[0].latlngs[0], { draggable: false, clickable: false, riseOnHover: false, icon: IconsService.createRoundIcon("green"), opacity: pathOptions.opacity } as L.MarkerOptions);
        this.context.route.segments[0].routePointMarker = marker;
        marker.addTo(this.context.mapService.map);
        marker = L.marker(this.context.getLastLatLng(), { draggable: false, clickable: false, riseOnHover: false, icon: IconsService.createRoundIcon("red"), opacity: pathOptions.opacity } as L.MarkerOptions);
        marker.addTo(this.context.mapService.map);
        this.context.getLastSegment().routePointMarker = marker;
    }

    protected addPoint(e: L.LeafletMouseEvent) {
        let snappingPointResponse = this.context.snappingService.snapToPoint(e.latlng);
        let markerData = {
            latlng: snappingPointResponse.latlng,
            title: "",
            type: IconsService.getAvailableIconTypes()[0]
        } as Common.MarkerData;
        if (snappingPointResponse.markerData) {
            markerData = snappingPointResponse.markerData;
        }
        let marker = this.createPoiMarker(markerData, true);
        marker.identifier = markerData.id;
        let markerWithData = markerData as IMarkerWithData;
        markerWithData.marker = marker;
        this.context.route.markers.push(markerWithData);
        this.addComponentToPoiMarker(marker);
        setTimeout(() => marker.openPopup(), 200);
        this.context.raiseDataChanged();
    }

    public getEditMode(): EditMode {
        return EditModeString.poi;
    }

    private addComponentToPoiMarker(marker: Common.IMarkerWithTitle): void {
        let factory = this.context.componentFactoryResolver.resolveComponentFactory(DrawingPoiMarkerPopupComponent);
        let containerDiv = L.DomUtil.create("div");
        let poiMarkerPopupComponentRef = factory.create(this.context.injector, [], containerDiv);
        poiMarkerPopupComponentRef.instance.setMarker(marker);
        poiMarkerPopupComponentRef.instance.setRouteLayer(this.context);
        poiMarkerPopupComponentRef.instance.remove = () => {
            let routeMarker = _.find(this.context.route.markers, markerToFind => markerToFind.marker === marker);
            routeMarker.marker.closePopup();
            this.removePoi(routeMarker);
        }
        this.setPoiMarkerEvents(marker);
        poiMarkerPopupComponentRef.instance.angularBinding(poiMarkerPopupComponentRef.hostView);
        marker.bindPopup(containerDiv);
    }

    private setPoiMarkerEvents(marker: Common.IMarkerWithTitle) {
        marker.on("dragstart", () => {
            marker.closePopup();
            this.hoverHandler.setState(HoverHandlerState.DRAGGING);
        });
        marker.on("drag", () => {
            let snappingResponse = this.context.snappingService.snapToPoint(marker.getLatLng());
            marker.setLatLng(snappingResponse.latlng);
        });
        marker.on("dragend", () => {
            let markerInArray = _.find(this.context.route.markers, markerToFind => markerToFind.marker === marker) as IMarkerWithData;
            markerInArray.latlng = marker.getLatLng();
            let snappingPointResponse = this.context.snappingService.snapToPoint(markerInArray.latlng);
            if (snappingPointResponse.markerData != null &&
                !markerInArray.title &&
                markerInArray.type === IconsService.getAvailableIconTypes()[0]) {
                markerInArray.title = snappingPointResponse.markerData.title;
                markerInArray.type = snappingPointResponse.markerData.type;
                markerInArray.description = snappingPointResponse.markerData.description;
                markerInArray.urls = snappingPointResponse.markerData.urls;
                marker.identifier = snappingPointResponse.markerData.id;
                let color = this.context.route.properties.pathOptions.color;
                marker.setIcon(IconsService.createMarkerIconWithColorAndType(color, snappingPointResponse.markerData.type));
                this.context.mapService.setMarkerTitle(marker, snappingPointResponse.markerData.title, color);
                marker.unbindPopup();
                this.addComponentToPoiMarker(marker);
            }
            this.context.raiseDataChanged();
            this.hoverHandler.setState(HoverHandlerState.NONE);
        });
        marker.on("mouseover", () => {
            if (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING) {
                this.hoverHandler.setState(HoverHandlerState.ON_MARKER);
            }
        });
        marker.on("mouseout", () => {
            if (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING) {
                this.hoverHandler.setState(HoverHandlerState.NONE);
            }
        });
    }

    private removePoi = (poi: IMarkerWithData) => {
        this.context.route.markers.splice(this.context.route.markers.indexOf(poi), 1);
        this.destoryMarker(poi.marker);
        this.context.raiseDataChanged();
    }
}