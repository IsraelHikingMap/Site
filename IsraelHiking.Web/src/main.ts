// External
import { enableProdMode, provideAppInitializer, ErrorHandler, importProvidersFrom, inject } from "@angular/core";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { Title, BrowserModule, bootstrapApplication } from "@angular/platform-browser";
import { CommonModule } from "@angular/common";
import { provideAnimations } from "@angular/platform-browser/animations";
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
import { FileTransfer } from "@awesome-cordova-plugins/file-transfer/ngx";
import { File as FileSystemWrapper } from "@awesome-cordova-plugins/file/ngx";
import { NgxMapLibreGLModule } from "@maplibre/ngx-maplibre-gl";
import { provideNgIdle } from "@ng-idle/core";
import { NgxsModule } from "@ngxs/store";
import { ScrollToModule } from "@nicky-lenaers/ngx-scroll-to";
import { InfiniteScrollDirective } from "ngx-infinite-scroll";
import { progressInterceptor } from "ngx-progressbar/http";
import { provideLottieOptions } from "ngx-lottie";
import { Angulartics2Module } from "angulartics2";
import { saveAs } from "file-saver-es";
import player from "lottie-web";
// Environment
import { environment } from "./environments/environment";
// Services
import { AuthorizationService } from "./application/services/authorization.service";
import { osmTokenInterceptor } from "./application/services/osm-token.interceptor";
import { ApplicationInitializeService } from "./application/services/application-initialize.service";
import { GlobalErrorHandler } from "./application/services/global-error.handler";
import { SaveAsFactory, FileService } from "./application/services/file.service";
import { GetTextCatalogService } from "./application/services/gettext-catalog.service";
import { MapService } from "./application/services/map.service";
import { ResourcesService } from "./application/services/resources.service";
import { SidebarService } from "./application/services/sidebar.service";
import { HashService } from "./application/services/hash.service";
import { LayersService } from "./application/services/layers.service";
import { DataContainerService } from "./application/services/data-container.service";
import { RoutesFactory } from "./application/services/routes.factory";
import { RoutingProvider } from "./application/services/routing.provider";
import { SnappingService } from "./application/services/snapping.service";
import { FitBoundsService } from "./application/services/fit-bounds.service";
import { RouteStatisticsService } from "./application/services/route-statistics.service";
import { ShareUrlsService } from "./application/services/share-urls.service";
import { MapeakTitleService } from "./application/services/mapeak-title.service";
import { ToastService } from "./application/services/toast.service";
import { ElevationProvider } from "./application/services/elevation.provider";
import { SearchResultsProvider } from "./application/services/search-results.provider";
import { GeoJsonParser } from "./application/services/geojson.parser";
import { DragAndDropService } from "./application/services/drag-and-drop.service";
import { PoiService } from "./application/services/poi.service";
import { GeoLocationService } from "./application/services/geo-location.service";
import { ImageGalleryService } from "./application/services/image-gallery.service";
import { CancelableTimeoutService } from "./application/services/cancelable-timeout.service";
import { WhatsAppService } from "./application/services/whatsapp.service";
import { ImageResizeService } from "./application/services/image-resize.service";
import { OpenWithService } from "./application/services/open-with.service";
import { PrivatePoiUploaderService } from "./application/services/private-poi-uploader.service";
import { SelectedRouteService } from "./application/services/selected-route.service";
import { RunningContextService } from "./application/services/running-context.service";
import { TracesService } from "./application/services/traces.service";
import { LoggingService } from "./application/services/logging.service";
import { DefaultStyleService } from "./application/services/default-style.service";
import { DatabaseService } from "./application/services/database.service";
import { ApplicationExitService } from "./application/services/application-exit.service";
import { ConnectionService } from "./application/services/connection.service";
import { ScreenService } from "./application/services/screen.service";
import { PurchaseService } from "./application/services/purchase.service";
import { DeviceOrientationService } from "./application/services/device-orientation.service";
import { RecordedRouteService } from "./application/services/recorded-route.service";
import { NavigateHereService } from "./application/services/navigate-here.service";
import { GpxDataContainerConverterService } from "./application/services/gpx-data-container-converter.service";
import { CoordinatesService } from "./application/services/coordinates.service";
import { OfflineFilesDownloadService } from "./application/services/offline-files-download.service";
import { OverpassTurboService } from "./application/services/overpass-turbo.service";
import { ImageAttributionService } from "./application/services/image-attribution.service";
import { PmTilesService } from "./application/services/pmtiles.service";
import { ApplicationUpdateService } from "./application/services/application-update.service";
import { INatureService } from "./application/services/inature.service";
import { WikidataService } from "./application/services/wikidata.service";
import { OsmAddressesService } from "./application/services/osm-addresses.service";
import { LocationService } from "./application/services/location.service";
import { LogReaderService } from "./application/services/log-reader.service";
import { AudioPlayerFactory } from "./application/services/audio-player.factory";
// Components
import { RouteEditPoiInteraction } from "./application/components/intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "./application/components/intercations/route-edit-route.interaction";
import { MainMapComponent } from "./application/components/map/main-map.component";
// Reducers
import { ConfigurationReducer } from "./application/reducers/configuration.reducer";
import { LocationReducer } from "./application/reducers/location.reducer";
import { RoutesReducer } from "./application/reducers/routes.reducer";
import { RouteEditingReducer } from "./application/reducers/route-editing.reducer";
import { RecordedRouteReducer } from "./application/reducers/recorded-route.reducer";
import { TracesReducer } from "./application/reducers/traces.reducer";
import { LayersReducer } from "./application/reducers/layers.reducer";
import { ShareUrlsReducer } from "./application/reducers/share-urls.reducer";
import { UserInfoReducer } from "./application/reducers/user.reducer";
import { PointsOfInterestReducer } from "./application/reducers/poi.reducer";
import { InMemoryReducer } from "./application/reducers/in-memory.reducer";
import { GpsReducer } from "./application/reducers/gps.reducer";
import { OfflineReducer } from "./application/reducers/offline.reducer";
import { UIComponentsReducer } from "./application/reducers/ui-components.reducer";

// See https://github.com/ionic-team/capacitor/issues/1564
export class FileReaderFixForCapacitor extends FileReader {
	constructor() {
		super();
        // eslint-disable-next-line
		const zoneOriginalInstance = (this as any).__zone_symbol__originalInstance;
		return zoneOriginalInstance || this;
	}
}
window.FileReader = FileReaderFixForCapacitor;


if (environment.production) {
    enableProdMode();
}

bootstrapApplication(MainMapComponent, {
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
            Angulartics2Module.forRoot(), 
            ScrollToModule.forRoot(), 
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
                UIComponentsReducer
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
        FitBoundsService,
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
        ConnectionService,
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
        AudioPlayerFactory,
        FileSystemWrapper,
        FileTransfer,
        RouteEditPoiInteraction,
        RouteEditRouteInteraction,
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        { provide: SaveAsFactory, useFactory: () => saveAs },
        provideHttpClient(
            withInterceptors([osmTokenInterceptor, progressInterceptor])
        ),
        provideNgIdle(),
        provideAnimations(),
        provideRouter([{ path: "**", component: MainMapComponent }]),
        provideLottieOptions({ player: () => player })
    ]
});
