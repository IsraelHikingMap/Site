import { Component, DestroyRef, inject, OnInit, ViewEncapsulation, signal } from "@angular/core";
import { NgClass } from "@angular/common";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { FormsModule } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatFormField, MatLabel, MatOption, MatSelect } from "@angular/material/select";
import { MatDivider } from "@angular/material/divider";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { Dir } from "@angular/cdk/bidi";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { Store } from "@ngxs/store";
import { Immutable } from "immer";
import { ControlComponent, MapComponent, MarkerComponent } from "@maplibre/ngx-maplibre-gl";
import { orderBy } from "lodash-es";
import type { StyleSpecification, Map } from "maplibre-gl";

import { ShareItemComponent } from "../share-item.component";
import { LayersComponent } from "../map/layers.component";
import { RoutesPathComponent } from "../map/routes-path.component";
import { ShareEditDialogComponent, ShareEditDialogComponentData } from "../dialogs/share-edit-dialog.component";
import { ZoomComponent } from "../zoom.component";
import { OsmAttributionComponent } from "../osm-attribution.component";
import { ScrollToDirective } from "../../directives/scroll-to.directive";
import { ResourcesService } from "../../services/resources.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { MapService } from "../../services/map.service";
import { SpatialService } from "../../services/spatial.service";
import { ToastService } from "../../services/toast.service";
import { DataContainerService } from "../../services/data-container.service";
import { RouteStrings } from "../../services/hash.service";
import { SetSearchTermAction } from "../../reducers/in-memory.reducer";
import type { ApplicationState, ShareUrl } from "../../models";

@Component({
    selector: "shares",
    templateUrl: "./shares.component.html",
    encapsulation: ViewEncapsulation.None,
    imports: [MapComponent, LayersComponent, MatButton, MatSelect, MatOption, MatLabel, MatFormField, Dir, ShareItemComponent, FormsModule, MatMenu, MatMenuTrigger, MatCheckbox, MatMenuItem, MarkerComponent, RoutesPathComponent, MatDivider, MatProgressSpinner, ZoomComponent, OsmAttributionComponent, ControlComponent, MatButtonToggle, MatButtonToggleGroup, NgClass]
})
export class SharesComponent implements OnInit {
    public readonly loading = signal(false);
    public readonly showMap = signal(false);
    public readonly mapStyle: StyleSpecification;
    public readonly selectedShareUrl = signal<Immutable<ShareUrl>>(null);
    public readonly filteredShareUrls = signal<Immutable<ShareUrl[]>>([]);
    public readonly routesGeoJson = signal<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
    public readonly sortBy = signal<keyof ShareUrl>("lastModifiedDate");
    private readonly sortDirection = signal<"asc" | "desc">("desc");
    public readonly filter: Record<string, string[]> = {
        difficulty: ["Easy", "Moderate", "Hard", "Unknown"],
        type: ["Biking", "Hiking", "4x4", "Unknown"]
    };

    public readonly resources = inject(ResourcesService);

    private readonly dialog = inject(MatDialog);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly mapService = inject(MapService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly toastService = inject(ToastService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly router = inject(Router);
    private readonly store = inject(Store);

    constructor() {
        this.mapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        const locationState = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        this.mapStyle.zoom = locationState.zoom;
        this.mapStyle.center = [locationState.longitude, locationState.latitude];
        this.runFilter();
        this.destroyRef.onDestroy(() => {
            this.mapService.unsetMap();
        });
        this.store.dispatch(new SetSearchTermAction(""));
        this.store.select((state: ApplicationState) => state.inMemoryState.searchTerm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.runFilter();
        });
        this.store.select((state: ApplicationState) => state.shareUrlsState.shareUrls).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.runFilter();
        });
    }

    public async ngOnInit(): Promise<void> {
        this.loading.set(true);
        await this.shareUrlsService.syncShareUrls();
        this.loading.set(false);
    }

    public mapLoaded(map: Map) {
        this.mapService.setMap(map);
        this.mapService.addArrowToMap(map);
    }

    public onSortChange() {
        this.runFilter();
    }

    public onSortDirectionChange() {
        this.sortDirection.set(this.sortDirection() === "asc" ? "desc" : "asc");
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
        const shareUrls = this.store.selectSnapshot((s: ApplicationState) => s.shareUrlsState.shareUrls);
        const searchTerm = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.searchTerm);
        const filteredShareUrls = shareUrls.filter((share: Immutable<ShareUrl>) => {
            for (const key in this.filter) {
                const propValue = share[key as keyof ShareUrl] as string;
                if (this.filter[key] && !this.filter[key].includes(propValue)) {
                    return false;
                }
            }
            return true;
        }).filter((share) => this.findInShareUrl(share, searchTerm));

        let sortBy: keyof ShareUrl | ((share: Immutable<ShareUrl>) => number) = this.sortBy();
        switch (sortBy) {
            case "length":
                sortBy = (share: Immutable<ShareUrl>) => share.length ?? 0;
                break;
            case "difficulty":
                sortBy = (share: Immutable<ShareUrl>) => {
                    if (share.difficulty === "Easy") return 1;
                    if (share.difficulty === "Moderate") return 2;
                    if (share.difficulty === "Hard") return 3;
                    if (share.difficulty === "Very Hard") return 4;
                    return 0;
                };
                break;
        }
        this.filteredShareUrls.set(orderBy(filteredShareUrls, [sortBy], this.sortDirection()));
    }


    public onStartPointClick(shareUrl: Immutable<ShareUrl>) {
        if (this.clearShareUrlIfSelected(shareUrl.id)) {
            return;
        }
        this.moveToShare(shareUrl);
        ScrollToDirective.scrollTo(`share-url-${shareUrl.id}`, 60);
    }

    public async moveToShare(shareUrl: Immutable<ShareUrl>) {
        this.showMap.set(true);
        const share = await this.shareUrlsService.getShareUrl(shareUrl.id);
        this.selectedShareUrl.set(share);
        const features: GeoJSON.Feature[] = [];
        for (const route of share.dataContainer.routes) {
            features.push(...this.selectedRouteService.createFeaturesForRoute(route));
        }
        this.routesGeoJson.set({ type: "FeatureCollection", features });
        const bounds = SpatialService.getBoundsForFeatureCollection(this.routesGeoJson());
        this.mapService.fitBounds(bounds, 100, { top: 150, left: 50, bottom: window.innerHeight / 2, right: 50 });
    }

    public getIconFromType(shareUrl: Immutable<ShareUrl>) {
        return this.shareUrlsService.getIconFromType(shareUrl.type);
    }

    public deleteShareUrl(shareUrl: Immutable<ShareUrl>) {
        const displayName = this.shareUrlsService.getShareUrlDisplayName(shareUrl);
        const message = `${this.resources.deletionOf} ${displayName}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message,
            confirmAction: async () => {
                try {
                    this.clearShareUrlIfSelected(shareUrl.id);
                    await this.shareUrlsService.deleteShareUrl(shareUrl);
                    this.runFilter();
                } catch (ex) {
                    this.toastService.error(ex, this.resources.unableToDeleteCloudSave);
                }
            },
            type: "YesNo"
        });
    }

    public async openShareUrl(shareUrl: Immutable<ShareUrl>) {
        if (this.selectedRouteService.areRoutesEmpty()) {
            this.router.navigate([RouteStrings.ROUTE_SHARE, shareUrl.id]);
            return;
        }
        this.toastService.confirm({
            message: this.resources.thisWillDeleteAllCurrentRoutesAreYouSure,
            confirmAction: async () => {
                this.router.navigate([RouteStrings.ROUTE_SHARE, shareUrl.id]);
            },
            type: "YesNo"
        });
    }

    public async addShareUrlToRoutes(shareUrl: Immutable<ShareUrl>) {
        const share = await this.shareUrlsService.getShareUrl(shareUrl.id);
        this.router.navigate([RouteStrings.MAP]);
        // This is to let the route change to the map so that the relevant map will be used for fit bounds.
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.dataContainerService.setData(share.dataContainer, true);
    }

    public async openEditShareUrlDialog(shareUrl: Immutable<ShareUrl>) {
        const share = await this.shareUrlsService.getShareUrl(shareUrl.id);
        this.dialog.open<ShareEditDialogComponent, ShareEditDialogComponentData>(ShareEditDialogComponent, {
            width: "480px",
            data: {
                fullShareUrl: share,
                dataContainer: null,
                hasHiddenRoutes: false
            }
        });
    }

    private findInShareUrl(shareUrl: Immutable<ShareUrl>, searchTerm: string) {
        if (!searchTerm) {
            return true;
        }
        const lowerSearchTerm = searchTerm.toLowerCase();
        if ((shareUrl.description || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((shareUrl.title || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((shareUrl.id || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((new Date(shareUrl.lastModifiedDate).toISOString()).toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((new Date(shareUrl.creationDate).toISOString()).toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        return false;
    }

    private clearShareUrlIfSelected(id: string): boolean {
        if (this.selectedShareUrl()?.id !== id) {
            return false;
        }
        this.selectedShareUrl.set(null);
        this.routesGeoJson.set({ type: "FeatureCollection", features: [] });
        return true;
    }
}