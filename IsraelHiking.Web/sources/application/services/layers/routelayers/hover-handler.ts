import { IconsService } from "../../icons.service";
import { IRouteLayer } from "./iroute.layer";

export class HoverHandler {
    public static NONE = "none";
    public static ADD_POINT = "addPoint";
    public static ON_MARKER = "onMarker";
    public static ON_POLYLINE = "onPolyline";
    public static DRAGGING = "dragging";

    private hoverMarker: L.Marker;
    private hoverState: string;
    private hoverPolyline: L.Polyline;
    private routeHover: boolean;

    constructor(private context: IRouteLayer, private middleMarker: L.Marker) {
        this.context = context;
        let pathOptions = this.context.route.properties.pathOptions;
        this.hoverMarker = L.marker(this.context.mapService.map.getCenter(), { clickable: false, keyboard: false, opacity: pathOptions.opacity } as L.MarkerOptions);
        this.middleMarker = middleMarker;
        this.hoverPolyline = L.polyline([]);
        this.setState(HoverHandler.NONE);
        this.routeHover = true;
        this.updateAccordingToRoueProperties();
    }

    public getState = (): string => {
        return this.hoverState;
    }

    public setState = (state: string) => {
        if (this.hoverState === state) {
            return;
        }
        this.hoverState = state;
        switch (this.hoverState) {
            case HoverHandler.NONE:
            case HoverHandler.ON_MARKER:
                this.context.mapService.map.removeLayer(this.hoverPolyline);
                this.context.mapService.map.removeLayer(this.hoverMarker);
                this.context.mapService.map.removeLayer(this.middleMarker);
                break;
            case HoverHandler.ON_POLYLINE:
            case HoverHandler.DRAGGING:
                this.context.mapService.map.removeLayer(this.hoverPolyline);
                this.context.mapService.map.removeLayer(this.hoverMarker);
                this.context.mapService.map.addLayer(this.middleMarker);
                break;
            case HoverHandler.ADD_POINT:
                this.context.mapService.map.addLayer(this.hoverPolyline);
                this.context.mapService.map.addLayer(this.hoverMarker);
                this.context.mapService.map.removeLayer(this.middleMarker);
                break;
        }
    }

    public onMouseMove = (e: L.MouseEvent): void => {
        if (this.hoverState === HoverHandler.ON_MARKER ||
            this.hoverState === HoverHandler.DRAGGING) {
            return;
        }
        if (this.routeHover === false) {
            this.setState(HoverHandler.ADD_POINT);
            this.hoverMarker.setLatLng(e.latlng);
            this.middleMarker.setOpacity(0.0);
            return;
        }
        let snapToResponse = this.context.snapToRoute(e.latlng);
        if (snapToResponse.polyline != null) {
            this.setState(HoverHandler.ON_POLYLINE);
            this.middleMarker.setOpacity(1.0);
            this.middleMarker.setLatLng(snapToResponse.latlng);
            return;
        }

        this.middleMarker.setOpacity(0.0);
        this.setState(HoverHandler.ADD_POINT);
        snapToResponse = this.context.snappingService.snapTo(e.latlng);
        this.hoverMarker.setLatLng(snapToResponse.latlng);
        var hoverStartPoint = this.context.route.segments.length > 0
            ? this.context.getLastSegment().routePoint
            : snapToResponse.latlng;
        this.hoverPolyline.setLatLngs([hoverStartPoint, snapToResponse.latlng]);
    }

    public setRouteHover(routeHover: boolean): void {
        this.routeHover = routeHover;
        this.updateAccordingToRoueProperties();
    }

    public updateAccordingToRoueProperties() {
        let pathOptions = this.context.route.properties.pathOptions;
        this.hoverMarker.setOpacity(pathOptions.opacity);
        let markerIcon = this.routeHover === false
            ? IconsService.createPoiHoverMarkerIcon(pathOptions.color)
            : IconsService.createRouteMarkerIcon(pathOptions.color);
        this.hoverMarker.setIcon(markerIcon);
        this.middleMarker.setIcon(IconsService.createRoundIcon(pathOptions.color));
        let style = this.routeHover === false
            ? { opacity: 0 } as L.PolylineOptions
            : { ...this.context.route.properties.pathOptions, dashArray: "10, 10" } as L.PolylineOptions;
        this.hoverPolyline.setStyle(style);
    }
}