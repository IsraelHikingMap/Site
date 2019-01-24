import { Component, Input, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from "@angular/core";
import { MapComponent, LayerTileComponent } from "ngx-openlayers";
import { source } from "openlayers";

import { LayerData } from "../../models/models";

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

    public ngAfterViewInit(): void {
        this.setSource();
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.setSource();
    }

    private setSource() {
        let tileSource: ol.source.TileArcGISRest | ol.source.XYZ;
        if (this.address.toLowerCase().endsWith("/mapserver")) {
            tileSource = new source.TileArcGISRest({
                url: this.address
            });
        } else {
            tileSource = new source.XYZ({
                url: this.address,
                minZoom: this.minZoom,
                maxZoom: this.maxZoom
            });
        }
        if (this.tileLayer && this.tileLayer.instance) {
            this.tileLayer.instance.setSource(tileSource);
        }
    }
}