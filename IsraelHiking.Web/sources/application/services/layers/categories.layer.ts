import { Router } from "@angular/router";
import { LocalStorageService } from "ngx-store";
import { Subject } from "rxjs";
import * as L from "leaflet";
import * as _ from "lodash";

import { BasePoiMarkerLayer, IMarkerWithTitleAndIcon } from "./base-poi-marker.layer";
import { MapService } from "../map.service";
import { IconsService } from "../icons.service";
import { ResourcesService } from "../resources.service";
import { IPointOfInterest, PoiService, CategoriesType, ICategory } from "../poi.service";
import { FitBoundsService } from "../fit-bounds.service";
import { SidebarService } from "../sidebar.service";
import { HashService, RouteStrings } from "../hash.service";

export class CategoriesLayer extends BasePoiMarkerLayer {

    private static readonly VISIBILITY_POSTFIX = "_visibility";
    private static readonly SELECTED_POSTFIX = "_selected";

    private requestsNumber: number;
    private markersLoaded: Subject<void>;
    private searchResultsMarker: IMarkerWithTitleAndIcon;
    public categories: ICategory[];

    constructor(private readonly router: Router,
        mapService: MapService,
        resources: ResourcesService,
        private readonly localStorageService: LocalStorageService,
        private readonly poiService: PoiService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly sidebarService: SidebarService,
        private readonly hashService: HashService,
        private readonly categoriesType: CategoriesType) {
        super(resources, mapService);
        this.categories = [];
        this.searchResultsMarker = null;
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
            this.clearMarkersLayer();
            this.updateMarkers();
        });
    }

    onAdd(map: L.Map): this {
        if (_.every(this.categories, c => c.isSelected === false)) {
            this.categories.forEach(c => this.changeCategorySelectedState(c, true));
        }
        super.onAdd(map);
        this.localStorageService.set(this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX, this.visible);
        return this;
    }

    onRemove(map: L.Map): this {
        this.categories.forEach(c => this.changeCategorySelectedState(c, false));
        super.onRemove(map);
        this.localStorageService.set(this.categoriesType + CategoriesLayer.VISIBILITY_POSTFIX, this.visible);
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
        this.localStorageService.set(category.name + CategoriesLayer.SELECTED_POSTFIX, newState);
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
            .getPoints(northEast, southWest, this.categories.filter(f => f.isSelected).map(f => f.name))
            .then((pointsOfInterest) => {
                this.requestArrieved();
                if (this.requestsNumber !== 0) {
                    return;
                }
                this.markers.eachLayer(existingMarker => {
                    let markerWithTitle = existingMarker as IMarkerWithTitleAndIcon;
                    let pointOfInterestMarker = _.find(pointsOfInterest, p => p.id === markerWithTitle.identifier);
                    if (pointOfInterestMarker == null && markerWithTitle.isPopupOpen() === false) {
                        this.markers.removeLayer(existingMarker);
                    } else if (pointOfInterestMarker != null) {
                        pointsOfInterest.splice(pointsOfInterest.indexOf(pointOfInterestMarker), 1);
                    }
                    if (this.searchResultsMarker != null &&
                        this.searchResultsMarker.identifier === markerWithTitle.identifier &&
                        this.markers.getVisibleParent(markerWithTitle) === markerWithTitle) {
                        this.clearSearchResultsMarker();
                    }
                });
                for (let pointOfInterest of pointsOfInterest) {
                    let marker = this.pointOfInterestToMarker(pointOfInterest);
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
        this.clearSearchResultsMarker();
        let subscription = this.markersLoaded.subscribe(() => {
            subscription.unsubscribe();
            let foundMarker = false;
            this.markers.eachLayer(existingMarker => {
                let markerWithTitle = existingMarker as IMarkerWithTitleAndIcon;
                if (markerWithTitle.identifier !== pointOfInterest.id || foundMarker) {
                    return;
                }
                foundMarker = true;
                setTimeout(() => {
                    let parent = this.markers.getVisibleParent(markerWithTitle);
                    if (parent !== markerWithTitle) {
                        this.searchResultsMarker = this.pointOfInterestToMarker(pointOfInterest);
                        this.mapService.map.addLayer(this.searchResultsMarker);
                        markerWithTitle = this.searchResultsMarker;
                    }
                }, 1000);
            });
            if (foundMarker) {
                return;
            }
            this.searchResultsMarker = this.pointOfInterestToMarker(pointOfInterest);
            this.mapService.map.addLayer(this.searchResultsMarker);
        });

        // triggers the subscription
        this.fitBoundsService.fitBounds(bounds, { maxZoom: FitBoundsService.DEFAULT_MAX_ZOOM } as L.FitBoundsOptions);
        this.updateMarkersInternal();
    }

    private pointOfInterestToMarker(pointOfInterest: IPointOfInterest): IMarkerWithTitleAndIcon {
        let latLng = L.latLng(pointOfInterest.location.lat, pointOfInterest.location.lng, pointOfInterest.location.alt);
        let icon = IconsService.createPoiIcon(pointOfInterest.icon, pointOfInterest.iconColor, pointOfInterest.hasExtraData);
        let marker = L.marker(latLng,
            {
                draggable: false,
                clickable: true,
                icon: icon,
            } as L.MarkerOptions) as IMarkerWithTitleAndIcon;
        marker.title = pointOfInterest.title;
        marker.icon = pointOfInterest.icon;
        marker.identifier = pointOfInterest.id;
        marker.on("click", () => {
            let poiRouterData = this.hashService.getPoiRouterData();
            if (poiRouterData != null &&
                poiRouterData.id === pointOfInterest.id) {
                this.sidebarService.hide();
                this.hashService.setApplicationState("poi", null);
                this.hashService.resetAddressbar();
            } else {
                this.router.navigate([RouteStrings.ROUTE_POI, pointOfInterest.source, pointOfInterest.id],
                    { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
            }
        });
        if (pointOfInterest.title) {
            marker.bindTooltip(pointOfInterest.title, { direction: "bottom"});
        }

        return marker;
    }

    private clearSearchResultsMarker() {
        if (this.searchResultsMarker != null) {
            this.mapService.map.removeLayer(this.searchResultsMarker);
            this.searchResultsMarker = null;
        }
    }

    public selectRoute(routes, isArea) {
        if (isArea) {
            this.mapService.addAreaToReadOnlyLayer(this.readOnlyLayer, routes);
        } else {
            this.mapService.updateReadOnlyLayer(this.readOnlyLayer, routes);
        }
    }

    public clearSelected(id: string) {
        this.readOnlyLayer.clearLayers();
        if (this.searchResultsMarker != null &&
            this.searchResultsMarker.identifier === id) {
            this.clearSearchResultsMarker();
        }
    }
}