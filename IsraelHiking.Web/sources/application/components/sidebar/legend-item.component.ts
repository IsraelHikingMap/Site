import { Component, ViewChild, ElementRef, AfterViewInit, Input } from "@angular/core";
import * as L from "leaflet";

import { LayersService } from "../../services/layers/layers.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { MapLayersFactory } from "../../services/map-layers.factory";
import * as Common from "../../common/IsraelHiking";

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
export class LegendItemComponent extends BaseMapComponent implements AfterViewInit {

    @ViewChild("mapContainer")
    public mapContainer: ElementRef;

    @Input()
    public item: ILegendItem;

    constructor(resources: ResourcesService,
        private mapService: MapService,
        private layersService: LayersService) {
        super(resources);
    }

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
                layers: [MapLayersFactory.createLayer({ address: this.layersService.selectedBaseLayer.address } as Common.LayerData)]
            } as L.MapOptions);
    };

    public moveToLocation(item: ILegendItem) {
        this.mapService.map.flyTo(item.latlng, item.zoom);
    }
}