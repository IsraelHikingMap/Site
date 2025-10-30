import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { flatten } from "lodash-es";
import { Store } from "@ngxs/store";

import { ResourcesService } from "./resources.service";
import { PoiService } from "./poi.service";
import { ToastService } from "./toast.service";
import { RouteStrings } from "./hash.service";
import { SetUploadMarkerDataAction } from "../reducers/poi.reducer";
import { CATEGORIES_GROUPS } from "../reducers/initial-state";
import type { LinkData, LatLngAlt, MarkerData } from "../models";

@Injectable()
export class PrivatePoiUploaderService {

    private readonly router = inject(Router);
    private readonly resources = inject(ResourcesService);
    private readonly poiService = inject(PoiService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);

    public async uploadPoint(
        latLng: LatLngAlt,
        imageLink: LinkData,
        title: string,
        description: string,
        markerType: string
    ) {
        const results = await this.poiService.getClosestPoint(latLng, "OSM", this.resources.getCurrentLanguageCodeSimplified());
        let urls = [] as LinkData[];
        if (imageLink) {
            urls = [imageLink];
        }
        const markerData = {
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
            const categories = CATEGORIES_GROUPS[0].categories;
            const iconWithLabel = flatten(categories.map(c => c.selectableItems))
                .find(i => i.icon === `icon-${results.type}`);
            if (iconWithLabel) {
                const type = this.resources.translate(iconWithLabel.label);
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
