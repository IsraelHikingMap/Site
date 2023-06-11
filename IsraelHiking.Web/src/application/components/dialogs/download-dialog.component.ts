import { Component } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";

type ApplicationType = "Locus" | "OruxMaps";
type MapType = "IHM" | "MTB";

@Component({
    selector: "download-dialog",
    templateUrl: "./download-dialog.component.html",
    styleUrls: ["./download-dialog.component.scss"]
})
export class DownloadDialogComponent extends BaseMapComponent {
    public app: ApplicationType;
    public mapType: MapType;
    public zoom: number;

    constructor(resources: ResourcesService,
                private readonly sanitizer: DomSanitizer) {
        super(resources);

        this.app = "Locus";
        this.mapType = "IHM";
        this.zoom = 15;
    }

    public getDownloadUrl() {
        let protocol = "https://";
        let extension = ".zip";
        let filesFolder = "OruxMaps";
        if (navigator.userAgent.match(/Android/i)) {
            switch (this.app) {
                case "Locus":
                    protocol = "locus-actions://https/";
                    extension = ".xml";
                    filesFolder = "LocusMap";
                    break;
                case "OruxMaps":
                    protocol = "orux-map://";
                    break;
            }
        }

        let fileName = "Israel";
        if (this.mapType === "IHM") {
            fileName += "Hiking";
        } else if (this.mapType === "MTB") {
            fileName += "MTB";
        }
        if (this.zoom === 16) {
            fileName += "16";
        }
        fileName += extension;
        const tilesFolder = this.resources.getCurrentLanguageCodeSimplified() === "he" ? "/Hebrew" : "/English";
        const href = `${protocol}israelhiking.osm.org.il${tilesFolder}/${filesFolder}/${fileName}`;
        return this.sanitizer.bypassSecurityTrustUrl(href);
    }

    public getDesktopInstallationInstructions(app: ApplicationType) {
        if (app === "Locus") {
            return this.resources.installationInstructionsDesktopLocus;
        }
        return this.resources.installationInstructionsDesktopOruxMaps;
    }

    public getGooglePlayStoreAddress(app: ApplicationType): string {
        if (app === "Locus") {
            return "https://play.google.com/store/apps/details?id=menion.android.locus";
        }
        if (app === "OruxMaps") {
            return "https://play.google.com/store/apps/details?id=com.orux.oruxmaps";
        }
        return "";
    }
}
