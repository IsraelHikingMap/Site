/// angular
import { NgModule } from "@angular/core";
import { BrowserXhr } from "@angular/http";
import { CommonModule } from "@angular/common";
import { BrowserModule } from "@angular/platform-browser"
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpModule, JsonpModule } from "@angular/http";
import { RouterModule, Routes } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MaterialModule, MdDialogModule, MdButtonModule, MdInputModule, MdSliderModule, MdSnackBarModule, MdAutocompleteModule } from "@angular/material";
import { FlexLayoutModule } from "@angular/flex-layout";
import { SessionStorageService, LocalStorageService, WebStorageModule } from "ngx-store";
import { ClipboardModule } from "ngx-clipboard";
import { Angulartics2Module, Angulartics2GoogleAnalytics } from "angulartics2";
import { NgProgressModule, NgProgressBrowserXhr } from "ngx-progressbar";
import { NgxPaginationModule } from "ngx-pagination";
import { ScrollToModule } from "ng2-scroll-to";
/// services
import { GetTextCatalogService } from "./services/GetTextCatalogService";
import { AuthorizationService } from "./services/AuthorizationService";
import { MapService } from "./services/MapService";
import { ResourcesService } from "./services/ResourcesService";
import { FileService } from "./services/FileService";
import { SidebarService } from "./services/SidebarService";
import { HashService } from "./services/HashService";
import { LayersService } from "./services/layers/LayersService";
import { RouteLayerFactory } from "./services/layers/routelayers/RouteLayerFactory";
import { RouterService } from "./services/routers/RouterService";
import { SnappingService } from "./services/SnappingService";
import { FitBoundsService } from "./services/FitBoundsService";
import { RouteStatisticsService } from "./services/RouteStatisticsService";
import { OsmUserService } from "./services/OsmUserService";
import { ToastService } from "./services/ToastService";
import { ElevationProvider } from "./services/ElevationProvider";
import { SearchResultsProvider } from "./services/SearchResultsProvider";
import { GeoJsonParser } from "./services/GeoJsonParser";
import { WikiMarkersLayer } from "./services/layers/WikiMarkersLayer";
import { DragAndDropService } from "./services/DragAndDropService";
/// directives
import { GoogleChartDirective } from "./directives/GoogleChartDirective";
import { DraggableResizableDirective } from "./directives/DraggableResizableDirective";
/// components
import { SidebarComponent } from "./components/sidebar/SidebarComponent";
import { MainMapComponent } from "./components/MainMapComponent";
import { ZoomComponent } from "./components/ZoomComponent";
import { LocationButtonComponent } from "./components/LocationButtonComponent";
import { LayersComponent } from "./components/LayersComponent";
import { LayersSidebarComponent } from "./components/sidebar/LayersSidebarComponent";
import { BaseLayerAddDialogComponent } from "./components/dialogs/layers/BaseLayerAddDialogComponent";
import { BaseLayerEditDialogComponent } from "./components/dialogs/layers/BaseLayerEditDialogComponent";
import { OverlayAddDialogComponent } from "./components/dialogs/layers/OverlayAddDialogComponent";
import { OverlayEditDialogComponent } from "./components/dialogs/layers/OverlayEditDialogComponent";
import { RouteAddDialogComponent } from "./components/dialogs/routes/RouteAddDialogComponent";
import { RouteEditDialogComponent } from "./components/dialogs/routes/RouteEditDialogComponent";
import { RouteStatisticsComponent } from "./components/RouteStatisticsComponent";
import { RouteStatisticsChartComponent } from "./components/RouteStatisticsChartComponent";
import { FileComponent } from "./components/FileComponent";
import { FileSaveAsComponent } from "./components/FileSaveAsComponent";
import { EditOSMComponent } from "./components/EditOSMComponent";
import { OsmUserComponent } from "./components/OsmUserComponent";
import { OsmUserDialogComponent } from "./components/dialogs/OsmUserDialogComponent";
import { LanguageComponent } from "./components/LanguageComponent";
import { LanguageDialogComponent } from "./components/dialogs/LanguageDialogComponent";
import { DrawingComponent } from "./components/DrawingComponent";
import { RouteMarkerPopupComponent } from "./components/markerpopup/RouteMarkerPopupComponent";
import { PoiMarkerPopupComponent } from "./components/markerpopup/PoiMarkerPopupComponent";
import { CoordinatesMarkerPopupComponent } from "./components/markerpopup/CoordinatesMarkerPopupComponent";
import { SearchResultsMarkerPopupComponent } from "./components/markerpopup/SearchResultsMarkerPopupComponent";
import { MissingPartMarkerPopupComponent } from "./components/markerpopup/MissingPartMarkerPopupComponent";
import { SearchComponent } from "./components/SearchComponent";
import { InfoComponent } from "./components/InfoComponent";
import { InfoSidebarComponent } from "./components/sidebar/InfoSidebarComponent";
import { DownloadDialogComponent } from "./components/dialogs/DownloadDialogComponent";
import { ShareComponent } from "./components/ShareComponent";
import { ShareDialogComponent } from "./components/dialogs/ShareDialogComponent";
import { WikiMarkerPopupComponent } from "./components/markerpopup/WikiMarkerPopupComponent";

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
        ScrollToModule,
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
        FileComponent,
        FileSaveAsComponent,
        EditOSMComponent,
        OsmUserComponent,
        OsmUserDialogComponent,
        LanguageComponent,
        LanguageDialogComponent,
        DrawingComponent,
        RouteMarkerPopupComponent,
        PoiMarkerPopupComponent,
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
        DragAndDropService,
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
        FileComponent,
        FileSaveAsComponent,
        EditOSMComponent,
        OsmUserComponent,
        OsmUserDialogComponent,
        LanguageComponent,
        LanguageDialogComponent,
        DrawingComponent,
        RouteMarkerPopupComponent,
        PoiMarkerPopupComponent,
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
        GoogleChartDirective,
        DraggableResizableDirective,
    ],
    bootstrap: [MainMapComponent, SidebarComponent, RouteStatisticsChartComponent]
})
export class ApplicationModule { }
