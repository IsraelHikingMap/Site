import { MapService } from "../map.service";

export abstract class BasePoiMarkerLayer extends L.Layer {
    private enabled: boolean;
    protected markers: L.MarkerClusterGroup;
    protected markerIcon: L.DivIcon;

    constructor(protected mapService: MapService) {
        super();
        this.enabled = false;
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
   
}