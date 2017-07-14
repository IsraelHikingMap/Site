import { Component } from "@angular/core";
import { Http } from "@angular/http";

import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { IconsService } from "../../services/icons.service";
import { BaseMapComponent } from "../base-map.component";


export interface NakebItemExtended extends NakebItem {
    latlngs: L.LatLng[];
    markers: { latlng: L.LatLng, title: string }[];
}

export interface NakebItem {
    start: { lat: string, lng: string };
    length: number;
    picture: string;
    title: string;
    link: string;
    attributes: string[];
    id: number;
    prolog: string;
}

@Component({
    selector: "nakeb-marker-popup",
    templateUrl: "./nakeb-marker-popup.component.html"
})
export class NakebMarkerPopupComponent extends BaseMapComponent {
    public title: string;
    public address: string;
    public extract: string;
    public thumbnail: string;
    public length: number;
    public attributes: string;
    public pageId: number;

    private marker: L.Marker;
    private readOnlyLayer: L.LayerGroup;

    constructor(resources: ResourcesService,
        private mapService: MapService,
        private http: Http) {
        super(resources);

        this.readOnlyLayer = L.layerGroup([]);
        this.title = "";
        this.address = "";
    }

    public setMarker(marker: L.Marker) {
        this.marker = marker;
        this.marker.on("popupopen", () => {
            this.mapService.map.addLayer(this.readOnlyLayer);
            if (this.title !== "") {
                return;
            }
            let popup = this.marker.getPopup();
            let url = `https://www.nakeb.co.il/api/hikes/${this.pageId}`;
            this.http.get(url).toPromise().then((detailsResponse) => {
                let nakebItem = detailsResponse.json() as NakebItemExtended;
                this.extract = nakebItem.prolog;
                this.title = nakebItem.title;
                this.address = nakebItem.link;
                this.length = nakebItem.length;
                this.thumbnail = nakebItem.picture;
                this.attributes = nakebItem.attributes.join(", ");
                popup.update();

                this.createReadOnlyLayer(nakebItem);
            });
        });
        marker.on("popupclose", () => {
            this.mapService.map.removeLayer(this.readOnlyLayer);
        });
    }

    private createReadOnlyLayer(item: NakebItemExtended) {
        let latLngs = [] as L.LatLng[];
        for (let latLng of item.latlngs) {
            latLngs.push(L.latLng(latLng.lat, latLng.lng));
        }
        let polyLine = L.polyline(latLngs, { opacity: 1, color: "Blue", weight: 3 } as L.PathOptions);
        this.readOnlyLayer.addLayer(polyLine);
        for (let nakebMarker of item.markers) {
            let marker = L.marker(L.latLng(nakebMarker.latlng.lat, nakebMarker.latlng.lng),
                {
                    draggable: false,
                    clickable: false,
                    icon: IconsService.createPoiDefaultMarkerIcon("blue")
                } as L.MarkerOptions);
            marker.bindTooltip(nakebMarker.title, { permanent: true, direction: "bottom" } as L.TooltipOptions);
            this.readOnlyLayer.addLayer(marker);
        }
    }
}