import { Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import { LocalStorageService } from "ngx-store"
import * as L from "leaflet";
import * as _ from "lodash";

import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { MapService } from "../map.service";
import { PoiMarkerPopupComponent } from "../../components/markerpopup/poi-marker-popup.component";
import { IconsService } from "../icons.service";
import { ResourcesService } from "../resources.service";
import { IPointOfInterest, PoiService } from "../poi.service";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";


export interface ICategory {
    type: string,
    isSelected: boolean;
    icon: string;
}

export type CategoriesType = "Points of Interest" | "Routes";

export class CategoriesLayer extends BasePoiMarkerLayer {

    private static readonly VISIBILITY_PREFIX = "_visibility";
    private static readonly SELECTED_PREFIX = "_selected";

    private requestsNumber: number;
    public categories: ICategory[];

    constructor(mapService: MapService,
        private http: Http,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef,
        private resources: ResourcesService,
        private localStorageService: LocalStorageService,
        private poiService: PoiService,
        private categoriesType: CategoriesType) {
        super(mapService);
        this.categories = [];
        this.requestsNumber = 0;
        this.visible = this.localStorageService.get(this.categoriesType + CategoriesLayer.VISIBILITY_PREFIX) || false;
        this.markerIcon = IconsService.createPoiIcon("icon-star", "orange");
        this.http.get(Urls.poiCategories + categoriesType).toPromise().then((response) => {
            let categoriesArray = response.json() as string[];
            for (let categoryType of categoriesArray) {
                let selected = this.localStorageService.get(categoryType + CategoriesLayer.SELECTED_PREFIX) == null
                    ? true
                    : this.localStorageService.get(categoryType + CategoriesLayer.SELECTED_PREFIX);
                this.categories.push({
                    type: categoryType,
                    isSelected: selected,
                    icon: this.getCategoryIcon(categoryType)
                });
            }
            this.updateMarkers();
        });
        this.resources.languageChanged.subscribe(() => {
            this.markers.clearLayers();
            this.updateMarkers();
        });
    }

    onAdd(map: L.Map): this {
        if (_.every(this.categories, c => c.isSelected === false)) {
            this.categories.forEach(c => this.changeCategorySelectedState(c, true));
        }
        super.onAdd(map);
        this.localStorageService.set(this.categoriesType + CategoriesLayer.VISIBILITY_PREFIX, this.visible);
        return this;
    }

    onRemove(map: L.Map): this {
        this.categories.forEach(c => this.changeCategorySelectedState(c, false));
        super.onRemove(map);
        this.localStorageService.set(this.categoriesType + CategoriesLayer.VISIBILITY_PREFIX, this.visible);
        return this;
    }

    private getCategoryIcon(category: string): string {
        switch (category) {
            case "Camping":
                return "icon-picnic";
            case "Viewpoint":
                return "icon-viewpoint";
            case "Water":
                return "icon-tint";
            case "Historic":
                return "icon-ruins";
            case "Natural":
                return "icon-cave";
            case "Hiking":
                return "icon-hike";
            case "Bicycle":
                return "icon-bike";
            case "4x4":
                return "icon-four-by-four";
            default:
                return "icon-star";
        }
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
        this.readOnlyLayer.clearLayers();
    }

    private changeCategorySelectedState(category: ICategory, newState: boolean) {
        this.localStorageService.set(category.type + CategoriesLayer.SELECTED_PREFIX, newState);
        category.isSelected = newState;
    }

    protected updateMarkersInternal(): void {
        if (this.categories.length === 0) {
            // layer is not ready yet...
            return;
        }
        let northEast = this.mapService.map.getBounds().pad(0.2).getNorthEast();
        let southWest = this.mapService.map.getBounds().pad(0.2).getSouthWest();
        this.requestsNumber++;
        this.poiService
            .getPoints(northEast, southWest, this.categories.filter(f => f.isSelected).map(f => f.type))
            .then((response) => {
                this.requestArrieved();
                if (this.requestsNumber !== 0) {
                    return;
                }
                let pointsOfInterest = response.json() as IPointOfInterest[];
                this.markers.eachLayer(existingMarker => {
                    let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
                    let geoSearchPage = _.find(pointsOfInterest, p => p.id === markerWithTitle.identifier);
                    if (geoSearchPage == null) {
                        this.markers.removeLayer(existingMarker);
                    } else {
                        pointsOfInterest.splice(pointsOfInterest.indexOf(geoSearchPage), 1);
                    }
                });

                let factory = this.componentFactoryResolver.resolveComponentFactory(PoiMarkerPopupComponent);
                for (let pointOfInterest of pointsOfInterest) {
                    let latLng = L.latLng(pointOfInterest.location.lat, pointOfInterest.location.lng, pointOfInterest.location.alt);
                    let marker = L.marker(latLng, { draggable: false, clickable: true, icon: IconsService.createPoiIcon(pointOfInterest.icon, pointOfInterest.iconColor), title: pointOfInterest.title } as L.MarkerOptions) as Common.IMarkerWithTitle;
                    marker.title = pointOfInterest.title;
                    marker.identifier = pointOfInterest.id;
                    let clickLambda = () => {
                        // for performance
                        let markerPopupContainer = L.DomUtil.create("div");
                        let componentRef = factory.create(this.injector, null, markerPopupContainer);
                        componentRef.instance.source = pointOfInterest.source;
                        componentRef.instance.setMarker(marker);
                        componentRef.instance.selectRoute = (route) => { this.mapService.updateReadOnlyLayer(this.readOnlyLayer, route) };
                        componentRef.instance.clearSelectedRoute = () => this.readOnlyLayer.clearLayers();
                        componentRef.instance.angularBinding(componentRef.hostView);
                        marker.bindPopup(markerPopupContainer);
                        marker.openPopup();
                        marker.off("click", clickLambda);
                    };
                    marker.on("click", clickLambda);
                    this.markers.addLayer(marker);
                }
            }, () => {
                this.requestArrieved();
            });
    }

    private requestArrieved() {
        if (this.requestsNumber > 0) {
            this.requestsNumber--;
        }
    }
}