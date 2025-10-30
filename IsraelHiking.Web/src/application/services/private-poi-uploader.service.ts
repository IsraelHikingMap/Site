import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { flatten } from "lodash-es";
import { Store } from "@ngxs/store";
import { validate } from "uuid";

import { ResourcesService } from "./resources.service";
import { PoiService } from "./poi.service";
import { ToastService } from "./toast.service";
import { RouteStrings } from "./hash.service";
import { SetUploadMarkerDataAction } from "../reducers/poi.reducer";
import type { LinkData, LatLngAlt, MarkerData } from "../models";

@Injectable()
export class PrivatePoiUploaderService {

    private readonly router = inject(Router);
    private readonly resources = inject(ResourcesService);
    private readonly poiService = inject(PoiService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);

    public async uploadPoint(
        id: string,
        latLng: LatLngAlt,
        imageLink: LinkData,
        title: string,
        description: string,
        markerType: string
    ) {
        let urls = [] as LinkData[];
        if (imageLink) {
            urls = [imageLink];
        }
        const markerData: MarkerData = {
            id,
            description: description ? description.substring(0, 255) : "",
            title,
            latlng: latLng,
            type: markerType,
            urls
        };

        this.store.dispatch(new SetUploadMarkerDataAction(markerData));

        if (id && !validate(id) && (
            id.toLocaleLowerCase().startsWith("way") ||
            id.toLocaleLowerCase().startsWith("node") ||
            id.toLocaleLowerCase().startsWith("relation")
        )) {
            // id is of an existing OSM POI:
            this.router.navigate([RouteStrings.ROUTE_POI, "OSM", id],
                    { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
            return;
        } else if (id && !validate(id)) {
            this.toastService.warning(this.resources.uploadingDataFromExternalSourceIsNotAllowed);
            return;
        }

        const results = await this.poiService.getClosestPoint(latLng, "OSM", this.resources.getCurrentLanguageCodeSimplified());

        if (results == null) {
            this.router.navigate([RouteStrings.ROUTE_POI, "new", ""],
                { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
            return;
        }
        let message = `${this.resources.wouldYouLikeToUpdate} ${results.title || this.resources.translate(results.type)}?`;
        if (!results.title) {
            const categories = this.poiService.getSelectableCategories();
            const iconWithLabel = flatten(categories.map(c => c.icons))
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
