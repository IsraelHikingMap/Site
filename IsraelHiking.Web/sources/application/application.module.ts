/// angular
import { NgModule } from "@angular/core";
import { BrowserXhr } from "@angular/http";
import { CommonModule } from "@angular/common";
import { BrowserModule } from "@angular/platform-browser"
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpModule, JsonpModule } from "@angular/http";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MaterialModule, MdDialogModule, MdButtonModule, MdInputModule, MdSliderModule, MdSnackBarModule, MdAutocompleteModule } from "@angular/material";
import { FlexLayoutModule } from "@angular/flex-layout";
import { SessionStorageService, LocalStorageService, WebStorageModule } from "ngx-store";
import { ClipboardModule } from "ngx-clipboard";
import { Angulartics2Module, Angulartics2GoogleAnalytics } from "angulartics2";
import { NgProgressModule, NgProgressBrowserXhr } from "ngx-progressbar";
import { NgxPaginationModule } from "ngx-pagination";
import { ScrollToModule } from "@nicky-lenaers/ngx-scroll-to";
/// services
import { GetTextCatalogService } from "./services/gettext-catalog.service";
import { AuthorizationService } from "./services/authorization.service";
import { MapService } from "./services/map.service";
import { ResourcesService } from "./services/resources.service";
import { FileService } from "./services/file.service";
import { SidebarService } from "./services/sidebar.service";
import { HashService } from "./services/hash.service";
import { LayersService } from "./services/layers/layers.service";
import { RoutesService } from "./services/layers/routelayers/routes.service";
import { DataContainerService } from "./services/data-container.service";
import { RouteLayerFactory } from "./services/layers/routelayers/route-layer.factory";
import { RouterService } from "./services/routers/router.service";
import { SnappingService } from "./services/snapping.service";
import { FitBoundsService } from "./services/fit-bounds.service";
import { RouteStatisticsService } from "./services/route-statistics.service";
import { OsmUserService } from "./services/osm-user.service";
import { ToastService } from "./services/toast.service";
import { ElevationProvider } from "./services/elevation.provider";
import { SearchResultsProvider } from "./services/search-results.provider";
import { GeoJsonParser } from "./services/geojson.parser";
import { WikiMarkersLayer } from "./services/layers/wiki-markers.layer";
import { NakebMarkerLayer } from "./services/layers/nakeb-markers.layer";
import { DragAndDropService } from "./services/drag-and-drop.service";
/// directives
import { GoogleChartDirective } from "./directives/google-chart.directive";
import { DraggableResizableDirective } from "./directives/draggable-resizable.directive";
/// components
import { SidebarComponent } from "./components/sidebar/sidebar.component";
import { MainMapComponent } from "./components/main-map.component";
import { ZoomComponent } from "./components/zoom.component";
import { LocationButtonComponent } from "./components/location-button.component";
import { LayersComponent } from "./components/layers.component";
import { LayersSidebarComponent } from "./components/sidebar/layers-sidebar.component";
import { BaseLayerAddDialogComponent } from "./components/dialogs/layers/base-layer-add-dialog.component";
import { BaseLayerEditDialogComponent } from "./components/dialogs/layers/base-layer-edit-dialog.component";
import { OverlayAddDialogComponent } from "./components/dialogs/layers/overlay-add-dialog.component";
import { OverlayEditDialogComponent } from "./components/dialogs/layers/overlay-edit-dialog-component";
import { RouteAddDialogComponent } from "./components/dialogs/routes/route-add-dialog.component";
import { RouteEditDialogComponent } from "./components/dialogs/routes/route-edit-dialog.component";
import { RouteStatisticsComponent } from "./components/route-statistics.component";
import { RouteStatisticsChartComponent } from "./components/route-statistics-chart.component";
import { RouteStatisticsChartTooltipComponent } from "./components/route-statistics-chart-tooltip.component";
import { FileComponent } from "./components/file.component";
import { FileSaveAsComponent } from "./components/file-save-as.component";
import { EditOSMComponent } from "./components/edit-osm.component";
import { OsmUserComponent } from "./components/osm-user.component";
import { OsmUserDialogComponent } from "./components/dialogs/osm-user-dialog.component";
import { LanguageComponent } from "./components/language.component";
import { LanguageDialogComponent } from "./components/dialogs/language-dialog.component";
import { DrawingComponent } from "./components/drawing.component";
import { RouteMarkerPopupComponent } from "./components/markerpopup/route-marker-popup.component";
import { DrawingPoiMarkerPopupComponent } from "./components/markerpopup/drawing-poi-marker-popup.component";
import { CoordinatesMarkerPopupComponent } from "./components/markerpopup/coordinates-marker-popup.component";
import { SearchResultsMarkerPopupComponent } from "./components/markerpopup/search-results-marker-popup.component";
import { MissingPartMarkerPopupComponent } from "./components/markerpopup/missing-part-marker-popup.component";
import { SearchComponent } from "./components/search.component";
import { InfoComponent } from "./components/info.component";
import { InfoSidebarComponent } from "./components/sidebar/info-sidebar.component";
import { DownloadDialogComponent } from "./components/dialogs/download-dialog.component";
import { ShareComponent } from "./components/share.component";
import { ShareDialogComponent } from "./components/dialogs/share-dialog.component";
import { WikiMarkerPopupComponent } from "./components/markerpopup/wiki-marker-popup.component";
import { NakebMarkerPopupComponent } from "./components/markerpopup/nakeb-marker-popup.component";

export function getWindow() { return window; }

@NgModule({
    imports: [
        CommonModule,
        BrowserModule,
        WebStorageModule,
        HttpModule,
        JsonpModule,
        BrowserAnimationsModule,
        MaterialModule,
        MdDialogModule,
        MdButtonModule,
        MdInputModule,
        MdSnackBarModule,
        MdSliderModule,
        MdAutocompleteModule,
        FormsModule,
        ReactiveFormsModule,
        FlexLayoutModule,
        ClipboardModule,
        RouterModule.forRoot([]),
        Angulartics2Module.forRoot([Angulartics2GoogleAnalytics]),
        NgProgressModule,
        NgxPaginationModule,
        ScrollToModule.forRoot()
    ],
    entryComponents: [ZoomComponent,
        LocationButtonComponent,
        LayersComponent,
        LayersSidebarComponent,
        BaseLayerAddDialogComponent,
        BaseLayerEditDialogComponent,
        OverlayAddDialogComponent,
        OverlayEditDialogComponent,
        RouteAddDialogComponent,
        RouteEditDialogComponent,
        RouteStatisticsComponent,
        RouteStatisticsChartTooltipComponent,
        FileComponent,
        FileSaveAsComponent,
        EditOSMComponent,
        OsmUserComponent,
        OsmUserDialogComponent,
        LanguageComponent,
        LanguageDialogComponent,
        DrawingComponent,
        RouteMarkerPopupComponent,
        DrawingPoiMarkerPopupComponent,
        CoordinatesMarkerPopupComponent,
        SearchResultsMarkerPopupComponent,
        MissingPartMarkerPopupComponent,
        SearchComponent,
        InfoComponent,
        InfoSidebarComponent,
        DownloadDialogComponent,
        ShareComponent,
        ShareDialogComponent,
        WikiMarkerPopupComponent,
        NakebMarkerPopupComponent
    ],
    providers: [SessionStorageService,
        LocalStorageService,
        AuthorizationService,
        { provide: BrowserXhr, useClass: NgProgressBrowserXhr },
        { provide: "Window", useFactory: getWindow },
        GetTextCatalogService,
        MapService,
        ResourcesService,
        SidebarService,
        FileService,
        HashService,
        LayersService,
        RoutesService,
        DataContainerService,
        RouteLayerFactory,
        RouterService,
        SnappingService,
        FitBoundsService,
        RouteStatisticsService,
        OsmUserService,
        ToastService,
        ElevationProvider,
        SearchResultsProvider,
        GeoJsonParser,
        WikiMarkersLayer,
        NakebMarkerLayer,
        DragAndDropService
    ],
    declarations: [MainMapComponent,
        SidebarComponent,
        RouteStatisticsChartComponent,
        LayersSidebarComponent,
        ZoomComponent,
        LocationButtonComponent,
        LayersComponent,
        BaseLayerAddDialogComponent,
        BaseLayerEditDialogComponent,
        OverlayAddDialogComponent,
        OverlayEditDialogComponent,
        RouteAddDialogComponent,
        RouteEditDialogComponent,
        RouteStatisticsComponent,
        RouteStatisticsChartTooltipComponent,
        FileComponent,
        FileSaveAsComponent,
        EditOSMComponent,
        OsmUserComponent,
        OsmUserDialogComponent,
        LanguageComponent,
        LanguageDialogComponent,
        DrawingComponent,
        RouteMarkerPopupComponent,
        DrawingPoiMarkerPopupComponent,
        CoordinatesMarkerPopupComponent,
        SearchResultsMarkerPopupComponent,
        MissingPartMarkerPopupComponent,
        SearchComponent,
        InfoComponent,
        InfoSidebarComponent,
        DownloadDialogComponent,
        ShareComponent,
        ShareDialogComponent,
        WikiMarkerPopupComponent,
        NakebMarkerPopupComponent,
        GoogleChartDirective,
        DraggableResizableDirective
    ],
    bootstrap: [MainMapComponent, SidebarComponent, RouteStatisticsChartComponent]
})
export class ApplicationModule { }
