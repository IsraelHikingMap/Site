import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatFormField, MatLabel, MatOption, MatSelect } from "@angular/material/select";
import { Dir } from "@angular/cdk/bidi";
import { Store } from "@ngxs/store";
import { Immutable } from "immer";
import { MapComponent, MarkerComponent, PopupComponent } from "@maplibre/ngx-maplibre-gl";
import { orderBy } from "lodash-es";
import type { StyleSpecification, Map } from "maplibre-gl";

import { ShareItemComponent } from "../share-item.component";
import { LayersComponent } from "../map/layers.component";
import { RoutesPathComponent } from "../map/routes-path.component";
import { ResourcesService } from "../../services/resources.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { MapService } from "../../services/map.service";
import type { ApplicationState, ShareUrl } from "../../models";

@Component({
    selector: "shares",
    templateUrl: "./shares.component.html",
    styleUrls: ["./shares.component.scss"],
    imports: [MapComponent, LayersComponent, MatButton, MatSelect, MatOption, MatLabel, MatFormField, Dir, ShareItemComponent, FormsModule, MatMenu, MatMenuTrigger, MatCheckbox, MatMenuItem, MarkerComponent, RoutesPathComponent, PopupComponent]
})
export class SharesComponent {
    public mapStyle: StyleSpecification;
    public selectedShareUrl: Immutable<ShareUrl> = null;
    public filteredShareUrls: Immutable<ShareUrl[]> = [];
    public routesGeoJson: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    public sortBy: keyof ShareUrl = "lastModifiedDate";
    public sortDirection: "asc" | "desc" = "desc";
    public filter: Record<string, string[]> = {
        difficulty: ["Easy", "Moderate", "Hard", "Unknown"]
    };

    public readonly resources = inject(ResourcesService);

    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly mapService = inject(MapService);
    private readonly store = inject(Store);

    constructor() {
        this.mapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        const locationState = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        this.mapStyle.zoom = locationState.zoom;
        this.mapStyle.center = [locationState.longitude, locationState.latitude];
        this.runFilter();
    }

    public mapLoaded(map: Map) {
        this.mapService.addArrowToMap(map);
    }

    public onSortChange() {
        this.runFilter();
    }

    public onSortDirectionChange() {
        this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
        this.runFilter();
    }

    public onFilterChange(key: string, value: string) {
        if (this.filter[key].includes(value)) {
            this.filter[key] = this.filter[key].filter((x) => x !== value);
        } else {
            this.filter[key].push(value);
        }
        this.runFilter();
    }

    private async runFilter() {
        const shareUrls = await this.getSharesNormialized();
        const filteredShareUrls = shareUrls.filter((share: Immutable<ShareUrl>) => {
            for (const key in this.filter) {
                const propValue = share[key as any as keyof ShareUrl];
                if (this.filter[key] && !this.filter[key].includes(propValue as any)) {
                    return false;
                }
            }
            return true;
        });
        let sortBy = this.sortBy;
        switch (sortBy) {
            case "length":
                sortBy = [((share: ShareUrl) => share.length ?? 0)] as any;
                break;
            case "difficulty":
                sortBy = [((share: ShareUrl) => {
                    if (share.difficulty === "Easy") return 1;
                    if (share.difficulty === "Moderate") return 2;
                    if (share.difficulty === "Hard") return 3;
                    return 0;
                })] as any;
                break;
        }
        this.filteredShareUrls = orderBy(filteredShareUrls, sortBy, this.sortDirection);
    }

    private async getSharesNormialized(): Promise<Immutable<ShareUrl>[]> {
        const shareUrls = this.store.selectSnapshot((s: ApplicationState) => s.shareUrlsState.shareUrls);
        const normalized: Immutable<ShareUrl>[] = [];
        for (const share of shareUrls) {
            let dataContainer = share.dataContainer;
            if (!dataContainer) {
                const shareUrl = await this.shareUrlsService.getShareUrl(share.id);
                dataContainer = shareUrl.dataContainer;
            }
            normalized.push({
                ...share,
                length: share.length ?? 0,
                difficulty: share.difficulty ?? "Unknown",
                dataContainer
            });
        }
        return normalized;
    }

    public onStartPointClick(shareUrl: Immutable<ShareUrl>) {
        if (this.selectedShareUrl?.id === shareUrl.id) {
            this.selectedShareUrl = null;
            this.routesGeoJson = { type: "FeatureCollection", features: [] };
            return;
        }
        this.selectedShareUrl = shareUrl;
        const features: GeoJSON.Feature[] = [];
        for (const route of shareUrl.dataContainer.routes) {
            features.push(...this.selectedRouteService.createFeaturesForRoute(route));
        }
        this.routesGeoJson = { type: "FeatureCollection", features };
    }

    public getIconFromType(shareUrl: Immutable<ShareUrl>) {
        return this.shareUrlsService.getIconFromType(shareUrl.type);
    }
}