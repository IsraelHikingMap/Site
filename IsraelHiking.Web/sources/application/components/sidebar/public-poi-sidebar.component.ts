import { Component } from "@angular/core";
import { MatSelectChange } from "@angular/material";

import { IPoiMainInfoData } from "./poi-main-info.component";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { SidebarService } from "../../services/sidebar.service";
import { IPointOfInterestExtended, PoiService, IRating, IRater, IIconColorLabel } from "../../services/poi.service";
import { MapService } from "../../services/map.service";
import { IPublicPoiData, IPublicPoiData as IPublicPoiData1 } from "../../services/layers/categories.layer";
import { OsmUserService } from "../../services/osm-user.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { ToastService } from "../../services/toast.service";
import { LayersService } from "../../services/layers/layers.service";
import { IMarkerWithData } from "../../services/layers/routelayers/iroute.layer";
import { RouteLayerFactory } from "../../services/layers/routelayers/route-layer.factory";
import { ISelectableCategory } from "../dialogs/update-point-dialog.component";
import * as Common from "../../common/IsraelHiking";


@Component({
    selector: "public-poi-sidebar",
    templateUrl: "./public-poi-sidebar.component.html",
    styleUrls: ["./public-poi-sidebar.component.css"]
})
export class PublicPoiSidebarComponent extends BaseMapComponent {
    public info: IPoiMainInfoData;
    public isLoading: boolean;
    public sourceImageUrl: string;
    public rating: number;
    public latLng: L.LatLng;
    public categories: ISelectableCategory[];
    public selectedCategory: ISelectableCategory;
    public isAdvanced: boolean;

    private editMode: boolean;
    private poiExtended: IPointOfInterestExtended;

    constructor(resources: ResourcesService,
        private readonly mapService: MapService,
        private readonly sidebarService: SidebarService,
        private readonly poiService: PoiService,
        private readonly osmUserService: OsmUserService,
        private readonly routesService: RoutesService,
        private readonly toastService: ToastService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly layersService: LayersService) {
        super(resources);
        let data = this.getData();
        this.isLoading = true;
        this.isAdvanced = false;
        this.categories = [];
        this.info = { imagesFiles: [], imagesUrls: [] } as IPoiMainInfoData;
        this.latLng = data.latLng;
        this.poiService.getPoint(data.id, data.source, data.type).then((poiExtended) => {
            this.initFromPointOfInterestExtended(poiExtended);
            data.selectRoutes(this.poiExtended.dataContainer.routes, this.poiExtended.isArea);
            this.isLoading = false;
        }, () => {
            this.isLoading = false;
        });
        this.initializeCategories(data.markerIcon);
    }

    private getData(): IPublicPoiData1 {
        return this.sidebarService.poiData as IPublicPoiData;
    }

    private initFromPointOfInterestExtended = (poiExtended: IPointOfInterestExtended) => {
        this.poiExtended = poiExtended;
        this.info.title = poiExtended.title;
        this.info.description = poiExtended.description;
        this.info.readOnlyDescription = this.getReadOnlyDescrition();
        this.info.url = poiExtended.url;
        this.info.imagesUrls = [...poiExtended.imagesUrls];
        this.sourceImageUrl = poiExtended.sourceImageUrl;
        this.rating = this.getRatingNumber(this.poiExtended.rating);
        this.mapService.routesJsonToRoutesObject(this.poiExtended.dataContainer.routes);
    }

    private async initializeCategories(markerIcon: string) {
        let categories = await this.poiService.getCategories("Points of Interest");
        for (let category of categories) {
            this.categories.push({
                name: category.name,
                isSelected: false,
                label: category.name,
                icon: category.icon,
                color: category.color,
                icons: category.items.map(i => i.iconColorCategory)
            } as ISelectableCategory);
        }
        this.selectedCategory = null;

        for (let category of this.categories) {
            let icon = _.find(category.icons, iconToFind => iconToFind.icon === markerIcon);
            if (icon) {
                this.selectCategory({ value: category } as MatSelectChange);
                this.selectIcon(icon);
            }
        }
        if (this.selectedCategory == null) {
            let category = _.find(this.categories, categoryToFind => categoryToFind.name === "Other");
            let icon = { icon: markerIcon, color: "black", label: this.resources.other } as IIconColorLabel;
            category.icons.push(icon);
            this.selectCategory({ value: category } as MatSelectChange);
            this.selectIcon(icon);
        }
    }

    public selectCategory(e: MatSelectChange) {
        this.categories.forEach(c => c.isSelected = false);
        this.selectedCategory = e.value;
        this.selectedCategory.isSelected = true;
        if (this.selectedCategory.selectedIcon == null) {
            this.selectedCategory.selectedIcon = this.selectedCategory.icons[0];
        }
    }

    public selectIcon(icon: IIconColorLabel) {
        this.selectedCategory.selectedIcon = icon;
    }

    private getRatingNumber(rating: IRating): number {
        return _.sum(rating.raters.map(r => r.value));
    }

    public isHideEditMode(): boolean {
        return !this.osmUserService.isLoggedIn() ||
            !this.poiExtended ||
            !this.poiExtended.isEditable ||
            this.editMode;
    }

    private getReadOnlyDescrition(): string {
        if (!this.poiExtended.isEditable) {
            return "";
        }
        if (this.osmUserService.isLoggedIn() === false) {
            return this.resources.noDescriptionLoginRequired;
        }
        return this.resources.emptyPoiDescription;
    }

    public isEditMode(): boolean {
        return this.editMode;
    }

    public setEditMode() {
        if (this.osmUserService.isLoggedIn() === false) {
            this.toastService.info(this.resources.loginRequired);
            return;
        }
        this.editMode = true;
    }

    public isRoute() {
        return this.poiExtended && this.poiExtended.isRoute;
    }

    public getIcon() {
        if (this.poiExtended && this.poiExtended.isEditable === false) {
            return this.poiExtended.icon;
        }
        return "icon-camera";
    }

    public async save() {
        this.poiExtended.title = this.info.title;
        this.poiExtended.description = this.info.description;
        this.poiExtended.icon = this.selectedCategory.selectedIcon.icon,
        this.poiExtended.iconColor = this.selectedCategory.selectedIcon.color;
        this.poiExtended.url = this.info.url;
        this.isLoading = true;
        try {
            let poiExtended = await this.poiService.uploadPoint(this.poiExtended, this.info.imagesFiles);
            this.initFromPointOfInterestExtended(poiExtended);
            this.toastService.info(this.resources.dataUpdatedSuccefully);
            this.editMode = false;
        } catch (ex) {
            this.toastService.error(this.resources.unableToSaveData);
        } finally {
            this.isLoading = false;
        };
    }

    public voteUp() {
        this.vote(1);
    }

    public voteDown() {
        this.vote(-1);
    }

    public canVote(type: string): boolean {
        if (this.osmUserService.isLoggedIn() === false) {
            return false;
        }
        if (this.poiExtended == null) {
            return false;
        }
        let vote = _.find(this.poiExtended.rating.raters, r => r.id === this.osmUserService.userId);
        if (vote == null) {
            return true;
        }
        return type === "up" && vote.value < 0 || type === "down" && vote.value > 0;
    }

    private vote(value: number) {
        if (this.canVote(value > 0 ? "up" : "down") === false) {
            if (this.osmUserService.isLoggedIn() === false) {
                this.toastService.info(this.resources.loginRequired);
            }
            return;
        }
        this.poiExtended.rating.raters = this.poiExtended.rating.raters.filter(r => r.id !== this.osmUserService.userId);
        this.poiExtended.rating.raters.push({ id: this.osmUserService.userId, value: value } as IRater);
        this.poiService.uploadRating(this.poiExtended.rating).then((rating) => {
            this.poiExtended.rating = rating;
            this.rating = this.getRatingNumber(rating);
        });
    }

    public convertToRoute() {
        let routesCopy = JSON.parse(JSON.stringify(this.poiExtended.dataContainer.routes))  as Common.RouteData[];
        this.mapService.routesJsonToRoutesObject(routesCopy);
        routesCopy[0].description = this.info.description;
        this.routesService.setData(routesCopy);
        this.clear();
    }

    public addPointToRoute() {
        if (this.routesService.selectedRoute == null && this.routesService.routes.length > 0) {
            this.routesService.changeRouteState(this.routesService.routes[0]);
        }
        if (this.routesService.routes.length === 0) {
            let properties = this.routeLayerFactory.createRoute(this.routesService.createRouteName()).properties;
            this.routesService.addRoute({ properties: properties, segments: [], markers: [] });
            this.routesService.selectedRoute.setEditMode("None");
        }
        let editMode = this.routesService.selectedRoute.getEditMode();
        this.routesService.selectedRoute.setHiddenState();
        var icon = "icon-star";
        var id = this.info.title;
        if (this.poiExtended) {
            icon = this.poiExtended.icon;
            id = this.poiExtended.id;
        }
        this.routesService.selectedRoute.route.markers.push({
            latlng: this.latLng,
            title: this.info.title,
            description: this.info.description,
            type: icon.replace("icon-", ""),
            id: id,
            urls: this.getUrls(),
            marker: null
        } as IMarkerWithData);
        this.routesService.selectedRoute.setEditMode(editMode);
        this.routesService.selectedRoute.raiseDataChanged();
        this.clear();
    }

    public clear() {
        this.getData().clear();
    }

    private getUrls(): Common.LinkData[] {
        let urls = [] as Common.LinkData[];
        if (this.info.url) {
            urls.push({
                mimeType: "text/html",
                text: this.info.title,
                url: this.info.url
            });
        }
        if (this.poiExtended && this.poiExtended.imagesUrls.length > 0) {
            for (let imageUrl of this.poiExtended.imagesUrls) {
                urls.push({
                    mimeType: `image/${imageUrl.split(".").pop()}`,
                    text: "",
                    url: imageUrl
                });
            }
        }
        return urls;
    }

    public close() {
        this.sidebarService.hide();
    }

    public getEditElementOsmAddress(): string {
        let data = this.getData();
        if (!data.type) {
            return null;
        }
        let baseLayerAddress = this.layersService.selectedBaseLayer.address;
        return this.osmUserService.getEditElementOsmAddress(baseLayerAddress, data.type, data.id);
    }

    public getOffRoadUrl() {
        let data = this.getData();
        if (data.source === "Off-road" && this.sourceImageUrl !== "https://blog.off-road.io/wp-content/images/ic_offroad.png") {
            return `http://off-road.io/track/${data.id}`;
        }
        return null;
    }
}