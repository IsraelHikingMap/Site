import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { ResourcesService } from "../../services/ResourcesService";
import { OsmUserService } from "../../services/OsmUserService";
import { ToastService } from "../../services/ToastService";
import { ElevationProvider } from "../../services/ElevationProvider";
import { BaseMarkerPopupComponent } from "./BaseMarkerPopupComponent";

@Component({
    selector: "missing-part-marker-popup",
    templateUrl: "application/components/markerpopup/missingPartMarkerPopup.html",
    styleUrls: ["application/components/markerpopup/missingPartMarkerPopup.css"]
})
export class MissingPartMarkerPopupComponent extends BaseMarkerPopupComponent {
    private feature: GeoJSON.Feature<GeoJSON.LineString>;

    constructor(resources: ResourcesService,
        http: Http,
        elevationProvider: ElevationProvider,
        private osmUserService: OsmUserService,
        private toastService: ToastService) {
        super(resources, http, elevationProvider);
    }

    public setFeature(feature: GeoJSON.Feature<GeoJSON.LineString>) {
        this.feature = feature;
    }

    public getHighwayType = (): string => {
        return this.feature.properties["highway"] || "track";
    }

    public setHighwayType = (highwayType: string) => {
        this.feature.properties["highway"] = highwayType;
    }

    public getColor = (): string => {
        return this.feature.properties["colour"] || "none";
    }

    public setColor = (color: string) => {
        this.feature.properties["colour"] = color;
        if (color === "none") {
            delete this.feature.properties["colour"];
        }
    }

    public addMissingPartToOsm = () => {
        this.osmUserService.addAMissingPart(this.feature).then(() => {
            this.toastService.success(this.resources.routeAddedSuccessfullyItWillTakeTime);
            this.remove();
        }, () => {
            this.toastService.error(this.resources.unableToSendRoute);
        });
    }
}