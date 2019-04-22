// 3rd party
import { NgModule, APP_INITIALIZER, Injector } from "@angular/core";
import { CommonModule } from "@angular/common";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
    GestureConfig,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatSliderModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSelectModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatRadioModule,
    MatCheckboxModule,
    MatToolbarModule,
    MatMenuModule,
    MatExpansionModule,
    MatDividerModule,
    MatCardModule,
    MatGridListModule
} from "@angular/material";
import { FlexLayoutModule } from "@angular/flex-layout";
import { SessionStorageService, LocalStorageService, WebStorageModule } from "ngx-store";
import { ClipboardModule } from "ngx-clipboard";
import { Angulartics2Module } from "angulartics2";
import { Angulartics2GoogleAnalytics } from "angulartics2/ga";
import { NgProgressModule } from "@ngx-progressbar/core";
import { NgProgressHttpModule } from "@ngx-progressbar/http";
import { NgxPaginationModule } from "ngx-pagination";
import { ScrollToModule } from "@nicky-lenaers/ngx-scroll-to";
import { DndModule } from "@beyerleinf/ngx-dnd";
import { NgxImageGalleryModule } from "ngx-image-gallery";
import { NgxD3Service } from "ngx-d3";
import { InfiniteScrollModule } from "ngx-infinite-scroll";
import { NgReduxModule, NgRedux } from "@angular-redux/store";
import { NgxMapboxGLModule } from "ngx-mapbox-gl";
import PouchDB from "pouchdb";
import WorkerPouch from "worker-pouch";
import WebFont from "webfontloader";
import deepmerge from "deepmerge";
// services
import { GetTextCatalogService } from "./services/gettext-catalog.service";
import { AuthorizationService } from "./services/authorization.service";
import { OsmTokenInterceptor } from "./services/osm-token.interceptor";
import { MapService } from "./services/map.service";
import { ResourcesService } from "./services/resources.service";
import { FileService } from "./services/file.service";
import { SidebarService } from "./services/sidebar.service";
import { HashService } from "./services/hash.service";
import { LayersService } from "./services/layers/layers.service";
import { DataContainerService } from "./services/data-container.service";
import { RouteLayerFactory } from "./services/layers/routelayers/route-layer.factory";
import { RouterService } from "./services/routers/router.service";
import { SnappingService } from "./services/snapping.service";
import { FitBoundsService } from "./services/fit-bounds.service";
import { RouteStatisticsService } from "./services/route-statistics.service";
import { ShareUrlsService } from "./services/share-urls.service";
import { ToastService } from "./services/toast.service";
import { ElevationProvider } from "./services/elevation.provider";
import { SearchResultsProvider } from "./services/search-results.provider";
import { GeoJsonParser } from "./services/geojson.parser";
import { CategoriesLayerFactory } from "./services/layers/categories-layers.factory";
import { DragAndDropService } from "./services/drag-and-drop.service";
import { PoiService } from "./services/poi.service";
import { GeoLocationService } from "./services/geo-location.service";
import { ImageGalleryService } from "./services/image-gallery.service";
import { CancelableTimeoutService } from "./services/cancelable-timeout.service";
import { WhatsAppService } from "./services/whatsapp.service";
import { ImageResizeService } from "./services/image-resize.service";
import { NonAngularObjectsFactory } from "./services/non-angular-objects.factory";
import { PrivatePoiUploaderService } from "./services/private-poi-uploader.service";
import { SelectedRouteService } from "./services/layers/routelayers/selected-route.service";
import { RunningContextService } from "./services/running-context.service";
import { TracesService } from "./services/traces.service";
import { OpenWithService } from "./services/open-with.service";
import { LoggingService } from "./services/logging.service";
// interactions
import { RouteEditPoiInteraction } from "./components/intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "./components/intercations/route-edit-route.interaction";
// directives
import { NameInUseValidatorDirective } from "./directives/name-in-use-validator.directive";
import { ImageCaptureDirective } from "./directives/image-capture.directive";
import { AntPathDirective } from "./directives/ant-path.directive";
// components
import { SidebarComponent } from "./components/sidebar/sidebar.component";
import { MainMapComponent } from "./components/map/main-map.component";
import { ZoomComponent } from "./components/zoom.component";
import { LocationComponent } from "./components/location.component";
import { LayersComponent } from "./components/layers.component";
import { LayersSidebarComponent } from "./components/sidebar/layers-sidebar.component";
import { BaseLayerAddDialogComponent } from "./components/dialogs/layers/base-layer-add-dialog.component";
import { BaseLayerEditDialogComponent } from "./components/dialogs/layers/base-layer-edit-dialog.component";
import { OverlayAddDialogComponent } from "./components/dialogs/layers/overlay-add-dialog.component";
import { OverlayEditDialogComponent } from "./components/dialogs/layers/overlay-edit-dialog-component";
import { RouteAddDialogComponent } from "./components/dialogs/routes/route-add-dialog.component";
import { RouteEditDialogComponent } from "./components/dialogs/routes/route-edit-dialog.component";
import { RouteStatisticsComponent } from "./components/route-statistics.component";
import { FileComponent } from "./components/file.component";
import { FileSaveAsComponent } from "./components/file-save-as.component";
import { EditOSMComponent } from "./components/edit-osm.component";
import { OsmUserComponent } from "./components/osm-user.component";
import { TracesDialogComponent } from "./components/dialogs/traces-dialog.component";
import { SharesDialogComponent } from "./components/dialogs/shares-dialog.component";
import { LanguageComponent } from "./components/language.component";
import { LanguageDialogComponent } from "./components/dialogs/language-dialog.component";
import { DrawingComponent } from "./components/drawing.component";
import { CoordinatesComponent } from "./components/coordinates.component";
import { RoutePointOverlayComponent } from "./components/overlays/route-point-overlay.component";
import { PrivatePoiOverlayComponent } from "./components/overlays/private-poi-overlay.component";
import { ClusterOverlayComponent } from "./components/overlays/cluster-overlay.component";
import { GpsLocationOverlayComponent } from "./components/overlays/gps-location-overlay.component";
import { ClearableOverlayComponent } from "./components/overlays/clearable-overlay.component";
import { MissingPartOverlayComponent } from "./components/overlays/missing-part-overlay.component";
import { SearchComponent } from "./components/search.component";
import { InfoComponent } from "./components/info.component";
import { InfoSidebarComponent } from "./components/sidebar/info-sidebar.component";
import { DownloadDialogComponent } from "./components/dialogs/download-dialog.component";
import { ShareComponent } from "./components/share.component";
import { ShareDialogComponent } from "./components/dialogs/share-dialog.component";
import { TermsOfServiceDialogComponent } from "./components/dialogs/terms-of-service-dialog.component";
import { IhmLinkComponent } from "./components/ihm-link.component";
import { ConfirmDialogComponent } from "./components/dialogs/confirm-dialog.component";
import { LegendItemComponent } from "./components/sidebar/legend-item.component";
import { PublicPoiSidebarComponent } from "./components/sidebar/publicpoi/public-poi-sidebar.component";
import { PublicPointOfInterestEditComponent } from "./components/sidebar/publicpoi/public-poi-edit.component";
import { ImageScrollerComponent } from "./components/sidebar/publicpoi/image-scroller.component";
import { ApplicationStateComponent } from "./components/application-state.component";
import { PrivatePoiEditDialogComponent } from "./components/dialogs/private-poi-edit-dialog.component";
import { PrivatePoiShowDialogComponent } from "./components/dialogs/private-poi-show-dialog.component";
import { LayersViewComponent } from "./components/map/layers-view.component";
import { RoutesComponent } from "./components/map/routes.component";
import { TracesComponent } from "./components/map/traces.component";
import { AutomaticLayerPresentationComponent } from "./components/map/automatic-layer-presentation.component";
// variables and functions
import { routes } from "./routes";
import { ApplicationState } from "./models/models";
import { rootReducer } from "./reducres/root.reducer";
import { initialState } from "./reducres/initial-state";
import { debounceTime } from "rxjs/operators";
import { classToActionMiddleware } from "./reducres/reducer-action-decorator";

export function initializeApplication(injector: Injector) {
    return async () => {
        let loggingService = injector.get<LoggingService>(LoggingService);
        try {
            await loggingService.debug("Starting IHM Application Initialization");
            await new Promise((resolve, _) => {
                WebFont.load({
                    custom: {
                        families: ["IsraelHikingMap"]
                    },
                    active: () => resolve(),
                    inactive: () => resolve(),
                    timeout: 5000
                });
            });
            let runningContext = injector.get<RunningContextService>(RunningContextService);
            let useWorkerPouch = (await WorkerPouch.isSupportedBrowser()) && !runningContext.isIos && !runningContext.isEdge;
            let database;
            await loggingService.debug(`useWorkerPouch: ${useWorkerPouch}`);
            if (useWorkerPouch) {
                (PouchDB as any).adapter("worker", WorkerPouch);
                database = new PouchDB("IHM", { adapter: "worker", auto_compaction: true });
            } else {
                database = new PouchDB("IHM", { auto_compaction: true });
            }
            let storedState = initialState;
            // tslint:disable-next-line
            let ngRedux = injector.get(NgRedux) as NgRedux<ApplicationState>;
            if (runningContext.isIFrame) {
                ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
            } else {
                try {
                    let dbState = await database.get("state") as any;
                    storedState = deepmerge(initialState, dbState.state, {
                        arrayMerge: (destinationArray, sourceArray) => {
                            return sourceArray == null ? destinationArray : sourceArray;
                        }
                    });
                    storedState.inMemoryState = initialState.inMemoryState;
                    if (!runningContext.isCordova) {
                        storedState.routes = initialState.routes;
                    }
                } catch (ex) {
                    // no initial state.
                    (database as any).put({
                        _id: "state",
                        state: initialState
                    });
                }
                await loggingService.debug(JSON.stringify(storedState));
                ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
                ngRedux.select().pipe(debounceTime(useWorkerPouch ? 2000 : 30000)).subscribe(async (state) => {
                    let dbState = await database.get("state") as any;
                    dbState.state = state;
                    (database as any).put(dbState);
                });
            }
            injector.get<OpenWithService>(OpenWithService).initialize();
            await loggingService.debug("Finished IHM Application Initialization");
        } catch (error) {
            loggingService.debug(`Failed IHM Application Initialization: ${error.toString()}`);
        }
    };
}

export function getWindow() { return window; }

@
NgModule({
    imports: [
        CommonModule,
        BrowserModule,
        WebStorageModule,
        HttpClientModule,
        BrowserAnimationsModule,
        MatDialogModule,
        MatButtonModule,
        MatInputModule,
        MatSnackBarModule,
        MatSliderModule,
        MatAutocompleteModule,
        MatSlideToggleModule,
        MatTooltipModule,
        MatSelectModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatTabsModule,
        MatRadioModule,
        MatCheckboxModule,
        MatToolbarModule,
        MatMenuModule,
        MatExpansionModule,
        MatDividerModule,
        MatCardModule,
        MatGridListModule,
        FormsModule,
        ReactiveFormsModule,
        FlexLayoutModule,
        ClipboardModule,
        RouterModule.forRoot(routes),
        Angulartics2Module.forRoot(),
        NgProgressModule,
        NgProgressHttpModule,
        NgxPaginationModule,
        ScrollToModule.forRoot(),
        DndModule.forRoot(),
        NgxImageGalleryModule,
        InfiniteScrollModule,
        NgReduxModule,
        NgxMapboxGLModule.withConfig({ accessToken: "no-token" })
    ],
    entryComponents: [ZoomComponent,
        LocationComponent,
        LayersComponent,
        LayersSidebarComponent,
        BaseLayerAddDialogComponent,
        BaseLayerEditDialogComponent,
        OverlayAddDialogComponent,
        OverlayEditDialogComponent,
        RouteAddDialogComponent,
        RouteEditDialogComponent,
        RouteStatisticsComponent,
        FileComponent,
        FileSaveAsComponent,
        EditOSMComponent,
        OsmUserComponent,
        TracesDialogComponent,
        SharesDialogComponent,
        LanguageComponent,
        LanguageDialogComponent,
        DrawingComponent,
        CoordinatesComponent,
        RoutePointOverlayComponent,
        PrivatePoiOverlayComponent,
        ClusterOverlayComponent,
        GpsLocationOverlayComponent,
        ClearableOverlayComponent,
        MissingPartOverlayComponent,
        SearchComponent,
        InfoComponent,
        InfoSidebarComponent,
        DownloadDialogComponent,
        ShareComponent,
        ShareDialogComponent,
        TermsOfServiceDialogComponent,
        IhmLinkComponent,
        ConfirmDialogComponent,
        LegendItemComponent,
        PublicPoiSidebarComponent,
        PublicPointOfInterestEditComponent,
        ImageScrollerComponent,
        ApplicationStateComponent,
        PrivatePoiEditDialogComponent,
        PrivatePoiShowDialogComponent,
        LayersViewComponent,
        RoutesComponent,
        TracesComponent,
        AutomaticLayerPresentationComponent
    ],
    providers: [
        GestureConfig,
        SessionStorageService,
        LocalStorageService,
        AuthorizationService,
        { provide: HTTP_INTERCEPTORS, useClass: OsmTokenInterceptor, multi: true },
        { provide: "Window", useFactory: getWindow },
        { provide: APP_INITIALIZER, useFactory: initializeApplication, deps: [Injector], multi: true },
        NgxD3Service,
        GetTextCatalogService,
        MapService,
        ResourcesService,
        SidebarService,
        FileService,
        HashService,
        LayersService,
        DataContainerService,
        RouteLayerFactory,
        RouterService,
        SnappingService,
        FitBoundsService,
        RouteStatisticsService,
        ShareUrlsService,
        ToastService,
        ElevationProvider,
        SearchResultsProvider,
        GeoJsonParser,
        CategoriesLayerFactory,
        DragAndDropService,
        PoiService,
        GeoLocationService,
        ImageGalleryService,
        CancelableTimeoutService,
        WhatsAppService,
        ImageResizeService,
        NonAngularObjectsFactory,
        OpenWithService,
        PrivatePoiUploaderService,
        SelectedRouteService,
        RunningContextService,
        TracesService,
        LoggingService,
        RouteEditPoiInteraction,
        RouteEditRouteInteraction
    ],
    declarations: [MainMapComponent,
        SidebarComponent,
        LayersSidebarComponent,
        ZoomComponent,
        LocationComponent,
        LayersComponent,
        BaseLayerAddDialogComponent,
        BaseLayerEditDialogComponent,
        OverlayAddDialogComponent,
        OverlayEditDialogComponent,
        RouteAddDialogComponent,
        RouteEditDialogComponent,
        RouteStatisticsComponent,
        FileComponent,
        FileSaveAsComponent,
        EditOSMComponent,
        OsmUserComponent,
        TracesDialogComponent,
        SharesDialogComponent,
        LanguageComponent,
        LanguageDialogComponent,
        DrawingComponent,
        CoordinatesComponent,
        RoutePointOverlayComponent,
        PrivatePoiOverlayComponent,
        ClusterOverlayComponent,
        GpsLocationOverlayComponent,
        ClearableOverlayComponent,
        MissingPartOverlayComponent,
        SearchComponent,
        InfoComponent,
        InfoSidebarComponent,
        DownloadDialogComponent,
        ShareComponent,
        ShareDialogComponent,
        TermsOfServiceDialogComponent,
        IhmLinkComponent,
        ConfirmDialogComponent,
        LegendItemComponent,
        PublicPoiSidebarComponent,
        PublicPointOfInterestEditComponent,
        ImageScrollerComponent,
        ApplicationStateComponent,
        PrivatePoiEditDialogComponent,
        PrivatePoiShowDialogComponent,
        LayersViewComponent,
        RoutesComponent,
        TracesComponent,
        AutomaticLayerPresentationComponent,
        NameInUseValidatorDirective,
        ImageCaptureDirective,
        AntPathDirective
    ],
    bootstrap: [MainMapComponent]
})
export class ApplicationModule {
    constructor(angulartics2GoogleAnalytics: Angulartics2GoogleAnalytics,
        dragAndDropService: DragAndDropService) {
        angulartics2GoogleAnalytics.startTracking();
    }
}
