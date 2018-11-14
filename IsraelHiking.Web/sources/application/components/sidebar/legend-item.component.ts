import { Component, ViewChild, ElementRef, Input } from "@angular/core";

import { LayersService } from "../../services/layers/layers.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { LatLngAlt } from "../../models/models";
import { FitBoundsService } from "../../services/fit-bounds.service";

type LegendItemType = "POI" | "Way";

export interface ILegendItem {
    latlng: LatLngAlt;
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
export class LegendItemComponent extends BaseMapComponent {

    public static readonly OSM_TAG_LINK = "osm-tag-link";
    public static readonly OSM_KEY_LINK = "osm-key-link";

    @ViewChild("mapContainer")
    public mapContainer: ElementRef;

    @Input()
    public item: ILegendItem;

    constructor(resources: ResourcesService,
        private fitBoundsService: FitBoundsService,
        private layersService: LayersService) {
        super(resources);
    }

    public getUrl() {
        return this.layersService.getSelectedBaseLayer().address;
    }

    public moveToLocation(item: ILegendItem) {
        this.fitBoundsService.flyTo(item.latlng, item.zoom);
    }

    public getLink(item: ILegendItem) {
        if (item.link === LegendItemComponent.OSM_KEY_LINK) {
            return `https://wiki.openstreetmap.org/wiki/Key:${item.osmTags[0].split("=")[0]}`;
        }
        if (item.link === LegendItemComponent.OSM_TAG_LINK) {
            return `https://wiki.openstreetmap.org/wiki/Tag:${item.osmTags[0]}`;
        }
        return item.link;
    }
}