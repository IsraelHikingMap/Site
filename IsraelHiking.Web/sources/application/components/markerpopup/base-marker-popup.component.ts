import { ApplicationRef, ViewRef, ViewChildren, QueryList } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { MatTooltip } from "@angular/material";
import { forkJoin } from "rxjs";
import { take } from "rxjs/operators";
import * as L from "leaflet";

import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { Urls } from "../../common/Urls";
import { BaseMapComponent } from "../base-map.component";
import * as Common from "../../common/IsraelHiking";

export interface INorthEast {
    north: number;
    east: number;
}

export abstract class BaseMarkerPopupComponent extends BaseMapComponent {
    protected marker: Common.IMarkerWithTitle;
    public title: string;
    public itmCoordinates: INorthEast;
    public hideCoordinates: boolean;

    public get latLng(): L.LatLng {
        return this.marker != null ? this.marker.getLatLng() : L.latLng(0, 0, 0);
    };

    @ViewChildren(MatTooltip)
    public tooltips: QueryList<MatTooltip>;

    public remove: () => void;

    constructor(resources: ResourcesService,
        protected httpClient: HttpClient,
        private readonly applicationRef: ApplicationRef,
        protected elevationProvider: ElevationProvider) {
        super(resources);
        this.hideCoordinates = true;
        this.itmCoordinates = { north: 0, east: 0 };
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
        this.setMarkerInternal(marker);
    }

    protected setMarkerInternal = (marker: Common.IMarkerWithTitle) => {
        this.marker = marker;
        this.title = this.marker.title;
        this.updateItmCoordinates();
        this.updateHeights();

        this.marker.on("dragend", () => {
            this.updateItmCoordinates();
            this.updateHeights();
        });
    }

    private updateItmCoordinates = async () => {
        let params = new HttpParams()
            .set("lat", this.latLng.lat.toString())
            .set("lon", this.latLng.lng.toString());
        this.itmCoordinates = await this.httpClient.get(Urls.itmGrid, { params: params }).toPromise() as INorthEast;
    }

    private updateHeights = () => {
        let array = [this.latLng];
        this.elevationProvider.updateHeights(array).then(() => {
            let latlng = this.marker.getLatLng();
            latlng.alt = array[0].alt;
            this.marker.setLatLng(latlng);
        });
    }

    public angularBinding(hostView: ViewRef) {
        this.marker.on("popupopen", () => {
            this.applicationRef.attachView(hostView);
            if (this.tooltips) {
                this.tooltips.forEach((tooltip) => {
                    tooltip.disabled = false;
                });
            }
        });
        this.marker.on("popupclose", () => {
            let subscriptions = [];
            if (!this.tooltips) {
                this.applicationRef.detachView(hostView);
                return;
            } else {
                this.tooltips.forEach((tooltip) => {
                    tooltip.disabled = true;
                    if (tooltip._tooltipInstance != null && tooltip._tooltipInstance.isVisible()) {
                        subscriptions.push(tooltip._tooltipInstance.afterHidden().pipe(take(1)));
                        tooltip.hide(0);
                    }
                });
            }
            if (subscriptions.length === 0) {
                this.applicationRef.detachView(hostView);
            } else {
                forkJoin<void>(...subscriptions).subscribe(() => {
                    this.applicationRef.detachView(hostView);
                });
            }
        });
    }
}