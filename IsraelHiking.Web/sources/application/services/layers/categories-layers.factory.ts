import { Injectable, NgZone } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { CategoriesLayer } from "./categories.layer";
import { MapService } from "../map.service";
import { ResourcesService } from "../resources.service";
import { RunningContextService } from "../running-context.service";
import { PoiService, CategoriesType } from "../poi.service";
import { ApplicationState } from "../../models/models";

@Injectable()
export class CategoriesLayerFactory {
    private categoryLayers: Map<CategoriesType, CategoriesLayer>;

    constructor(private readonly mapService: MapService,
                private readonly resources: ResourcesService,
                private readonly poiService: PoiService,
                private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly ngZone: NgZone) {
        this.categoryLayers = new Map<CategoriesType, CategoriesLayer>();
        for (let category of this.poiService.getCategoriesTypes()) {
            let layer = new CategoriesLayer(
                this.resources,
                this.mapService,
                this.poiService,
                this.runningContextService,
                this.ngRedux,
                this.ngZone,
                category);
            this.categoryLayers.set(category, layer);
        }
    }

    public get(categoriesType: CategoriesType): CategoriesLayer {
        return this.categoryLayers.get(categoriesType);
    }
}
