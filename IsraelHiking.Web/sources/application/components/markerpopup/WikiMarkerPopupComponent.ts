import { Component } from "@angular/core";
import { Jsonp } from "@angular/http";
import { ResourcesService } from "../../services/ResourcesService";
import { BaseMapComponent } from "../BaseMapComponent";

export interface IWikiPage {
    coordinates: {
        lat: number;
        lon: number;
    }[];
    thumbnail: {
        height: number;
        width: number;
        source: string;
        original: string;
    }
    pageid: number;
    title: string;
    extract: string;
}

export interface IWikiQuery {
    pages: { [index: number]: IWikiPage };
}

export interface IWikiResponse {
    query: IWikiQuery;
}

@Component({
    selector: "wiki-marker-popup",
    templateUrl: "./wikiMarkerPopup.html"
})
export class WikiMarkerPopupComponent extends BaseMapComponent {
    public title: string;
    public address: string;
    public pageId: number;
    public extract: string;
    public thumbnail: string;
    public flexPresentage: number;

    private marker: L.Marker;

    constructor(resources: ResourcesService,
        private jsonp: Jsonp) {
        super(resources);

        this.flexPresentage = 100;
        this.extract = "";
        this.thumbnail = "";
    }

    public setMarker(marker: L.Marker) {
        this.marker = marker;
        this.marker.on("popupopen", () => {
            let popup = this.marker.getPopup();
            let lang = this.resources.currentLanguage.code.split("-")[0];
            let detailsUrl = `https://${lang}.wikipedia.org/w/api.php?format=json&action=query&pageids=${this.pageId}&prop=extracts|pageimages&explaintext=true&exintro=true&exsentences=1&callback=JSONP_CALLBACK`;
            this.jsonp.get(detailsUrl).toPromise().then((detailsResponse) => {
                let detailsData = detailsResponse.json() as IWikiResponse;
                let currentDetailedPage = detailsData.query.pages[this.pageId];
                this.flexPresentage = 100;
                if (currentDetailedPage.thumbnail) {
                    this.flexPresentage = 66;
                    this.thumbnail = currentDetailedPage.thumbnail.source.replace(/\/\d\dpx/g, "/128px");
                }
                this.extract = currentDetailedPage.extract;
                popup.update();
            });
        });
    }
}