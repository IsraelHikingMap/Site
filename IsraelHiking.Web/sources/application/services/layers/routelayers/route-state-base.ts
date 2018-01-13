import * as L from "leaflet";

import { IRouteState, EditMode } from "./iroute-state";
import { IRouteLayer } from "./iroute.layer";
import { IconsService } from "../../icons.service";
import { DrawingPoiMarkerPopupComponent } from "../../../components/markerpopup/drawing-poi-marker-popup.component";
import * as Common from "../../../common/IsraelHiking";

export abstract class RouteStateBase implements IRouteState {
    protected context: IRouteLayer;

    protected constructor(context: IRouteLayer) {
        this.context = context;
    }

    public abstract initialize(): void;
    public abstract clear(): void;
    public abstract getEditMode(): EditMode;

    public reRoute = (): void => { } // does nothing if not overriden

    protected createPoiMarker = (markerData: Common.MarkerData, isEditable: boolean): Common.IMarkerWithTitle => {
        let pathOptions = this.context.route.properties.pathOptions;
        let color = this.context.route.properties.pathOptions.color;
        let marker = L.marker(markerData.latlng,
            {
                draggable: isEditable,
                clickable: isEditable,
                riseOnHover: isEditable,
                icon: IconsService.createMarkerIconWithColorAndType(color, markerData.type),
                opacity: pathOptions.opacity
            } as L.MarkerOptions) as Common.IMarkerWithTitle;
        marker.identifier = markerData.id;
        this.context.mapService.setMarkerTitle(marker, markerData, color);
        marker.addTo(this.context.mapService.map);
        return marker;
    }

    protected addComponentToPoiMarker(marker: Common.IMarkerWithTitle): DrawingPoiMarkerPopupComponent {
        let factory = this.context.componentFactoryResolver.resolveComponentFactory(DrawingPoiMarkerPopupComponent);
        let containerDiv = L.DomUtil.create("div");
        let poiMarkerPopupComponentRef = factory.create(this.context.injector, [], containerDiv);
        poiMarkerPopupComponentRef.instance.setMarker(marker);
        poiMarkerPopupComponentRef.instance.setRouteLayer(this.context);
        poiMarkerPopupComponentRef.instance.angularBinding(poiMarkerPopupComponentRef.hostView);
        marker.bindPopup(containerDiv);
        return poiMarkerPopupComponentRef.instance;
    }

    protected destoryMarker = (marker: L.Marker) => {
        if (marker == null) {
            return;
        }
        marker.closePopup();
        marker.off("click");
        marker.off("dragstart");
        marker.off("drag");
        marker.off("dragend");
        marker.off("mouseover");
        marker.off("mouseout");
        marker.off("dblclick");
        marker.off("popupopen");
        marker.off("popupclose");
        this.context.mapService.map.removeLayer(marker);
    }
}