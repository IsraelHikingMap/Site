import { Component, ApplicationRef } from "@angular/core";
import { Jsonp, Http } from "@angular/http";
import { ResourcesService } from "../../services/resources.service";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ElevationProvider } from "../../services/elevation.provider";
import * as Common from "../../common/IsraelHiking";

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
    templateUrl: "./wiki-marker-popup.component.html"
})
export class WikiMarkerPopupComponent extends BaseMarkerPopupComponent {
    public address: string;
    public pageId: number;
    public extract: string;
    public thumbnail: string;
    public flexPresentage: number;

    constructor(resources: ResourcesService,
        http: Http,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider,
        private jsonp: Jsonp) {
        super(resources, http, applicationRef, elevationProvider);

        this.flexPresentage = 100;
        this.extract = "";
        this.thumbnail = "";
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
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