import { Injectable, Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { LocalStorageService } from "ngx-store"

import { CategoriesLayer } from "./categories.layer";
import { MapService } from "../map.service";
import { ResourcesService } from "../resources.service";
import { PoiService, CategoriesType } from "../poi.service";
import { FitBoundsService } from "../fit-bounds.service";


@Injectable()
export class CategoriesLayerFactory {
    private categoryLayers: Map<CategoriesType, CategoriesLayer>;

    constructor(private mapService: MapService,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef,
        private resources: ResourcesService,
        private localStorageService: LocalStorageService,
        private poiService: PoiService,
        private fitBoundsService: FitBoundsService) {
        this.categoryLayers = new Map<CategoriesType, CategoriesLayer>();
        for (let category of this.poiService.getCategoriesTypes()) {
            let layer = new CategoriesLayer(this.mapService,
                this.injector,
                this.componentFactoryResolver,
                this.applicationRef,
                this.resources,
                this.localStorageService,
                this.poiService,
                this.fitBoundsService,
                category);
            this.categoryLayers.set(category, layer);
        }
    }

    public get(categoriesType: CategoriesType): CategoriesLayer {
        return this.categoryLayers.get(categoriesType);
    }
}