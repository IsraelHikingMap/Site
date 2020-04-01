import { Component, Input } from "@angular/core";

import { LayersService } from "../../services/layers/layers.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FitBoundsService } from "../../services/fit-bounds.service";
import { LatLngAlt } from "../../models/models";
import { Urls } from "../../urls";

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
    styleUrls: ["./legend-item.component.scss"]
})
export class LegendItemComponent extends BaseMapComponent {

    public static readonly OSM_TAG_LINK = "osm-tag-link";
    public static readonly OSM_KEY_LINK = "osm-key-link";


    @Input()
    public item: ILegendItem;
    constructor(resources: ResourcesService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly layersService: LayersService) {
        super(resources);
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

    public getImageAddress(item: ILegendItem) {
        let width = item.type === "POI" ? 50 : 200;
        let styleKey = this.layersService.getSelectedBaseLayer().address.replace(".json", "").split("/").splice(-1)[0];
        return `${Urls.images}?lat=${item.latlng.lat}&lon=${item.latlng.lng}&zoom=${item.zoom}&width=${width}&height=50&style=${styleKey}`;
    }
}
