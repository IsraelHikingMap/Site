import { Component, ApplicationRef, HostListener, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { Router } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { ENTER } from "@angular/cdk/keycodes";
import * as _ from "lodash";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { MapService } from "../../services/map.service";
import { IRouteLayer, IMarkerWithData } from "../../services/layers/routelayers/iroute.layer";
import { IconsService } from "../../services/icons.service";
import { OsmUserService } from "../../services/osm-user.service";
import { FileService } from "../../services/file.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { ImageResizeService } from "../../services/image-resize.service";
import { SnappingService } from "../../services/snapping.service";
import { ToastService } from "../../services/toast.service";
import { PoiService } from "../../services/poi.service";
import { RouteStrings } from "../../services/hash.service";
import * as Common from "../../common/IsraelHiking";

interface IIconsGroup {
    icons: string[];
}

@Component({
    selector: "drawing-poi-marker-popup",
    templateUrl: "./drawing-poi-marker-popup.component.html"
})
export class DrawingPoiMarkerPopupComponent extends BaseMarkerPopupComponent implements AfterViewInit {
    private routeLayer: IRouteLayer;

    public showIcons: boolean;
    public markerType: string;
    public description: string;
    public imageLink: Common.LinkData;
    public iconsGroups: IIconsGroup[];
    public isEditMode: boolean;

    @ViewChild("titleInput")
    public titleInput: ElementRef;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        elevationProvider: ElevationProvider,
        applicationRef: ApplicationRef,
        private readonly router: Router,
        private readonly mapService: MapService,
        private readonly osmUserService: OsmUserService,
        private readonly fileService: FileService,
        private readonly imageGalleryService: ImageGalleryService,
        private readonly imageResizeService: ImageResizeService,
        private readonly toastService: ToastService,
        private readonly snappingService: SnappingService,
        private readonly poiService: PoiService) {
        super(resources, httpClient, applicationRef, elevationProvider);

        this.showIcons = false;
        this.iconsGroups = [];
        this.isEditMode = false;
        this.imageLink = null;
        let numberOfIconsPerRow = 4;
        for (let iconTypeIndex = 0; iconTypeIndex < IconsService.getAvailableIconTypes().length / numberOfIconsPerRow; iconTypeIndex++) {
            this.iconsGroups.push({
                icons: IconsService.getAvailableIconTypes().splice(iconTypeIndex * numberOfIconsPerRow, numberOfIconsPerRow)
            });
        }
    }

    public ngAfterViewInit(): void {
        setTimeout(() => {
            // this is to trigger changes otherwise there's an error: Expression has changed after it was checked
            this.focusTitle();
        }, 25);

    }

    private focusTitle() {
        if (this.titleInput && this.titleInput.nativeElement) {
            this.titleInput.nativeElement.focus();
        }
    }

    public setMerkerType = (markerType: string): void => {
        this.markerType = markerType;
        let color = this.routeLayer.route.properties.pathOptions.color;
        this.marker.setIcon(IconsService.createMarkerIconWithColorAndType(color, markerType));
    }

    public save = () => {
        let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker) as IMarkerWithData;
        if (!routeMarker) {
            return;
        }
        routeMarker.title = this.title;
        routeMarker.type = this.markerType;
        routeMarker.description = this.description;
        if (this.imageLink) {
            routeMarker.urls = [this.imageLink];
        } else {
            routeMarker.urls = [];
        }
        let color = this.routeLayer.route.properties.pathOptions.color;
        this.mapService.setMarkerTitle(this.marker, routeMarker, color);
        this.routeLayer.raiseDataChanged();
        this.marker.closePopup();
    }

    public setRouteLayer(routeLayer: IRouteLayer) {
        this.routeLayer = routeLayer;
        let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker) as IMarkerWithData;
        this.markerType = routeMarker.type;
        this.description = routeMarker.description;
        let url = _.find(routeMarker.urls, u => u.mimeType.startsWith("image"));
        this.imageLink = url;
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
        this.setMarkerInternal(marker);

        this.marker.on("popupclose", () => {
            let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker);
            let color = this.routeLayer.route.properties.pathOptions.color;
            this.marker.setIcon(IconsService.createMarkerIconWithColorAndType(color, routeMarker.type));
        });

        this.marker.on("popupopen", () => {
            this.focusTitle();
        });
    }

    public showOpenDialogButton(): boolean {
        return this.osmUserService.isLoggedIn();
    }

    public async uploadPoint(e: Event) {
        this.suppressEvents(e);
        let results = await this.snappingService.getClosestPoint(this.marker.getLatLng());
        let urls = [];
        if (this.imageLink) {
            urls = [this.imageLink];
        }
        let markerData = {
            description: this.description,
            title: this.title,
            latlng: this.marker.getLatLng(),
            type: this.markerType,
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

        this.marker.closePopup();
    }

    public async addImage(e: any) {
        this.suppressEvents(e);
        let file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        let container = await this.imageResizeService.resizeImageAndConvert(file, false);
        this.imageLink = container.routes[0].markers[0].urls[0];
    }

    public showImage() {
        if (this.imageLink && this.imageLink.url) {
            this.imageGalleryService.setImages([this.imageLink.url]);
        }
    }

    public clearImage() {
        this.imageLink = null;
    }

    public changeToEditMode = (): void => { throw new Error("Callback needs to be set by the creating class..."); };

    @HostListener("window:keydown", ["$event"])
    public onEnterPress($event: KeyboardEvent) {
        if ($event.shiftKey) {
            return true;
        }
        if ($event.keyCode !== ENTER) {
            return true;
        }
        this.save();
        return false;
    }
}