import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import * as _ from "lodash";

import { ResourcesService } from "./resources.service";
import { SnappingService } from "./snapping.service";
import { PoiService } from "./poi.service";
import { ToastService } from "./toast.service";
import { RouteStrings } from "./hash.service";
import * as Common from "../common/IsraelHiking";

@Injectable()
export class PrivatePoiUploaderService {
    constructor(private readonly router: Router,
        private readonly resources: ResourcesService,
        private readonly poiService: PoiService,
        private readonly snappingService: SnappingService,
        private readonly toastService: ToastService) {
    }

    public async uploadPoint(
        marker: Common.IMarkerWithTitle,
        imageLink: Common.LinkData,
        title: string,
        description: string,
        type: string
        ) {
        let results = await this.snappingService.getClosestPoint(marker.getLatLng());
        let urls = [];
        if (imageLink) {
            urls = [imageLink];
        }
        let markerData = {
            description: description,
            title: title,
            latlng: marker.getLatLng(),
            type: type,
            urls: urls
        } as Common.MarkerData;

        this.poiService.setAddOrUpdateMarkerData(markerData);

        if (results) {
            let message = `${this.resources.wouldYouLikeToUpdate} ${results.title}?`;
            if (!results.title) {
                let categories = await this.poiService.getSelectableCategories();
                let iconWithLabel = _.chain(categories)
                    .map(c => c.icons)
                    .flatten()
                    .find(i => i.icon === `icon-${results.type}`)
                    .value();
                if (iconWithLabel) {
                    let type = this.resources.translate(iconWithLabel.label);
                    message = `${this.resources.wouldYouLikeToUpdate} ${type}?`;
                } else {
                    message = this.resources.wouldYouLikeToUpdateThePointWithoutTheTitle;
                }
            }
            this.toastService.confirm({
                message: message,
                type: "YesNo",
                confirmAction: () => {
                    this.router.navigate([RouteStrings.ROUTE_POI, "OSM", results.id],
                        { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
                },
                declineAction: () => {
                    this.router.navigate([RouteStrings.ROUTE_POI, "new", ""],
                        { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
                }
            });
        } else {
            this.router.navigate([RouteStrings.ROUTE_POI, "new", ""],
                { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
        }
    }
}