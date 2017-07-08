import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { ResourcesService } from "../../services/ResourcesService";
import { BaseMapComponent } from "../BaseMapComponent";

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

    constructor(resources: ResourcesService,
        private http: Http) {
        super(resources);
    }

    public setMarker(marker: L.Marker) {
        this.marker = marker;
        this.marker.on("popupopen", () => {
            let popup = this.marker.getPopup();
            let url = `https://www.nakeb.co.il/api/hikes/${this.pageId}`;
            this.http.get(url).toPromise().then((detailsResponse) => {
                let nakebItem = detailsResponse.json() as NakebItem;
                this.extract = nakebItem.prolog;
                this.title = nakebItem.title;
                this.address = nakebItem.link;
                this.length = nakebItem.length;
                this.thumbnail = nakebItem.picture;
                this.attributes = nakebItem.attributes.join(", ");
                popup.update();
            });
        });
    }
}