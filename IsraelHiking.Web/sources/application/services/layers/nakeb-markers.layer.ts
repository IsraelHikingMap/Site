import { Injectable, Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import { MapService } from "../map.service";
import { IconsService } from "../icons.service";
import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { NakebMarkerPopupComponent, NakebItem } from "../../components/markerpopup/nakeb-marker-popup.component";
import * as Common from "../../common/IsraelHiking";
import * as _ from "lodash";

@Injectable()
export class NakebMarkerLayer extends BasePoiMarkerLayer {
    private cachedMarkers: Common.IMarkerWithTitle[];

    constructor(mapService: MapService,
        private http: Http,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef) {
        super(mapService);
        this.cachedMarkers = [];
        this.minimalZoom = 11;
        this.markerIcon = IconsService.createNakebIcon();
        this.fetchMarkers();
    }

    protected getIconString() {
        return "fa icon-nakeb";
    }

    private fetchMarkers() {
        let url = "https://www.nakeb.co.il/api/hikes/all";

        this.http.get(url).toPromise().then((response) => {
            let data = response.json() as NakebItem[];
            for (let item of data) {
                let marker = L.marker(L.latLng(parseFloat(item.start.lat), parseFloat(item.start.lng)),
                    {
                        draggable: false,
                        clickable: true,
                        icon: this.markerIcon,
                        title: item.title
                    } as L.MarkerOptions) as Common.IMarkerWithTitle;
                marker.title = item.id.toString();
                let markerPopupContainer = L.DomUtil.create("div");
                let factory = this.componentFactoryResolver.resolveComponentFactory(NakebMarkerPopupComponent);
                let componentRef = factory.create(this.injector, null, markerPopupContainer);
                componentRef.instance.pageId = item.id;
                componentRef.instance.setMarker(marker);
                marker.bindPopup(markerPopupContainer);
                marker.on("popupopen", () => {
                        this.applicationRef.attachView(componentRef.hostView);
                    });
                marker.on("popupclose", () => {
                        this.applicationRef.detachView(componentRef.hostView);
                    });
                this.cachedMarkers.push(marker);
            }
            this.updateMarkers();
        });
    }

    protected updateMarkersInternal(): void {
        this.markers.eachLayer((existingMarker) => {
            let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
            if (this.mapService.map.getBounds().contains(markerWithTitle.getLatLng()) === false) {
                this.markers.removeLayer(existingMarker);
            }
        });

        for (let marker of this.cachedMarkers) {
            if (this.mapService.map.getBounds().contains(marker.getLatLng()) === false) {
                continue;
            }
            if (_.find(this.markers.getLayers(), layerToFind => (layerToFind as Common.IMarkerWithTitle).title === marker.title) != null) {
                continue;
            }
            this.markers.addLayer(marker);
        }
    }
}