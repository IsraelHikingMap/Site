// 3rd party
import { NgModule, APP_INITIALIZER, Injector, ErrorHandler } from "@angular/core";
import { CommonModule } from "@angular/common";
import { BrowserModule, HammerModule, Title } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialogModule } from "@angular/material/dialog";
import { MatDividerModule } from "@angular/material/divider";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatGridListModule } from "@angular/material/grid-list";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatRadioModule } from "@angular/material/radio";
import { MatSelectModule } from "@angular/material/select";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatSliderModule } from "@angular/material/slider";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTabsModule } from "@angular/material/tabs";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ClipboardModule } from "@angular/cdk/clipboard";
import { FlexLayoutModule } from "@angular/flex-layout";
import { Angulartics2Module, Angulartics2GoogleGlobalSiteTag } from "angulartics2";
import { NgProgressModule } from "ngx-progressbar";
import { NgProgressHttpModule } from "ngx-progressbar/http";
import { NgxD3Service } from "@katze/ngx-d3";
import { InfiniteScrollModule } from "ngx-infinite-scroll";
import { NgxMapLibreGLModule } from "@maplibre/ngx-maplibre-gl";
import { NgIdleModule } from "@ng-idle/core";
import { LottieModule } from "ngx-lottie";
import { NgReduxModule } from "@angular-redux2/store";
import player from "lottie-web";
// Cordova plugins
import { InAppPurchase2 } from "@ionic-native/in-app-purchase-2/ngx";
import { MobileAccessibility } from "@ionic-native/mobile-accessibility/ngx";
import { Media } from "@ionic-native/media/ngx";
import { File as FileSystemWrapper } from "@ionic-native/file/ngx";
import { FileTransfer } from "@ionic-native/file-transfer/ngx";
import { SocialSharing } from "@ionic-native/social-sharing/ngx";
import { DeviceOrientation } from "@ionic-native/device-orientation/ngx";
// services
import { ScrollToModule } from "./infra/scroll-to/scroll-to.module";
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
import { RoutesFactory } from "./services/layers/routelayers/routes.factory";
import { RouterService } from "./services/router.service";
import { SnappingService } from "./services/snapping.service";
import { FitBoundsService } from "./services/fit-bounds.service";
import { RouteStatisticsService } from "./services/route-statistics.service";
import { ShareUrlsService } from "./services/share-urls.service";
import { IHMTitleService } from "./services/ihm-title.service";
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
import { NonAngularObjectsFactory } from "./services/non-angular-objects.factory";
import { PrivatePoiUploaderService } from "./services/private-poi-uploader.service";
import { SelectedRouteService } from "./services/layers/routelayers/selected-route.service";
import { RunningContextService } from "./services/running-context.service";
import { TracesService } from "./services/traces.service";
import { OpenWithService } from "./services/open-with.service";
import { LoggingService } from "./services/logging.service";
import { DefaultStyleService } from "./services/default-style.service";
import { DatabaseService } from "./services/database.service";
import { ApplicationExitService } from "./services/application-exit.service";
import { ConnectionService } from "./services/connection.service";
import { ScreenService } from "./services/screen.service";
import { PurchaseService } from "./services/purchase.service";
import { ApplicationInitializeService } from "./services/application-initialize.service";
import { DeviceOrientationService } from "./services/device-orientation.service";
import { RecordedRouteService } from "./services/recorded-route.service";
import { NavigateHereService } from "./services/navigate-here.service";
import { GpxDataContainerConverterService } from "./services/gpx-data-container-converter.service";
import { OfflineFilesDownloadService } from "./services/offline-files-download.service";
import { CoordinatesService } from "./services/coordinates.service";
import { AudioPlayerFactory } from "./services/audio-player.factory";
import { GlobalErrorHandler } from "./services/global-error.handler";
// interactions
import { RouteEditPoiInteraction } from "./components/intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "./components/intercations/route-edit-route.interaction";
// directives
import { NameInUseValidatorDirective } from "./directives/name-in-use-validator.directive";
import { ImageCaptureDirective } from "./directives/image-capture.directive";
// pipes
import { OfflineImagePipe } from "./pipes/offline-image.pipe";
// components - dialogs
import { BaseLayerAddDialogComponent } from "./components/dialogs/layers/base-layer-add-dialog.component";
import { BaseLayerEditDialogComponent } from "./components/dialogs/layers/base-layer-edit-dialog.component";
import { OverlayAddDialogComponent } from "./components/dialogs/layers/overlay-add-dialog.component";
import { OverlayEditDialogComponent } from "./components/dialogs/layers/overlay-edit-dialog-component";
import { RouteAddDialogComponent } from "./components/dialogs/routes/route-add-dialog.component";
import { RouteEditDialogComponent } from "./components/dialogs/routes/route-edit-dialog.component";
import { TracesDialogComponent } from "./components/dialogs/traces-dialog.component";
import { SharesDialogComponent } from "./components/dialogs/shares-dialog.component";
import { LanguageDialogComponent } from "./components/dialogs/language-dialog.component";
import { DownloadDialogComponent } from "./components/dialogs/download-dialog.component";
import { ShareDialogComponent } from "./components/dialogs/share-dialog.component";
import { TermsOfServiceDialogComponent } from "./components/dialogs/terms-of-service-dialog.component";
import { ConfirmDialogComponent } from "./components/dialogs/confirm-dialog.component";
import { PrivatePoiEditDialogComponent } from "./components/dialogs/private-poi-edit-dialog.component";
import { PrivatePoiShowDialogComponent } from "./components/dialogs/private-poi-show-dialog.component";
import { ConfigurationDialogComponent } from "./components/dialogs/configuration-dialog.component";
import { ProgressDialogComponent } from "./components/dialogs/progress-dialog.component";
import { UseAppDialogComponent } from "./components/dialogs/use-app-dialog.component";
import { AddSimplePoiDialogComponent } from "./components/dialogs/add-simple-poi-dialog.component";
import { FilesSharesDialogComponent } from "./components/dialogs/files-shares-dialog.component";
import { FacebookWarningDialogComponent } from "./components/dialogs/facebook-warning-dialog.component";
import { IntroDialogComponent } from "./components/dialogs/intro-dialog.component";
import { SendReportDialogComponent } from "./components/dialogs/send-report-dialog.component";
// components
import { SidebarComponent } from "./components/sidebar/sidebar.component";
import { MainMapComponent } from "./components/map/main-map.component";
import { ZoomComponent } from "./components/zoom.component";
import { LocationComponent } from "./components/location.component";
import { LayersSidebarComponent } from "./components/sidebar/layers-sidebar.component";
import { RouteStatisticsComponent } from "./components/route-statistics.component";
import { DrawingComponent } from "./components/drawing.component";
import { CoordinatesComponent } from "./components/coordinates.component";
import { RoutePointOverlayComponent } from "./components/overlays/route-point-overlay.component";
import { PrivatePoiOverlayComponent } from "./components/overlays/private-poi-overlay.component";
import { ClusterOverlayComponent } from "./components/overlays/cluster-overlay.component";
import { GpsLocationOverlayComponent } from "./components/overlays/gps-location-overlay.component";
import { ClearableOverlayComponent } from "./components/overlays/clearable-overlay.component";
import { MissingPartOverlayComponent } from "./components/overlays/missing-part-overlay.component";
import { SearchComponent } from "./components/search.component";
import { InfoSidebarComponent } from "./components/sidebar/info-sidebar.component";
import { IhmLinkComponent } from "./components/ihm-link.component";
import { LegendItemComponent } from "./components/sidebar/legend-item.component";
import { PublicPoiSidebarComponent } from "./components/sidebar/publicpoi/public-poi-sidebar.component";
import { PublicPointOfInterestEditComponent } from "./components/sidebar/publicpoi/public-poi-edit.component";
import { ImageScrollerComponent } from "./components/sidebar/publicpoi/image-scroller.component";
import { ApplicationStateComponent } from "./components/application-state.component";
import { LayersViewComponent } from "./components/map/layers-view.component";
import { RoutesComponent } from "./components/map/routes.component";
import { TracesComponent } from "./components/map/traces.component";
import { AutomaticLayerPresentationComponent } from "./components/map/automatic-layer-presentation.component";
import { SecuredImageComponent } from "./components/secured-image.component";
import { CategoriesGroupComponent } from "./components/sidebar/categories-group.component";
import { MainMenuComponent } from "./components/main-menu.component";
import { CenterMeComponent } from "./components/center-me.component";
import { PhotoSwpieComponent } from "./components/photoswipe.component";
import { BackgroundTextComponent } from "./components/background-text.component";

// variables and functions
import { routes } from "./routes";

export class FileReaderFixForCapacitor extends FileReader {
	constructor() {
		super();
		const zoneOriginalInstance = (this as any)['__zone_symbol__originalInstance'];
		return zoneOriginalInstance || this;
	}
}

window.FileReader = FileReaderFixForCapacitor;

const initializeApplication = (injector: Injector) => async () => {
        await injector.get<ApplicationInitializeService>(ApplicationInitializeService).initialize();
    };

@NgModule({
        imports: [
            CommonModule,
            BrowserModule,
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
            ScrollToModule.forRoot(),
            DragDropModule,
            InfiniteScrollModule,
            NgReduxModule,
            NgxMapLibreGLModule,
            NgIdleModule.forRoot(),
            HammerModule,
            LottieModule.forRoot({ player: () => player })
        ],
        providers: [
            AuthorizationService,
            { provide: HTTP_INTERCEPTORS, useClass: OsmTokenInterceptor, multi: true },
            { provide: APP_INITIALIZER, useFactory: initializeApplication, deps: [Injector], multi: true },
            { provide: ErrorHandler, useClass: GlobalErrorHandler },
            NgxD3Service,
            GetTextCatalogService,
            MapService,
            ResourcesService,
            SidebarService,
            FileService,
            HashService,
            LayersService,
            DataContainerService,
            RoutesFactory,
            RouterService,
            SnappingService,
            FitBoundsService,
            RouteStatisticsService,
            ShareUrlsService,
            Title,
            IHMTitleService,
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
            NonAngularObjectsFactory,
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
            AudioPlayerFactory,
            InAppPurchase2,
            MobileAccessibility,
            Media,
            FileSystemWrapper,
            // eslint-disable-next-line
            FileTransfer,
            SocialSharing,
            DeviceOrientation,
            RouteEditPoiInteraction,
            RouteEditRouteInteraction
        ],
        declarations: [MainMapComponent,
            SidebarComponent,
            LayersSidebarComponent,
            ZoomComponent,
            LocationComponent,
            DrawingComponent,
            CoordinatesComponent,
            RoutePointOverlayComponent,
            PrivatePoiOverlayComponent,
            ClusterOverlayComponent,
            GpsLocationOverlayComponent,
            ClearableOverlayComponent,
            MissingPartOverlayComponent,
            SearchComponent,
            InfoSidebarComponent,
            IhmLinkComponent,
            LegendItemComponent,
            PublicPoiSidebarComponent,
            PublicPointOfInterestEditComponent,
            ImageScrollerComponent,
            ApplicationStateComponent,
            LayersViewComponent,
            RoutesComponent,
            TracesComponent,
            AutomaticLayerPresentationComponent,
            SecuredImageComponent,
            CategoriesGroupComponent,
            MainMenuComponent,
            CenterMeComponent,
            PhotoSwpieComponent,
            BaseLayerAddDialogComponent,
            BaseLayerEditDialogComponent,
            OverlayAddDialogComponent,
            OverlayEditDialogComponent,
            RouteAddDialogComponent,
            RouteEditDialogComponent,
            RouteStatisticsComponent,
            TracesDialogComponent,
            SharesDialogComponent,
            LanguageDialogComponent,
            IntroDialogComponent,
            DownloadDialogComponent,
            ShareDialogComponent,
            TermsOfServiceDialogComponent,
            SendReportDialogComponent,
            ConfirmDialogComponent,
            PrivatePoiEditDialogComponent,
            PrivatePoiShowDialogComponent,
            ConfigurationDialogComponent,
            ProgressDialogComponent,
            UseAppDialogComponent,
            FilesSharesDialogComponent,
            AddSimplePoiDialogComponent,
            FacebookWarningDialogComponent,
            BackgroundTextComponent,
            NameInUseValidatorDirective,
            ImageCaptureDirective,
            OfflineImagePipe,
        ],
        bootstrap: [MainMapComponent]
    })
export class ApplicationModule {
    constructor(angulartics: Angulartics2GoogleGlobalSiteTag) {
        angulartics.startTracking();
    }
}
