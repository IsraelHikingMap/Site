import { Injectable, Injector, ComponentFactoryResolver } from "@angular/core";
import { Http } from "@angular/http";
import * as _ from "lodash";

import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { MapService } from "../map.service";
import { PoiMarkerPopupComponent, IPointOfInterest } from "../../components/markerpopup/poi-marker-popup.component";
import { IconsService } from "../icons.service";
import { ResourcesService } from "../resources.service";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";


export interface ICategory {
    type: string,
    isSelected: boolean;
    icon: string;
}

@Injectable()
export class PoiLayer extends BasePoiMarkerLayer {

    private requestsNumber: number;

    public categories: ICategory[];

    constructor(mapService: MapService,
        private http: Http,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private resources: ResourcesService) {
        super(mapService);
        this.categories = [];
        this.requestsNumber = 0;
        this.markerIcon = IconsService.createPoiIcon("icon-star", "orange");
        this.http.get(Urls.poiCategories).toPromise().then((response) => {
            // HM TODO: store categories state
            let categoriesArray = response.json() as string[];
            for (let category of categoriesArray) {
                this.categories.push({
                    type: category,
                    isSelected: true,
                    icon: this.getCategoryIcon(category)
                });
            }
            this.updateMarkers();
        });
        this.resources.languageChanged.subscribe(() => {
            this.markers.clearLayers();
            this.updateMarkers();
        });
    }

    private getCategoryIcon(category: string): string {
        switch (category) {
            case "Campsite":
                return "icon-campsite";
            case "Viewpoint":
                return "icon-viewpoint";
            case "Spring":
                return "icon-tint";
            case "Ruins":
                return "icon-ruins";
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
        category.isSelected = !category.isSelected;
        this.updateMarkers();
    }

    protected updateMarkersInternal(): void {
        let northEast = this.mapService.map.getBounds().pad(0.2).getNorthEast();
        let southWest = this.mapService.map.getBounds().pad(0.2).getSouthWest();
        this.requestsNumber++;
        this.http.get(Urls.poi,
            {
                params: {
                    northEast: northEast.lat + "," + northEast.lng,
                    southWest: southWest.lat + "," + southWest.lng,
                    categories: this.categories.filter(f => f.isSelected).map(f => f.type).join(","),
                    language: this.resources.getCurrentLanguageCodeSimplified(),
                }
            }).toPromise().then((response) => {
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
                        componentRef.instance.selectRoute = (route) => { this.createReadOnlyLayer(route) };
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