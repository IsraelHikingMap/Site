import { Component, inject, input } from "@angular/core";
import { NgClass, NgIf } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { MatTooltip } from "@angular/material/tooltip";
import { Angulartics2OnModule } from "angulartics2";

import { LayersService } from "../../services/layers.service";
import { ResourcesService } from "../../services/resources.service";
import { FitBoundsService } from "../../services/fit-bounds.service";
import { HIKING_MAP } from "../../reducers/initial-state";
import type { LatLngAlt } from "../../models";

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
    styleUrls: ["./legend-item.component.scss"],
    imports: [NgClass, Dir, Angulartics2OnModule, MatTooltip, NgIf]
})
export class LegendItemComponent {

    public static readonly OSM_TAG_LINK = "osm-tag-link";
    public static readonly OSM_KEY_LINK = "osm-key-link";

    public item = input<ILegendItem>();

    public readonly resources = inject(ResourcesService);

    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly layersService = inject(LayersService);

    public moveToLocation() {
        this.fitBoundsService.flyTo(this.item().latlng, this.item().zoom);
    }

    public getLink() {
        if (this.item().link === LegendItemComponent.OSM_KEY_LINK) {
            return `https://wiki.openstreetmap.org/wiki/Key:${this.item().osmTags[0].split("=")[0]}`;
        }
        if (this.item().link === LegendItemComponent.OSM_TAG_LINK) {
            return `https://wiki.openstreetmap.org/wiki/Tag:${this.item().osmTags[0].split(" ")[0]}`;
        }
        return this.item().link;
    }

    public getImageAddress() {
        // HM TODO: remake legend to be in English
        const styleKey = this.layersService.getSelectedBaseLayer().key;
        return `content/legend/${styleKey === HIKING_MAP ? "IHM" : "ilMTB"}_${this.item().key}.png`;
    }
}
