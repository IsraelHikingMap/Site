import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { flatten } from "lodash-es";
import { Store } from "@ngxs/store";

import { ResourcesService } from "./resources.service";
import { PoiService } from "./poi.service";
import { ToastService } from "./toast.service";
import { RouteStrings } from "./hash.service";
import { SetUploadMarkerDataAction } from "../reducers/poi.reducer";
import type { LinkData, LatLngAlt, MarkerData } from "../models/models";

@Injectable()
export class PrivatePoiUploaderService {
    constructor(private readonly router: Router,
                private readonly resources: ResourcesService,
                private readonly poiService: PoiService,
                private readonly toastService: ToastService,
                private readonly store: Store) {
    }

    public async uploadPoint(
        latLng: LatLngAlt,
        imageLink: LinkData,
        title: string,
        description: string,
        markerType: string
    ) {
        let results = await this.poiService.getClosestPoint(latLng, "OSM");
        let urls = [] as LinkData[];
        if (imageLink) {
            urls = [imageLink];
        }
        let markerData = {
            description: description ? description.substring(0, 255) : "",
            title,
            latlng: latLng,
            type: markerType,
            urls
        } as MarkerData;

        this.store.dispatch(new SetUploadMarkerDataAction(markerData));

        if (results == null) {
            this.router.navigate([RouteStrings.ROUTE_POI, "new", ""],
                { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
            return;
        }
        let message = `${this.resources.wouldYouLikeToUpdate} ${results.title || this.resources.translate(results.type)}?`;
        if (!results.title) {
            let categories = this.poiService.getSelectableCategories();
            let iconWithLabel = flatten(categories.map(c => c.icons))
                .find(i => i.icon === `icon-${results.type}`);
            if (iconWithLabel) {
                let type = this.resources.translate(iconWithLabel.label);
                message = `${this.resources.wouldYouLikeToUpdate} ${type}?`;
            } else {
                message = this.resources.wouldYouLikeToUpdateThePointWithoutTheTitle;
            }
        }
        this.toastService.confirm({
            message,
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
    }
}
