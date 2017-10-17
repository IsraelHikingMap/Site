import { Injector, ComponentFactoryResolver, ApplicationRef, ComponentFactory } from "@angular/core";
import { LocalStorageService } from "ngx-store"
import { Subject } from "rxjs/Subject";
import * as L from "leaflet";
import * as _ from "lodash";

import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { MapService } from "../map.service";
import { PoiMarkerPopupComponent } from "../../components/markerpopup/poi-marker-popup.component";
import { IconsService } from "../icons.service";
import { ResourcesService } from "../resources.service";
import { IPointOfInterest, PoiService, CategoriesType, ICategory } from "../poi.service";
import { FitBoundsService } from "../fit-bounds.service";
import * as Common from "../../common/IsraelHiking";


export class CategoriesLayer extends BasePoiMarkerLayer {

    private static readonly VISIBILITY_PREFIX = "_visibility";
    private static readonly SELECTED_PREFIX = "_selected";

    private requestsNumber: number;
    private markersLoaded: Subject<void>;
    private searchResultsMarker: Common.IMarkerWithTitle;
    public categories: ICategory[];

    constructor(mapService: MapService,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef,
        private resources: ResourcesService,
        private localStorageService: LocalStorageService,
        private poiService: PoiService,
        private fitBoundsService: FitBoundsService,
        private categoriesType: CategoriesType) {
        super(mapService);
        this.categories = [];
        this.searchResultsMarker = null;
        this.markersLoaded = new Subject<void>();
        this.requestsNumber = 0;
        this.visible = this.localStorageService.get(this.categoriesType + CategoriesLayer.VISIBILITY_PREFIX) || false;
        this.markerIcon = IconsService.createPoiIcon("icon-star", "orange");
        this.poiService.getCategories(this.categoriesType).then((response: {}) => {
            for (let categoryType in response) {
                if (response.hasOwnProperty(categoryType)) {
                    let selected = this.localStorageService.get(categoryType + CategoriesLayer.SELECTED_PREFIX) == null
                        ? this.visible
                        : this.localStorageService.get(categoryType + CategoriesLayer.SELECTED_PREFIX);
                    this.categories.push({
                        key: categoryType,
                        isSelected: selected,
                        label: this.resources.translate(categoryType),
                        icon: response[categoryType][0].icon
                    } as ICategory);
                }
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
        this.localStorageService.set(category.key + CategoriesLayer.SELECTED_PREFIX, newState);
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
            .getPoints(northEast, southWest, this.categories.filter(f => f.isSelected).map(f => f.key))
            .then((response) => {
                this.requestArrieved();
                if (this.requestsNumber !== 0) {
                    return;
                }
                let pointsOfInterest = response.json() as IPointOfInterest[];
                this.markers.eachLayer(existingMarker => {
                    let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
                    let pointOfInterestMarker = _.find(pointsOfInterest, p => p.id === markerWithTitle.identifier);
                    if (pointOfInterestMarker == null && markerWithTitle.isPopupOpen() === false) {
                        this.markers.removeLayer(existingMarker);
                    } else if (pointOfInterestMarker != null) {
                        pointsOfInterest.splice(pointsOfInterest.indexOf(pointOfInterestMarker), 1);
                    }
                    if (this.searchResultsMarker != null && this.searchResultsMarker.identifier === markerWithTitle.identifier) {
                        this.clearSearchResultsMarker();
                    }
                });

                let factory = this.componentFactoryResolver.resolveComponentFactory(PoiMarkerPopupComponent);
                for (let pointOfInterest of pointsOfInterest) {
                    let marker = this.pointOfInterestToMarker(pointOfInterest, factory);
                    this.markers.addLayer(marker);
                }
                // raise event
                this.markersLoaded.next();
            }, () => {
                this.requestArrieved();
            });
    }

    private requestArrieved() {
        if (this.requestsNumber > 0) {
            this.requestsNumber--;
        }
    }

    public moveToSearchResults(pointOfInterest: IPointOfInterest, bounds: L.LatLngBounds) {
        let factory = this.componentFactoryResolver.resolveComponentFactory(PoiMarkerPopupComponent);
        this.clearSearchResultsMarker();
        let subscription = this.markersLoaded.subscribe(() => {
            subscription.unsubscribe();
            let foundMarker = false;
            this.markers.eachLayer(existingMarker => {
                let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
                if (markerWithTitle.identifier !== pointOfInterest.id) {
                    return;
                }
                foundMarker = true;
                setTimeout(() => {
                    var parent = this.markers.getVisibleParent(markerWithTitle);
                    if (parent !== markerWithTitle) {
                        this.searchResultsMarker = this.pointOfInterestToMarker(pointOfInterest, factory);
                        this.mapService.map.addLayer(this.searchResultsMarker);
                        markerWithTitle = this.searchResultsMarker;
                    }
                    markerWithTitle.fireEvent("click");
                    markerWithTitle.openPopup();
                }, 500);
            });
            if (foundMarker) {
                return;
            }
            pointOfInterest.icon = pointOfInterest.icon || "icon-search";
            this.searchResultsMarker = this.pointOfInterestToMarker(pointOfInterest, factory);
            this.mapService.map.addLayer(this.searchResultsMarker);
            this.searchResultsMarker.fireEvent("click");
            this.searchResultsMarker.openPopup();
        });

        // triggers the subscription
        this.fitBoundsService.fitBounds(bounds, { maxZoom: FitBoundsService.DEFAULT_MAX_ZOOM } as L.FitBoundsOptions);
        this.updateMarkersInternal();
    }

    private pointOfInterestToMarker(pointOfInterest: IPointOfInterest, factory: ComponentFactory<PoiMarkerPopupComponent>): Common.IMarkerWithTitle {
        let latLng = L.latLng(pointOfInterest.location.lat, pointOfInterest.location.lng, pointOfInterest.location.alt);
        let marker = L.marker(latLng, { draggable: false, clickable: true, icon: IconsService.createPoiIcon(pointOfInterest.icon, pointOfInterest.iconColor), title: pointOfInterest.title } as L.MarkerOptions) as Common.IMarkerWithTitle;
        marker.title = pointOfInterest.title;
        marker.identifier = pointOfInterest.id;
        let clickLambda = () => {
            // for performance
            let markerPopupContainer = L.DomUtil.create("div");
            let componentRef = factory.create(this.injector, null, markerPopupContainer);
            componentRef.instance.source = pointOfInterest.source;
            componentRef.instance.type = pointOfInterest.type;
            componentRef.instance.setMarker(marker);
            componentRef.instance.selectRoute = (route) => { this.mapService.updateReadOnlyLayer(this.readOnlyLayer, route) };
            componentRef.instance.clearSelectedRoute = () => this.readOnlyLayer.clearLayers();
            componentRef.instance.angularBinding(componentRef.hostView);
            marker.bindPopup(markerPopupContainer, { autoPan: false } as L.PopupOptions);
            marker.openPopup();
            marker.off("click", clickLambda);
        };
        marker.on("click", clickLambda);
        return marker;
    }

    private clearSearchResultsMarker() {
        if (this.searchResultsMarker != null) {
            this.mapService.map.removeLayer(this.searchResultsMarker);
            this.searchResultsMarker = null;
        }
    }
}