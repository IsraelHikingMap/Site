import { Injectable, Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import { LocalStorageService } from "ngx-store"

import { CategoriesLayer, CategoriesType } from "./categories.layer";
import { MapService } from "../map.service";
import { ResourcesService } from "../resources.service";
import {PoiService} from "../poi.service";

@Injectable()
export class CategoriesLayerFactory {
    private categoryLayers: Map<CategoriesType, CategoriesLayer>;

    public categoriesTypes: CategoriesType[];

    constructor(private mapService: MapService,
        private http: Http,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef,
        private resources: ResourcesService,
        private localStorageService: LocalStorageService,
        private poiService: PoiService) {
        this.categoriesTypes = ["Points of Interests", "Routes"];
        this.categoryLayers = new Map<CategoriesType, CategoriesLayer>();
        for (let category of this.categoriesTypes) {
            let layer = new CategoriesLayer(this.mapService,
                this.http,
                this.injector,
                this.componentFactoryResolver,
                this.applicationRef,
                this.resources,
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