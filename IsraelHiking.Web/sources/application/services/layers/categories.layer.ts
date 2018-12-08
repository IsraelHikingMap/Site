import { LocalStorageService } from "ngx-store";
import { MapBrowserEvent } from "openlayers";
import { Subject } from "rxjs";
import { every } from "lodash";

import { ResourcesService } from "../resources.service";
import { PoiService, CategoriesType, ICategory } from "../poi.service";
import { BaseMapComponent } from "../../components/base-map.component";
import { SpatialService } from "../spatial.service";
import { MapService } from "../map.service";
import { PointOfInterest } from "../../models/models";

export class CategoriesLayer extends BaseMapComponent {

    private static readonly VISIBILITY_POSTFIX = "_visibility";
    private static readonly SELECTED_POSTFIX = "_selected";

    private visible: boolean;
    private requestsNumber: number;
    public markersLoaded: Subject<void>;

    public categories: ICategory[];
    public pointsOfInterest: PointOfInterest[];

    constructor(resources: ResourcesService,
        private readonly mapService: MapService,
        private readonly localStorageService: LocalStorageService,
        private readonly poiService: PoiService,
        private readonly categoriesType: CategoriesType) {
        super(resources);
        this.categories = [];
        this.pointsOfInterest = [];
        this.markersLoaded = new Subject<void>();
        this.requestsNumber = 0;
        this.visible = this.localStorageService.get(this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX) || false;
        this.poiService.getCategories(this.categoriesType).then((categories) => {
            for (let category of categories) {
                let selected = this.localStorageService.get(category.name + CategoriesLayer.SELECTED_POSTFIX) == null
                    ? this.visible
                    : this.localStorageService.get(category.name + CategoriesLayer.SELECTED_POSTFIX);
                category.isSelected = selected;
                this.categories.push(category);
            }
            this.updateMarkers();
            this.mapService.map.on("moveend", (event: MapBrowserEvent) => {
                this.updateMarkers();
            });
        });

        this.resources.languageChanged.subscribe(() => {
            this.updateMarkers();
        });
    }

    public isVisible() {
        return this.visible;
    }

    public show() {
        if (every(this.categories, c => c.isSelected === false)) {
            this.categories.forEach(c => this.changeCategorySelectedState(c, true));
        }
        this.visible = true;
        this.updateMarkers();
        this.localStorageService.set(this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX, this.visible);
    }

    public hide() {
        this.categories.forEach(c => this.changeCategorySelectedState(c, false));
        this.visible = false;
        this.localStorageService.set(this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX, this.visible);
    }

    public toggleCategory(category: ICategory) {
        this.changeCategorySelectedState(category, !category.isSelected);
        this.updateMarkers();
    }

    private changeCategorySelectedState(category: ICategory, newState: boolean) {
        this.localStorageService.set(category.name + CategoriesLayer.SELECTED_POSTFIX, newState);
        category.isSelected = newState;
    }

    protected updateMarkers(): void {
        if (this.categories.length === 0) {
            // layer is not ready yet...
            return;
        }
        if (this.mapService.map.getView().getZoom() <= 9 || !this.isVisible()) {
            this.pointsOfInterest.splice(0);
            this.markersLoaded.next();
            return;
        }
        // HM TODO: pad bounds
        let bounds = SpatialService.getMapBounds(this.mapService.map);
        this.requestsNumber++;
        this.poiService
            .getPoints(bounds.northEast, bounds.southWest,
                this.categories.filter(f => f.isSelected).map(f => f.name))
            .then((pointsOfInterest) => {
                this.requestArrived();
                if (this.requestsNumber !== 0) {
                    return;
                }
                this.pointsOfInterest.splice(0, this.pointsOfInterest.length, ...pointsOfInterest);
                this.markersLoaded.next();
            }, () => {
                this.requestArrived();
            });
    }

    private requestArrived() {
        if (this.requestsNumber > 0) {
            this.requestsNumber--;
        }
    }
}