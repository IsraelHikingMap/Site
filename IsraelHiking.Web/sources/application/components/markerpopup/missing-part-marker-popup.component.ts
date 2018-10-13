import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ResourcesService } from "../../services/resources.service";
import { OsmUserService } from "../../services/osm-user.service";
import { ToastService } from "../../services/toast.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";

@Component({
    selector: "missing-part-marker-popup",
    templateUrl: "./missing-part-marker-popup.component.html",
    styleUrls: ["./missing-part-marker-popup.component.css"]
})
export class MissingPartMarkerPopupComponent extends BaseMarkerPopupComponent {
    private feature: GeoJSON.Feature<GeoJSON.LineString>;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        elevationProvider: ElevationProvider,
        private osmUserService: OsmUserService,
        private toastService: ToastService) {
        super(resources, httpClient, elevationProvider);
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