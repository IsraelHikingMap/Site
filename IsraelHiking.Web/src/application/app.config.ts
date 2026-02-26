import { provideAppInitializer, ErrorHandler, importProvidersFrom, inject, ApplicationConfig } from "@angular/core";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { Title, BrowserModule } from "@angular/platform-browser";
import { CommonModule } from "@angular/common";
import { MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { MatSliderModule } from "@angular/material/slider";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatSelectModule } from "@angular/material/select";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTabsModule } from "@angular/material/tabs";
import { MatRadioModule } from "@angular/material/radio";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatMenuModule } from "@angular/material/menu";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatDividerModule } from "@angular/material/divider";
import { MatCardModule } from "@angular/material/card";
import { MatGridListModule } from "@angular/material/grid-list";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ClipboardModule } from "@angular/cdk/clipboard";
import { provideRouter } from "@angular/router";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { NgxMapLibreGLModule } from "@maplibre/ngx-maplibre-gl";
import { provideNgIdle } from "@ng-idle/core";
import { NgxsModule } from "@ngxs/store";
import { InfiniteScrollDirective } from "ngx-infinite-scroll";
import { progressInterceptor } from "ngx-progressbar/http";
import { provideLottieOptions } from "ngx-lottie";
import { saveAs } from "file-saver-es";
import player from "lottie-web";
// Services
import { AuthorizationService } from "./services/authorization.service";
import { osmTokenInterceptor } from "./services/osm-token.interceptor";
import { ApplicationInitializeService } from "./services/application-initialize.service";
import { GlobalErrorHandler } from "./services/global-error.handler";
import { SaveAsFactory, FileService } from "./services/file.service";
import { GetTextCatalogService } from "./services/gettext-catalog.service";
import { MapService } from "./services/map.service";
import { ResourcesService } from "./services/resources.service";
import { SidebarService } from "./services/sidebar.service";
import { HashService } from "./services/hash.service";
import { LayersService } from "./services/layers.service";
import { DataContainerService } from "./services/data-container.service";
import { RoutesFactory } from "./services/routes.factory";
import { RoutingProvider } from "./services/routing.provider";
import { SnappingService } from "./services/snapping.service";
import { RouteStatisticsService } from "./services/route-statistics.service";
import { ShareUrlsService } from "./services/share-urls.service";
import { MapeakTitleService } from "./services/mapeak-title.service";
import { ToastService } from "./services/toast.service";
import { ElevationProvider } from "./services/elevation.provider";
import { SearchResultsProvider } from "./services/search-results.provider";
import { GeoJsonParser } from "./services/geojson.parser";
import { DragAndDropService } from "./services/drag-and-drop.service";
import { PoiService } from "./services/poi.service";
import { GeoLocationService } from "./services/geo-location.service";
import { ImageGalleryService } from "./services/image-gallery.service";
import { CancelableTimeoutService } from "./services/cancelable-timeout.service";
import { WhatsAppService } from "./services/whatsapp.service";
import { ImageResizeService } from "./services/image-resize.service";
import { OpenWithService } from "./services/open-with.service";
import { PrivatePoiUploaderService } from "./services/private-poi-uploader.service";
import { SelectedRouteService } from "./services/selected-route.service";
import { RunningContextService } from "./services/running-context.service";
import { TracesService } from "./services/traces.service";
import { LoggingService } from "./services/logging.service";
import { DefaultStyleService } from "./services/default-style.service";
import { DatabaseService } from "./services/database.service";
import { ApplicationExitService } from "./services/application-exit.service";
import { ScreenService } from "./services/screen.service";
import { PurchaseService } from "./services/purchase.service";
import { DeviceOrientationService } from "./services/device-orientation.service";
import { RecordedRouteService } from "./services/recorded-route.service";
import { NavigateHereService } from "./services/navigate-here.service";
import { GpxDataContainerConverterService } from "./services/gpx-data-container-converter.service";
import { CoordinatesService } from "./services/coordinates.service";
import { OfflineFilesDownloadService } from "./services/offline-files-download.service";
import { OverpassTurboService } from "./services/overpass-turbo.service";
import { ImageAttributionService } from "./services/image-attribution.service";
import { PmTilesService } from "./services/pmtiles.service";
import { ApplicationUpdateService } from "./services/application-update.service";
import { INatureService } from "./services/inature.service";
import { WikidataService } from "./services/wikidata.service";
import { OsmAddressesService } from "./services/osm-addresses.service";
import { LocationService } from "./services/location.service";
import { LogReaderService } from "./services/log-reader.service";
import { TranslationService } from "./services/translation.service";
import { AnalyticsService } from "./services/analytics.service";
import { NakebService } from "./services/nakeb.service";
// Components
import { RouteEditPoiInteraction } from "./components/intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "./components/intercations/route-edit-route.interaction";
// Directives
import { Angulartics2OnModule } from "./directives/gtag.directive";
// Reducers
import { ConfigurationReducer } from "./reducers/configuration.reducer";
import { LocationReducer } from "./reducers/location.reducer";
import { RoutesReducer } from "./reducers/routes.reducer";
import { RouteEditingReducer } from "./reducers/route-editing.reducer";
import { RecordedRouteReducer } from "./reducers/recorded-route.reducer";
import { TracesReducer } from "./reducers/traces.reducer";
import { LayersReducer } from "./reducers/layers.reducer";
import { ShareUrlsReducer } from "./reducers/share-urls.reducer";
import { UserInfoReducer } from "./reducers/user.reducer";
import { PointsOfInterestReducer } from "./reducers/poi.reducer";
import { InMemoryReducer } from "./reducers/in-memory.reducer";
import { GpsReducer } from "./reducers/gps.reducer";
import { OfflineReducer } from "./reducers/offline.reducer";
import { PaywallReducer } from "./reducers/paywall.reducer";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
    providers: [
        provideAppInitializer(async () => {
            await inject(ApplicationInitializeService).initialize();
        }),
        importProvidersFrom(
            CommonModule,
            BrowserModule,
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
            ClipboardModule,
            NgxMapLibreGLModule,
            InfiniteScrollDirective,
            Angulartics2OnModule,
            DragDropModule,
            NgxsModule.forRoot([
                ConfigurationReducer,
                LocationReducer,
                RoutesReducer,
                RouteEditingReducer,
                RecordedRouteReducer,
                TracesReducer,
                LayersReducer,
                ShareUrlsReducer,
                UserInfoReducer,
                PointsOfInterestReducer,
                InMemoryReducer,
                GpsReducer,
                OfflineReducer,
                PaywallReducer,
            ])
        ),
        AuthorizationService,
        GetTextCatalogService,
        MapService,
        ResourcesService,
        SidebarService,
        FileService,
        HashService,
        LayersService,
        DataContainerService,
        RoutesFactory,
        RoutingProvider,
        SnappingService,
        RouteStatisticsService,
        ShareUrlsService,
        Title,
        MapeakTitleService,
        ToastService,
        ElevationProvider,
        SearchResultsProvider,
        GeoJsonParser,
        DragAndDropService,
        PoiService,
        GeoLocationService,
        ImageGalleryService,
        CancelableTimeoutService,
        WhatsAppService,
        ImageResizeService,
        OpenWithService,
        PrivatePoiUploaderService,
        SelectedRouteService,
        RunningContextService,
        TracesService,
        LoggingService,
        DefaultStyleService,
        DatabaseService,
        ApplicationExitService,
        ScreenService,
        PurchaseService,
        ApplicationInitializeService,
        DeviceOrientationService,
        RecordedRouteService,
        NavigateHereService,
        GpxDataContainerConverterService,
        CoordinatesService,
        OfflineFilesDownloadService,
        OverpassTurboService,
        ImageAttributionService,
        PmTilesService,
        ApplicationUpdateService,
        INatureService,
        WikidataService,
        OsmAddressesService,
        LocationService,
        LogReaderService,
        TranslationService,
        AnalyticsService,
        NakebService,
        RouteEditPoiInteraction,
        RouteEditRouteInteraction,
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        { provide: SaveAsFactory, useFactory: () => saveAs },
        provideHttpClient(
            withInterceptors([osmTokenInterceptor, progressInterceptor])
        ),
        provideNgIdle(),
        provideRouter(routes),
        provideLottieOptions({ player: () => player }),
    ]
}