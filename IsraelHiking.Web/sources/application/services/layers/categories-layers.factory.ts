import { Injectable } from "@angular/core";
import { LocalStorageService } from "ngx-store";

import { CategoriesLayer } from "./categories.layer";
import { MapService } from "../map.service";
import { ResourcesService } from "../resources.service";
import { PoiService, CategoriesType } from "../poi.service";

@Injectable()
export class CategoriesLayerFactory {
    private categoryLayers: Map<CategoriesType, CategoriesLayer>;

    constructor(private readonly mapService: MapService,
        private readonly resources: ResourcesService,
        private readonly localStorageService: LocalStorageService,
        private readonly poiService: PoiService) {
        this.categoryLayers = new Map<CategoriesType, CategoriesLayer>();
        for (let category of this.poiService.getCategoriesTypes()) {
            let layer = new CategoriesLayer(
                this.resources,
                this.mapService,
                this.localStorageService,
                this.poiService,
                category);
            this.categoryLayers.set(category, layer);
        }
    }

    public get(categoriesType: CategoriesType): CategoriesLayer {
        return this.categoryLayers.get(categoriesType);
    }
}