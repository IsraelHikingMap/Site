import { Component, Input, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from "@angular/core";
import { LayerTileComponent, MapComponent } from "ngx-ol";
import { XYZ, TileArcGISRest } from "ol/source";
import olms from "ol-mapbox-style";

@Component({
    selector: "auto-layer",
    templateUrl: "./automatic-layer-presentation.component.html"
})
export class AutomaticLayerPresentationComponent implements AfterViewInit, OnChanges {

    @Input()
    public address: string;
    @Input()
    public minZoom: number;
    @Input()
    public maxZoom: number;
    @Input()
    public opacity: number;
    @Input()
    public visible: boolean;
    @Input()
    public zIndex: number;

    @ViewChild("tileLayer")
    public tileLayer: LayerTileComponent;

    private olmsAddressLoading = null;
    private layers: any[];

    constructor(private readonly host: MapComponent) {
        this.olmsAddressLoading = null;
        this.layers = [];
    }

    public ngAfterViewInit(): void {
        this.setSource();
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.setSource();
    }

    private async setSource() {
        let tileSource: TileArcGISRest | XYZ;
        this.removeVectorLayers();
        if (this.address.toLowerCase().endsWith("json") && this.host.instance) {
            if (this.olmsAddressLoading !== this.address) {
                this.olmsAddressLoading = this.address;
                this.removeVectorLayers();
                await olms(this.host.instance, this.address);
                this.layers = this.host.instance.getLayers().getArray().filter(l => l.getProperties()["mapbox-source"] != null);
                this.olmsAddressLoading = null;
            }
        } else if (this.address.toLowerCase().endsWith("/mapserver")) {
            tileSource = new TileArcGISRest({
                url: this.address
            });
        } else {
            tileSource = new XYZ({
                url: this.address,
                minZoom: this.minZoom,
                maxZoom: this.maxZoom
            });
        }
        if (this.tileLayer && this.tileLayer.instance) {
            this.tileLayer.instance.setSource(tileSource);
        }
    }

    private removeVectorLayers() {
        for (let layer of this.layers) {
            this.host.instance.removeLayer(layer);
        }
        this.host.instance.getTargetElement().style.backgroundColor = "";
        this.layers = [];
    }
}