import { Router } from "@angular/router";
import { LocalStorageService } from "ngx-store";
import { Subject } from "rxjs";
import { Map } from "openlayers";
import * as _ from "lodash";

import { ResourcesService } from "../resources.service";
import { IPointOfInterest, PoiService, CategoriesType, ICategory } from "../poi.service";
import { FitBoundsService } from "../fit-bounds.service";
import { SidebarService } from "../sidebar.service";
import { HashService, RouteStrings } from "../hash.service";
import { IBounds, RouteData } from "../../models/models";
import { BaseMapComponent } from "../../components/base-map.component";
import { SpatialService } from "../spatial.service";
import { MapService } from "../map.service";

export class CategoriesLayer extends BaseMapComponent {

    private static readonly VISIBILITY_POSTFIX = "_visibility";
    private static readonly SELECTED_POSTFIX = "_selected";

    private visible: boolean;
    private requestsNumber: number;
    private markersLoaded: Subject<void>;

    public categories: ICategory[];
    public pointsOfInterest: IPointOfInterest[];
    public searchResultsPoi: IPointOfInterest;
    public selectedRoutes: RouteData[];
    public isSelectedRoutesArea: boolean;

    constructor(resources: ResourcesService,
        private readonly router: Router,
        private readonly mapService: MapService,
        private readonly localStorageService: LocalStorageService,
        private readonly poiService: PoiService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly sidebarService: SidebarService,
        private readonly hashService: HashService,
        
        private readonly categoriesType: CategoriesType) {
        super(resources);
        this.categories = [];
        this.pointsOfInterest = [];
        this.searchResultsPoi = null;
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
        });

        this.resources.languageChanged.subscribe(() => {
            this.updateMarkers();
        });
    }

    public isVisible() {
        return this.visible;
    }

    public show() {
        if (_.every(this.categories, c => c.isSelected === false)) {
            this.categories.forEach(c => this.changeCategorySelectedState(c, true));
        }
        this.updateMarkers();
        this.visible = true;
        this.localStorageService.set(this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX, this.visible);
    }

    public hide() {
        this.categories.forEach(c => this.changeCategorySelectedState(c, false));
        this.visible = false;
        this.localStorageService.set(this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX, this.visible);
    }

    protected getIconString(): string {
        return "fa icon-star";
    }

    protected getMinimalZoom(): number {
        return 9;
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
                // raise event
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

    public moveToSearchResults(pointOfInterest: IPointOfInterest, bounds: IBounds) {
        this.searchResultsPoi = pointOfInterest;
        // triggers the subscription
        this.fitBoundsService.fitBounds(bounds);
        this.updateMarkers();
    }

    private clearSearchResultsMarker() {
        this.searchResultsPoi = null;
    }

    public selectRoute(routes: RouteData[], isArea: boolean) {
        this.selectedRoutes = routes;
        this.isSelectedRoutesArea = isArea;
    }

    public clearSelected(id: string) {
        this.selectedRoutes = null;
        this.clearSearchResultsMarker();
    }
}