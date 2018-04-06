import * as L from "leaflet";
import { MarkerClusterGroup } from "leaflet.markercluster";

import { MapService } from "../map.service";

export abstract class BasePoiMarkerLayer extends L.Layer {
    protected visible: boolean;
    protected markers: MarkerClusterGroup;
    protected readOnlyLayer: L.LayerGroup;

    constructor(protected mapService: MapService) {
        super();
        this.visible = false;
        this.readOnlyLayer = L.layerGroup([]);
        this.mapService.map.addLayer(this.readOnlyLayer);
        this.markers = new MarkerClusterGroup({
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
        this.visible = true;
        this.updateMarkers();
        map.addLayer(this.markers);
        return this;
    }

    public onRemove(map: L.Map): this {
        map.removeLayer(this.markers);
        this.readOnlyLayer.clearLayers();
        this.visible = false;
        return this;
    }

    public isVisible() {
        return this.visible;
    }

    protected updateMarkers() {
        if (this.mapService.map.getZoom() < this.getMinimalZoom() || this.visible === false) {
            this.clearMarkersLayer();
            return;
        }
        this.updateMarkersInternal();
    }

    /**
     * This is a temprorary fix until the following issue is resolved:
     * https://github.com/Leaflet/Leaflet.markercluster/issues/860
     * this method can be replaced with this.markers.clearLayers();
     */
    protected clearMarkersLayer() {
        this.markers.eachLayer((m) => {
            this.markers.removeLayer(m);
        });
    }
}