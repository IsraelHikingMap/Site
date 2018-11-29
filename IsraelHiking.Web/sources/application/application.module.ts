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
    MatCardModule
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
import { D3Service } from "d3-ng2-service";
import { InfiniteScrollModule } from "ngx-infinite-scroll";
import { NgReduxModule, NgRedux } from "@angular-redux/store";
import { AngularOpenlayersModule } from "ngx-openlayers";
import PouchDB from "pouchdb";
import WorkerPouch from "worker-pouch";
import FontFaceObserver from "fontfaceobserver";
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
import { DeepLinksService } from "./services/deep-links.service";
import { PrivatePoiUploaderService } from "./services/private-poi-uploader.service";
import { SelectedRouteService } from "./services/layers/routelayers/selected-route.service";
import { RunningContextService } from "./services/running-context.service";
import { TracesService } from "./services/traces.service";
// interactions
import { RouteEditPoiInteraction } from "./components/intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "./components/intercations/route-edit-route.interaction";
// directives
import { NameInUseValidatorDirective } from "./directives/name-in-use-validator.directive";
import { ImageCaptureDirective } from "./directives/image-capture.directive";
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
import { LayersViewComponent } from "./components/map/layers-view.component";
import { RoutesComponent } from "./components/map/routes.component";
import { TracesComponent } from "./components/map/traces.component";
// variables and functions
import { routes } from "./routes";
import { ApplicationState } from "./models/models";
import { rootReducer } from "./reducres/root.reducer";
import { initialState } from "./reducres/initial-state";
import { debounceTime } from "rxjs/operators";
import { classToActionMiddleware } from "./reducres/reducer-action-decorator";

export function initializeApplication(injector: Injector) {
    return async () => {
        console.log("Starting IHM Application Initialization");
        let font = new FontFaceObserver("IsraelHikingMap");
        await font.load();
        (PouchDB as any).adapter("worker", WorkerPouch);
        let database = new PouchDB("IHM", {adapter: "worker"});
        let storedState = initialState;
        try {
            let dbState = await database.get("state") as any;
            storedState = dbState.state;
        } catch (ex) {
            // not state.
            (database as any).put({
                _id: "state",
                state: initialState
            });
        }
        // tslint:disable-next-line
        let ngRedux = injector.get(NgRedux) as NgRedux<ApplicationState>;
        ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
        ngRedux.select().pipe(debounceTime(2000)).subscribe(async (state) => {
            console.log(state);
            let dbState = await database.get("state") as any;
            dbState.state = state;
            (database as any).put(dbState);
        });
        try {
            await injector.get<DataContainerService>(DataContainerService).initialize();
            injector.get<DeepLinksService>(DeepLinksService).initialize();
            console.log("Finished IHM Application Initialization");
        } catch (error) {
            console.error("Failed IHM Application Initialization", error);
        }
    };
}

export function getWindow() { return window; }

@NgModule({
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
        FormsModule,
        ReactiveFormsModule,
        FlexLayoutModule,
        ClipboardModule,
        RouterModule.forRoot(routes),
        Angulartics2Module.forRoot([Angulartics2GoogleAnalytics]),
        NgProgressModule.forRoot(),
        NgProgressHttpModule,
        NgxPaginationModule,
        ScrollToModule.forRoot(),
        DndModule.forRoot(),
        NgxImageGalleryModule,
        InfiniteScrollModule,
        NgReduxModule,
        AngularOpenlayersModule
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
        LayersViewComponent,
        RoutesComponent,
        TracesComponent
    ],
    providers: [
        GestureConfig,
        SessionStorageService,
        LocalStorageService,
        AuthorizationService,
        { provide: HTTP_INTERCEPTORS, useClass: OsmTokenInterceptor, multi: true },
        { provide: "Window", useFactory: getWindow },
        { provide: APP_INITIALIZER, useFactory: initializeApplication, deps: [Injector], multi: true },
        D3Service,
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
        DeepLinksService,
        PrivatePoiUploaderService,
        SelectedRouteService,
        RunningContextService,
        TracesService,
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
        NameInUseValidatorDirective,
        TermsOfServiceDialogComponent,
        IhmLinkComponent,
        ConfirmDialogComponent,
        LegendItemComponent,
        PublicPoiSidebarComponent,
        PublicPointOfInterestEditComponent,
        ImageScrollerComponent,
        ApplicationStateComponent,
        PrivatePoiEditDialogComponent,
        LayersViewComponent,
        RoutesComponent,
        TracesComponent,
        ImageCaptureDirective
    ],
    bootstrap: [MainMapComponent]
})
export class ApplicationModule {
    constructor(angulartics2GoogleAnalytics: Angulartics2GoogleAnalytics,
        dragAndDropService: DragAndDropService) {
    }
}
