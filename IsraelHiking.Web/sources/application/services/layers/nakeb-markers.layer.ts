import { Injectable, Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import * as _ from "lodash";

import { MapService } from "../map.service";
import { IconsService } from "../icons.service";
import { BasePoiMarkerLayer } from "./base-poi-marker.layer";
import { NakebMarkerPopupComponent, NakebItem } from "../../components/markerpopup/nakeb-marker-popup.component";
import * as Common from "../../common/IsraelHiking";


@Injectable()
export class NakebMarkerLayer extends BasePoiMarkerLayer {
    private cachedMarkers: Common.IMarkerWithTitle[];
    private readOnlyLayer: L.LayerGroup;
    
    constructor(mapService: MapService,
        private http: Http,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef) {
        super(mapService);
        this.cachedMarkers = [];
        this.markerIcon = IconsService.createNakebIcon();
        this.readOnlyLayer = L.layerGroup([]);
        this.mapService.map.addLayer(this.readOnlyLayer);
        this.fetchMarkers();
    }

    public onRemove(map: L.Map): this {
        super.onRemove(map);
        this.readOnlyLayer.clearLayers();
        return this;
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
                componentRef.instance.selectRoute = (item) => this.createReadOnlyLayer(item);
                componentRef.instance.clearSelectedRoute = () => this.readOnlyLayer.clearLayers();
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

    private createReadOnlyLayer(routeData: Common.RouteData) {
        this.readOnlyLayer.clearLayers();
        let latLngs = _.last(routeData.segments).latlngs;
        let polyLine = L.polyline(latLngs,
            {
                opacity: 1,
                color: "Blue",
                weight: 3,
                dashArray: "30 10",
                className: "segment-readonly-indicator"
            } as L.PathOptions);
        this.readOnlyLayer.addLayer(polyLine);
        for (let markerData of routeData.markers) {
            let marker = L.marker(markerData.latlng,
                {
                    draggable: false,
                    clickable: false,
                    icon: IconsService.createPoiDefaultMarkerIcon("blue")
                } as L.MarkerOptions);
            marker.bindTooltip(markerData.title, { permanent: true, direction: "bottom" } as L.TooltipOptions);
            this.readOnlyLayer.addLayer(marker);
        }
        this.readOnlyLayer.addLayer(L.marker(latLngs[0],
            {
                opacity: 1,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("green")
            }));
        this.readOnlyLayer.addLayer(L.marker(latLngs[latLngs.length - 1],
            {
                opacity: 1,
                draggable: false,
                clickable: false,
                icon: IconsService.createRoundIcon("red")
            }));
    }
}