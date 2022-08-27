import { Component, Input } from "@angular/core";

import { LayersService } from "../../services/layers.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FitBoundsService } from "../../services/fit-bounds.service";
import type { LatLngAlt } from "../../models/models";

type LegendItemType = "POI" | "Way";

export interface ILegendItem {
    latlng: LatLngAlt;
    zoom: number;
    title: string;
    type: LegendItemType;
    osmTags: string[];
    link: string;
    key: keyof ResourcesService;
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
            return `https://wiki.openstreetmap.org/wiki/Tag:${item.osmTags[0].split(" ")[0]}`;
        }
        return item.link;
    }

    public getImageAddress(item: ILegendItem) {
        let styleKey = this.layersService.getSelectedBaseLayer().address.replace(".json", "").split("/").splice(-1)[0];
        return `content/legend/${styleKey}_${item.key}.png`;
    }
}
