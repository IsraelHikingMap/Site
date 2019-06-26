import { Subject } from "rxjs";
import { NgRedux } from "@angular-redux/store";
import { every } from "lodash";

import { ResourcesService } from "../resources.service";
import { PoiService, CategoriesType, ICategory } from "../poi.service";
import { BaseMapComponent } from "../../components/base-map.component";
import { SpatialService } from "../spatial.service";
import { MapService } from "../map.service";
import { RunningContextService } from "../running-context.service";
import { SetItemVisibilityAction } from "../../reducres/layers.reducer";
import { PointOfInterest, ApplicationState } from "../../models/models";

export class CategoriesLayer extends BaseMapComponent {

    private static readonly VISIBILITY_POSTFIX = "_visibility";

    private visible: boolean;
    private requestsNumber: number;
    public markersLoaded: Subject<void>;

    public categories: ICategory[];
    public pointsOfInterest: PointOfInterest[];

    constructor(resources: ResourcesService,
                private readonly mapService: MapService,
                private readonly poiService: PoiService,
                private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly categoriesType: CategoriesType) {
        super(resources);
        this.categories = [];
        this.pointsOfInterest = [];
        this.markersLoaded = new Subject<void>();
        this.requestsNumber = 0;
        this.visible = this.getVisibility(this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX, !this.runningContextService.isIFrame);
        this.poiService.getCategories(this.categoriesType).then(async (categories) => {
            for (let category of categories) {
                category.visible = this.getVisibility(category.name + CategoriesLayer.VISIBILITY_POSTFIX, this.visible);
                this.categories.push(category);
            }
            await this.mapService.initializationPromise;
            this.updateMarkers();
            this.mapService.map.on("moveend", () => {
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

    private getVisibility(name: string, defaultVisibility: boolean) {
        let initialState = this.ngRedux.getState().layersState.visible.find(i => i.name === name);
        return (defaultVisibility && initialState == null) || (defaultVisibility && initialState != null && initialState.visible);
    }

    public show() {
        if (every(this.categories, c => c.visible === false)) {
            this.categories.forEach(c => this.changeCategoryVisibilityState(c, true));
        }
        this.visible = true;
        this.updateMarkers();
        this.ngRedux.dispatch(new SetItemVisibilityAction({
            name: this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX,
            visible: true
        }));
    }

    public hide() {
        this.categories.forEach(c => this.changeCategoryVisibilityState(c, false));
        this.visible = false;
        this.ngRedux.dispatch(new SetItemVisibilityAction({
            name: this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX,
            visible: false
        }));
    }

    public toggleCategory(category: ICategory) {
        this.changeCategoryVisibilityState(category, !category.visible);
        this.updateMarkers();
    }

    private changeCategoryVisibilityState(category: ICategory, newState: boolean) {
        this.ngRedux.dispatch(new SetItemVisibilityAction({
            name: category.name + CategoriesLayer.VISIBILITY_POSTFIX,
            visible: newState
        }));
        category.visible = newState;
    }

    protected updateMarkers(): void {
        if (this.categories.length === 0) {
            // layer is not ready yet...
            return;
        }
        if (this.mapService.map.getZoom() <= 8 || !this.isVisible()) {
            this.pointsOfInterest.splice(0);
            this.markersLoaded.next();
            return;
        }
        // HM TODO: pad bounds
        let bounds = SpatialService.getMapBounds(this.mapService.map);
        this.requestsNumber++;
        this.poiService
            .getPoints(bounds.northEast, bounds.southWest,
                this.categories.filter(f => f.visible).map(f => f.name))
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
