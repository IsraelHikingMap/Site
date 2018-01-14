import { Component, ViewChild, ElementRef, AfterViewInit, Input } from "@angular/core";
import * as L from "leaflet";

import { LayersService } from "../../services/layers/layers.service";

type LegendItemType = "POI" | "Way";

export interface ILegendItem {
    latlng: L.LatLng;
    zoom: number;
    title: string;
    type: LegendItemType;
    osmTags: string[];
    link: string;
}

@Component({
    selector: "legend-item",
    templateUrl: "./legend-item.component.html",
    styleUrls: ["./legend-item.component.css"]
})
export class LegendItemComponent implements AfterViewInit {

    @ViewChild("mapContainer")
    public mapContainer: ElementRef;

    @Input()
    public item: ILegendItem;

    constructor(private layersService: LayersService) { }

    public ngAfterViewInit(): void {
        L.map(this.mapContainer.nativeElement,
            {
                center: this.item.latlng,
                zoom: this.item.zoom,
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                touchZoom: false,
                tap: false,
                keyboard: false,
                inertia: false,
                layers: [L.tileLayer(this.layersService.selectedBaseLayer.address)]
            } as L.MapOptions);
    };
}