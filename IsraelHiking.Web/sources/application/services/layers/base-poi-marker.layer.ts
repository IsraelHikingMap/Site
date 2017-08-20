import { MapService } from "../map.service";
import { IconsService } from "../icons.service";
import * as Common from "../../common/IsraelHiking";

export abstract class BasePoiMarkerLayer extends L.Layer {
    private enabled: boolean;
    protected markers: L.MarkerClusterGroup;
    protected readOnlyLayer: L.LayerGroup;
    protected markerIcon: L.DivIcon;

    constructor(protected mapService: MapService) {
        super();
        this.enabled = false;
        this.readOnlyLayer = L.layerGroup([]);
        this.mapService.map.addLayer(this.readOnlyLayer);
        this.markers = L.markerClusterGroup({
            iconCreateFunction: (cluster) => {
                let childCount = cluster.getChildCount();
                let className = "marker-cluster marker-cluster-";
                if (childCount < 10) {
                    className += "small";
                } else if (childCount < 100) {
                    className += "medium";
                } else {
                    className += "large";
                }
                return new L.DivIcon({
                    html: `<div><span><i class="${this.getIconString()}">${childCount}</i></span></div>`,
                    className: className,
                    iconSize: new L.Point(40, 40)
                });
            }
        });
        this.mapService.map.on("moveend", () => {
            this.updateMarkers();
        });
    }

    protected abstract getIconString(): string;
    protected abstract updateMarkersInternal(): void;
    protected abstract getMinimalZoom(): number;

    public onAdd(map: L.Map): this {
        this.enabled = true;
        this.updateMarkers();
        map.addLayer(this.markers);
        return this;
    }

    public onRemove(map: L.Map): this {
        map.removeLayer(this.markers);
        this.readOnlyLayer.clearLayers();
        this.enabled = false;
        return this;
    }

    protected updateMarkers() {
        if (this.mapService.map.getZoom() < this.getMinimalZoom() || this.enabled === false) {
            this.markers.clearLayers();
            return;
        }
        this.updateMarkersInternal();
    }

    protected createReadOnlyLayer = (routeData: Common.RouteData) => {
        this.readOnlyLayer.clearLayers();
        
        if (routeData == null || routeData.segments.length === 0) {
            return;
        }
        let latLngs = [];
        for (let segment of routeData.segments) {
            latLngs = latLngs.concat(segment.latlngs);
        }
        let polyLine = L.polyline(latLngs,
            {
                opacity: 1,
                color: "Blue",
                weight: 3,
                dashArray: "30 10",
                className: "segment-readonly-indicator"
            } as L.PathOptions);
        this.readOnlyLayer.addLayer(polyLine);
        for (let markerData of routeData.markers) {
            let marker = L.marker(markerData.latlng,
                {
                    draggable: false,
                    clickable: false,
                    icon: IconsService.createPoiDefaultMarkerIcon("blue")
                } as L.MarkerOptions);
            marker.bindTooltip(markerData.title, { permanent: true, direction: "bottom" } as L.TooltipOptions);
            this.readOnlyLayer.addLayer(marker);
        }
        this.readOnlyLayer.addLayer(L.marker(latLngs[0],
            {
                opacity: 1,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("green")
            }));
        this.readOnlyLayer.addLayer(L.marker(latLngs[latLngs.length - 1],
            {
                opacity: 1,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("red")
            }));
    }
}