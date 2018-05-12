import { Component, Injector, Type, ComponentFactoryResolver, ApplicationRef, ViewChild, AfterViewInit } from "@angular/core";
import { NgxImageGalleryComponent } from "ngx-image-gallery";
import * as L from "leaflet";

import { ResourcesService } from "../services/resources.service";
import { MapService } from "../services/map.service";
import { SidebarService } from "../services/sidebar.service";
import { RouteStatisticsService } from "../services/route-statistics.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import { ZoomComponent } from "./zoom.component";
import { LocationComponent } from "./location.component";
import { LayersComponent } from "./layers.component";
import { FileComponent } from "./file.component";
import { FileSaveAsComponent } from "./file-save-as.component";
import { EditOSMComponent } from "./edit-osm.component";
import { RouteStatisticsComponent } from "./route-statistics.component";
import { OsmUserComponent } from "./osm-user.component";
import { LanguageComponent } from "./language.component";
import { DrawingComponent } from "./drawing.component";
import { SearchComponent } from "./search.component";
import { InfoComponent } from "./info.component";
import { ShareComponent } from "./share.component";
import { IhmLinkComponent } from "./ihm-link.component";
import { ImageGalleryService } from "../services/image-gallery.service";

@Component({
    selector: "main-map",
    templateUrl: "./main-map.component.html",
})
export class MainMapComponent extends BaseMapComponent implements AfterViewInit {

    @ViewChild(NgxImageGalleryComponent)
    public ngxImageGallery: NgxImageGalleryComponent;

    constructor(resources: ResourcesService,
        private readonly injector: Injector,
        private readonly componentFactoryResolver: ComponentFactoryResolver,
        private readonly mapService: MapService,
        private readonly sidebarService: SidebarService,
        private readonly routeStatisticsService: RouteStatisticsService,
        private readonly applicationRef: ApplicationRef,
        private readonly toastService: ToastService,
        public readonly imageGalleryService: ImageGalleryService
    ) {
        super(resources);
        this.createControls();
    }

    public ngAfterViewInit(): void {
        this.imageGalleryService.setGalleryComponent(this.ngxImageGallery);
    }

    public getIsSidebarVisible() {
        return this.sidebarService.isVisible;
    }

    public closeSidebar() {
        this.sidebarService.hide();
    }

    private createControls() {
        let isIFrame = window.self !== window.top;

        this.createContorl("zoom-control", ZoomComponent, "topleft", L.Browser.mobile);
        this.createContorl("location-control", LocationComponent, "topleft", !L.Browser.mobile && isIFrame);
        this.createContorl("layer-control", LayersComponent, "topleft", false);
        this.createContorl("file-control", FileComponent, "topleft", isIFrame);
        this.createContorl("save-as-control", FileSaveAsComponent, "topleft", isIFrame);
        this.createContorl("edit-osm-control", EditOSMComponent, "topleft", L.Browser.mobile || isIFrame);
        this.createContorl("info-control", InfoComponent, "topleft", false);
        this.createContorl("osm-user-control", OsmUserComponent, "topright", isIFrame);
        this.createContorl("search-control", SearchComponent, "topright", isIFrame);
        this.createContorl("drawing-control", DrawingComponent, "topright", isIFrame);
        this.createContorl("share-control", ShareComponent, "topright", false);
        this.createContorl("language-control", LanguageComponent, "topright", false);
        this.createContorl("ihm-link-control", IhmLinkComponent, "bottomleft", false);
        this.createContorl("route-statistics-control", RouteStatisticsComponent, "bottomright", false);

        L.control.scale({ imperial: false, position: "bottomright" } as L.Control.ScaleOptions).addTo(this.mapService.map);
    }

    private createContorl<T>(directiveHtmlName: string, component: Type<T>, position: L.ControlPosition, hidden: boolean) {
        let control = L.Control.extend({
            options: {
                position: position
            } as L.ControlOptions,
            onAdd: (): HTMLElement => {
                let classString = directiveHtmlName + "-container";
                if (hidden) {
                    classString += " hidden";
                }
                let controlDiv = L.DomUtil.create("div", classString);
                let componentFactory = this.componentFactoryResolver.resolveComponentFactory(component);
                let componentRef = componentFactory.create(this.injector, [], controlDiv);
                this.applicationRef.attachView(componentRef.hostView);
                L.DomEvent.disableClickPropagation(controlDiv);
                return controlDiv;
            },
            onRemove: () => { }
        } as L.ControlOptions);
        new control().addTo(this.mapService.map);
    }
}