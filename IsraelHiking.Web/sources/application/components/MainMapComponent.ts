import { Component, Injector, Type, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Location, LocationStrategy, PathLocationStrategy } from "@angular/common";
import { Angulartics2GoogleAnalytics, Angulartics2 } from "angulartics2";
import { ResourcesService } from "../services/ResourcesService";
import { MapService } from "../services/MapService";
import { SidebarService } from "../services/SidebarService";
import { RouteStatisticsService } from "../services/RouteStatisticsService";
import { HashService } from "../services/HashService";
import { ToastService } from "../services/ToastService";
import { DragAndDropService } from "../services/DragAndDropService";
import { BaseMapComponent } from "./BaseMapComponent";
import { ZoomComponent } from "./ZoomComponent";
import { LocationButtonComponent } from "./LocationButtonComponent";
import { LayersComponent } from "./LayersComponent";
import { FileComponent } from "./FileComponent";
import { FileSaveAsComponent } from "./FileSaveAsComponent";
import { EditOSMComponent } from "./EditOSMComponent";
import { RouteStatisticsComponent } from "./RouteStatisticsComponent";
import { OsmUserComponent } from "./OsmUserComponent";
import { LanguageComponent } from "./LanguageComponent";
import { DrawingComponent } from "./DrawingComponent";
import { SearchComponent } from "./SearchComponent";
import { InfoComponent } from "./InfoComponent";
import { ShareComponent } from "./ShareComponent";
import "leaflet";
import "leaflet.locatecontrol";

@Component({
    template: `<ng-progress [ngStyle]="{'z-index':1500}"></ng-progress>`,
    selector: "main-map",
    providers: [Location, { provide: LocationStrategy, useClass: PathLocationStrategy }],
})
export class MainMapComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private location: Location,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private mapService: MapService,
        private sidebarService: SidebarService,
        private routeStatisticsService: RouteStatisticsService,
        private applicationRef: ApplicationRef,
        private toastService: ToastService,
        // needed for initialization
        hashService: HashService,
        dragAndDropService: DragAndDropService,
        angulartics2GoogleAnalytics: Angulartics2GoogleAnalytics,
        angulartics2: Angulartics2
    ) {
        super(resources);
        this.createControls();
    }

    public getIsSidebarVisible() {
        return this.sidebarService.isVisible;
    }

    public closeSidebar() {
        this.sidebarService.hide();
    }

    private createControls() {
        this.createContorl("zoom-control", ZoomComponent, "topleft", true);

        L.control.locate({
            icon: "fa fa-lg icon-crosshairs",
            keepCurrentZoomLevel: true,
            follow: true,
            createButtonCallback: (contianer: HTMLElement, options: any) => {
                let componentFactory = this.componentFactoryResolver.resolveComponentFactory(LocationButtonComponent);
                let componentRef = componentFactory.create(this.injector, [], contianer);
                this.applicationRef.attachView(componentRef.hostView);
                return {
                    link: componentRef.instance.elemnt.nativeElement,
                    icon: componentRef.instance.elemnt.nativeElement.querySelector("i"),
                }
            },
            onLocationError: () => {
                if (window.location.protocol === "https") {
                    this.toastService.warning(this.resources.unableToFindYourLocation);
                } else {
                    this.toastService.warning(this.resources.unableToFindYourLocation + "\n" + this.resources.redirectingToSecuredSite);
                    setTimeout(() => {
                        window.location.href = window.location.href.replace("http", "https");
                    }, 3000);
                }
            }
        } as L.LocateOptions).addTo(this.mapService.map);

        this.createContorl("layer-control", LayersComponent);
        this.createContorl("file-control", FileComponent);
        this.createContorl("save-as-control", FileSaveAsComponent);
        this.createContorl("edit-osm-control", EditOSMComponent, "topleft", true);
        this.createContorl("info-control", InfoComponent);
        this.createContorl("osm-user-control", OsmUserComponent, "topright");
        this.createContorl("search-control", SearchComponent, "topright");
        this.createContorl("drawing-control", DrawingComponent, "topright");
        this.createContorl("share-control", ShareComponent, "topright");
        this.createContorl("language-control", LanguageComponent, "topright");
        this.createContorl("route-statistics-control", RouteStatisticsComponent, "bottomright");

        L.control.scale({ imperial: false } as L.Control.ScaleOptions).addTo(this.mapService.map);
    }

    private createContorl<T>(directiveHtmlName: string, component: Type<T>, position: L.ControlPosition = "topleft", hiddenOnMoblie = false) {
        var control = L.Control.extend({
            options: {
                position: position
            } as L.ControlOptions,
            onAdd: (): HTMLElement => {
                let classString = directiveHtmlName + "-container";
                if (hiddenOnMoblie) {
                    classString += " hidden-xs";
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
