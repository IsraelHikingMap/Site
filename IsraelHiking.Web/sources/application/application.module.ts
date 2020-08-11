// 3rd party
import { NgModule, APP_INITIALIZER, Injector, ErrorHandler } from "@angular/core";
import { CommonModule } from "@angular/common";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { DragDropModule } from "@angular/cdk/drag-drop";
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
import { NgxImageGalleryModule } from "ngx-image-gallery";
import { NgxD3Service } from "@katze/ngx-d3";
import { InfiniteScrollModule } from "ngx-infinite-scroll";
import { NgReduxModule } from "@angular-redux/store";
import { NgxMapboxGLModule } from "ngx-mapbox-gl";
import { NgIdleModule } from "@ng-idle/core";
// Cordova plugins
import { BackgroundGeolocation } from "@ionic-native/background-geolocation/ngx";
import { Brightness } from "@ionic-native/brightness/ngx";
import { Camera } from "@ionic-native/camera/ngx";
import { EmailComposer } from "@ionic-native/email-composer/ngx";
import { File as FileSystemWrapper } from "@ionic-native/file/ngx";
import { InAppBrowser } from "@ionic-native/in-app-browser/ngx";
import { InAppPurchase2 } from "@ionic-native/in-app-purchase-2/ngx";
import { WebView } from "@ionic-native/ionic-webview/ngx";
import { MobileAccessibility } from "@ionic-native/mobile-accessibility/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { Zip } from "@ionic-native/zip/ngx";
import { Device } from "@ionic-native/device/ngx";
import { SQLite } from "@ionic-native/sqlite/ngx";
import { AppVersion } from "@ionic-native/app-version/ngx";
import { Media } from "@ionic-native/media/ngx";
import { FileTransfer } from "@ionic-native/file-transfer/ngx";
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
import { RoutesFactory } from "./services/layers/routelayers/routes.factory";
import { RouterService } from "./services/router.service";
import { SnappingService } from "./services/snapping.service";
import { FitBoundsService } from "./services/fit-bounds.service";
import { RouteStatisticsService } from "./services/route-statistics.service";
import { ShareUrlsService } from "./services/share-urls.service";
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
import { SecuredImageComponent } from "./components/secured-image.component";
import { ConfigurationDialogComponent } from "./components/dialogs/configuration-dialog.component";
import { ProgressDialogComponent } from "./components/dialogs/progress-dialog.component";
import { UseAppDialogComponent } from "./components/dialogs/use-app-dialog.component";
import { CategoriesGroupComponent } from "./components/sidebar/categories-group.component";
import { AddSimplePoiDialogComponent } from "./components/dialogs/add-simple-poi-dialog.component";

// variables and functions
import { routes } from "./routes";

export function initializeApplication(injector: Injector) {
    return async () => {
        await injector.get<ApplicationInitializeService>(ApplicationInitializeService).initialize();
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
            DragDropModule,
            NgxImageGalleryModule,
            InfiniteScrollModule,
            NgReduxModule,
            NgxMapboxGLModule.withConfig({ accessToken: "no-token" }),
            NgIdleModule.forRoot()
        ],
        entryComponents: [
            LayersSidebarComponent,
            BaseLayerAddDialogComponent,
            BaseLayerEditDialogComponent,
            OverlayAddDialogComponent,
            OverlayEditDialogComponent,
            RouteAddDialogComponent,
            RouteEditDialogComponent,
            TracesDialogComponent,
            SharesDialogComponent,
            LanguageDialogComponent,
            CoordinatesComponent,
            RoutePointOverlayComponent,
            PrivatePoiOverlayComponent,
            ClusterOverlayComponent,
            GpsLocationOverlayComponent,
            ClearableOverlayComponent,
            MissingPartOverlayComponent,
            InfoSidebarComponent,
            DownloadDialogComponent,
            ShareDialogComponent,
            TermsOfServiceDialogComponent,
            ConfirmDialogComponent,
            LegendItemComponent,
            PublicPoiSidebarComponent,
            PublicPointOfInterestEditComponent,
            ImageScrollerComponent,
            ApplicationStateComponent,
            PrivatePoiEditDialogComponent,
            PrivatePoiShowDialogComponent,
            AutomaticLayerPresentationComponent,
            ConfigurationDialogComponent,
            ProgressDialogComponent,
            UseAppDialogComponent,
            CategoriesGroupComponent,
            AddSimplePoiDialogComponent
        ],
        providers: [
            GestureConfig,
            SessionStorageService,
            LocalStorageService,
            AuthorizationService,
            { provide: HTTP_INTERCEPTORS, useClass: OsmTokenInterceptor, multi: true },
            { provide: "Window", useFactory: getWindow },
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
            AudioPlayerFactory,
            BackgroundGeolocation,
            Brightness,
            Camera,
            EmailComposer,
            FileSystemWrapper,
            InAppBrowser,
            InAppPurchase2,
            WebView,
            MobileAccessibility,
            StatusBar,
            Zip,
            Device,
            SQLite,
            AppVersion,
            Media,
            // tslint:disable-next-line
            FileTransfer,
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
            SecuredImageComponent,
            ConfigurationDialogComponent,
            ProgressDialogComponent,
            UseAppDialogComponent,
            CategoriesGroupComponent,
            AddSimplePoiDialogComponent,
            NameInUseValidatorDirective,
            ImageCaptureDirective,
            OfflineImagePipe
        ],
        bootstrap: [MainMapComponent]
    })
export class ApplicationModule {
    constructor(angulartics2GoogleAnalytics: Angulartics2GoogleAnalytics) {
        angulartics2GoogleAnalytics.startTracking();
    }
}
