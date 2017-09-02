import { Injectable, Injector, ComponentFactoryResolver } from "@angular/core";
import { Http } from "@angular/http";
import * as L from "leaflet";
import * as _ from "lodash";

import { MapService } from "../map.service";
import { IconsService } from "../icons.service";
import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { NakebMarkerPopupComponent, NakebItem } from "../../components/markerpopup/nakeb-marker-popup.component";
import * as Common from "../../common/IsraelHiking";


@Injectable()
export class NakebMarkerLayer extends BasePoiMarkerLayer {
    private cachedMarkers: Common.IMarkerWithTitle[];
    
    constructor(mapService: MapService,
        private http: Http,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver) {
        super(mapService);
        this.cachedMarkers = [];
        this.markerIcon = IconsService.createNakebIcon();
        this.fetchMarkers();
    }

    protected getIconString() {
        return "fa icon-nakeb";
    }

    protected getMinimalZoom(): number {
        return 9;
    }

    private fetchMarkers() {
        let url = "https://www.nakeb.co.il/api/hikes/all";

        this.http.get(url).toPromise().then((response) => {
            let data = response.json() as NakebItem[];
            for (let item of data) {
                let marker = L.marker(L.latLng(item.start.lat, item.start.lng),
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
                componentRef.instance.selectRoute = (route) => this.mapService.updateReadOnlyLayer(this.readOnlyLayer, route);
                componentRef.instance.clearSelectedRoute = () => this.readOnlyLayer.clearLayers();
                componentRef.instance.setMarker(marker);
                componentRef.instance.angularBinding(componentRef.hostView);
                marker.bindPopup(markerPopupContainer);
                this.cachedMarkers.push(marker);
            }
            this.updateMarkers();
        });
    }

    protected updateMarkersInternal(): void {
        this.markers.eachLayer((existingMarker) => {
            let markerWithTitle = existingMarker as Common.IMarkerWithTitle;
            if (this.mapService.map.getBounds().pad(0.2).contains(markerWithTitle.getLatLng()) === false) {
                this.markers.removeLayer(existingMarker);
            }
        });

        for (let marker of this.cachedMarkers) {
            if (this.mapService.map.getBounds().pad(0.2).contains(marker.getLatLng()) === false) {
                continue;
            }
            if (_.find(this.markers.getLayers(), layerToFind => (layerToFind as Common.IMarkerWithTitle).title === marker.title) != null) {
                continue;
            }
            this.markers.addLayer(marker);
        }
    }
}