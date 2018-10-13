import { Component, OnInit } from "@angular/core";

import { LayersService } from "../services/layers/layers.service";
import { CategoriesLayerFactory } from "../services/layers/categories-layers.factory";
import { IPointOfInterest } from "../services/poi.service";

@Component({
    selector: "layers-view",
    templateUrl: "layers-view.component.html"
})
export class LayersViewComponent implements OnInit {

    public distance = 60;

    public routes: IPointOfInterest[];
    public points: IPointOfInterest[];

    constructor(
        private readonly layersService: LayersService,
        private readonly categoriesLayerFactory: CategoriesLayerFactory) {
    }

    public getBaseLayer() {
        return this.layersService.selectedBaseLayer.address;
    }

    public getOverlays() {
        return this.layersService.overlays;
    }

    public isPoisVisible() {
        return this.categoriesLayerFactory.get("Points of Interest").isVisible();
    }

    public isRoutesVisible() {
        return this.categoriesLayerFactory.get("Routes").isVisible();
    }

    public getReadOnlyCoordinates() {
        // HM TODO: show traces?
        return [];
    }

    ngOnInit() {
        this.points = this.categoriesLayerFactory.get("Points of Interest").pointsOfInterest;
        this.routes = this.categoriesLayerFactory.get("Routes").pointsOfInterest;
    }
}