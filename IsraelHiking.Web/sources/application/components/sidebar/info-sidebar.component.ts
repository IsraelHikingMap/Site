import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import * as L from "leaflet";
import * as _ from "lodash";

import { MapService } from "../../services/map.service";
import { SidebarService } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";
import { LayersService } from "../../services/layers/layers.service";
import { DataContainerService } from "../../services/data-container.service";
import { BaseMapComponent } from "../base-map.component";
import { DownloadDialogComponent } from "../dialogs/download-dialog.component";

type InfoState = "legend" | "about";
type LegendItemType = "POI" | "Way";

export interface ILegendItem {
    latlng: L.LatLng;
    zoom: number;
    title: string;
    id: string;
    map: L.Map;
    type: LegendItemType;
    osmTags: string[];
    link: string;
}

export interface ILegendSection {
    items: ILegendItem[];
    title: string;
    id: string;
}

@Component({
    selector: "info-sidebar",
    templateUrl: "./info-sidebar.component.html",
    styleUrls: ["./info-sidebar.component.css"]
})
export class InfoSidebarComponent extends BaseMapComponent {
    public state: InfoState;
    public legendSections: ILegendSection[];
    public visibleSectionId: string;
    public selectedTabIndex: number;

    constructor(resources: ResourcesService,
        private dialog: MdDialog,
        private sidebarService: SidebarService,
        private mapService: MapService,
        private layersService: LayersService,
        private dataContainerService: DataContainerService) {
        super(resources);

        this.visibleSectionId = null;
        this.selectedTabIndex = 0;
        this.initalizeLegendSections();
        this.state = "about";

        this.resources.languageChanged.subscribe(() => {
            this.initalizeLegendSections();
        });
    }

    public openDownloadDialog = () => {
        this.dialog.open(DownloadDialogComponent, { width: "600px" });
    }

    public toggleInfo = (e: Event) => {
        this.sidebarService.toggle("info");
        this.suppressEvents(e);
    };

    public isActive = (): boolean => {
        return this.sidebarService.viewName === "info";
    }

    public isSectionVisible = (section: ILegendSection) => {
        return this.visibleSectionId === section.id;
    }

    public toggleSectionVisibility = (section: ILegendSection) => {
        if (this.visibleSectionId === section.id) {
            this.visibleSectionId = null;
            return;
        }
        this.visibleSectionId = section.id;
        for (let item of section.items) {
            if (item.map) {
                continue;
            }
            this.initializeItemMap(item);
        }
    };

    public setState = (state: InfoState) => {
        this.state = state;
        if (state === "legend") {
            this.initalizeLegendSections();
        }
    }

    public moveToLocation(item: ILegendItem) {
        this.mapService.map.setView(item.latlng, item.zoom);
    }

    private initializeItemMap = (item: ILegendItem): void => {
        setTimeout(() => {
            item.map = L.map(item.id.toString(),
                {
                    center: item.latlng,
                    zoom: item.zoom,
                    zoomControl: false,
                    attributionControl: false,
                    dragging: false,
                    scrollWheelZoom: false,
                    doubleClickZoom: false,
                    touchZoom: false,
                    tap: false,
                    keyboard: false,
                    inertia: false,
                    layers: [L.tileLayer(this.layersService.selectedBaseLayer.address)]
                } as L.MapOptions);
        }, 200);
    }

    private initalizeLegendSections() {
        let id = 1;
        this.legendSections = [
            {
                title: this.resources.legendMarkedTrails,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendRedMarkedTrail,
                        latlng: L.latLng(32.858, 35.150),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["colour=red"],
                        link: ""
                    },
                    {
                        title: this.resources.legendBlueMarkedTrail,
                        latlng: L.latLng(32.827, 35.313),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["colour=blue"],
                        link: ""
                    },
                    {
                        title: this.resources.legendGreenMarkedTrail,
                        latlng: L.latLng(30.4626, 34.6535),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["colour=green"],
                        link: ""
                    },
                    {
                        title: this.resources.legendBlackMarkedTrail,
                        latlng: L.latLng(32.9408850, 35.376500),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["colour=black"],
                        link: ""
                    },
                    {
                        title: this.resources.legendUnmarkedTrail,
                        latlng: L.latLng(31.1862, 34.7866),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['no "colour" tag'],
                        link: ""
                    },
                    {
                        title: this.resources.legendIsraelTrail,
                        latlng: L.latLng(31.5386, 34.8068),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['Relation "שביל ישראל"'],
                        link: ""
                    },
                    {
                        title: this.resources.legendPurpleRegionalTrail,
                        latlng: L.latLng(33.0476, 35.3844),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    },
                    {
                        title: this.resources.legendOrangeRegionalTrail,
                        latlng: L.latLng(32.7992, 35.451357),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendRegionalTrails,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendJerusalemTrail,
                        latlng: L.latLng(31.7681051, 35.229898),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['Relation "שביל ירושלים"'],
                        link: ""
                    },
                    {
                        title: this.resources.legendSeaToSeaTrail,
                        latlng: L.latLng(33.0039669, 35.384796),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['Relation "מים אל ים"'],
                        link: ""
                    },
                    {
                        title: this.resources.legendGolanTrail,
                        latlng: L.latLng(32.9979383, 35.816524),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['Relation "שביל הגולן"'],
                        link: ""
                    },
                    {
                        title: this.resources.legendKinneretTrail,
                        latlng: L.latLng(32.8935159, 35.629950),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['Relation "שביל סובב כינרת"'],
                        link: ""
                    },
                    {
                        title: this.resources.legendHaifaWadisTrail,
                        latlng: L.latLng(32.7684757, 35.020230),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['Relation "שביל ואדיות חיפה"'],
                        link: ""
                    },
                    {
                        title: this.resources.legendKinneretBicycleTrail,
                        latlng: L.latLng(32.8664313, 35.524077),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['Relation "שביל אופניים צופה כינרת"'],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendSingles,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendUnknownScale,
                        latlng: L.latLng(31.7181377, 35.074078),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ['no "mtb:scale" tag'],
                        link: ""
                    },
                    {
                        title: this.resources.legendEasyWithDirection,
                        latlng: L.latLng(31.6208, 34.7377),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["mtb:scale=0"],
                        link: ""
                    },
                    {
                        title: this.resources.legendModerate,
                        latlng: L.latLng(32.5911896, 35.139556),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["mtb:scale=2, mtb:scale=3"],
                        link: ""
                    },
                    {
                        title: this.resources.legendAdvanced,
                        latlng: L.latLng(32.5967000, 35.135100),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["mtb:scale=4, mtb:scale=5"],
                        link: ""
                    },
                    {
                        title: this.resources.legendChallangingWithDirection,
                        latlng: L.latLng(33.198423, 35.5491829),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
			            osmTags: ["mtb:scale=6"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendBicycleTrails,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendLocalTrail,
                        latlng: L.latLng(30.6234487, 34.906955),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    },
                    {
                        title: this.resources.legendRegionalTrail,
                        latlng: L.latLng(32.099950, 34.8055512),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    },
                    {
                        title: this.resources.legendNationalTrail,
                        latlng: L.latLng(29.982344, 35.0060463),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendTrails,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendAllVehicles,
                        latlng: L.latLng(31.1402847, 34.675276),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=track", "tracktype=grade1"],
                        link: ""
                    },
                    {
                        title: this.resources.legendLight4WDVehicles,
                        latlng: L.latLng(32.784185, 35.1049876),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=track", "tracktype=grade3"],
                        link: ""
                    },
                    {
                        title: this.resources.legendStrong4WDVehicles,
                        latlng: L.latLng(30.590, 34.824),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=track", "tracktype=grade4"],
                        link: ""
                    },
                    {
                        title: this.resources.legendDifficult4WD,
                        latlng: L.latLng(31.116553, 34.4296074),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=track", "tracktype=grade5"],
                        link: ""
                    },
                    {
                        title: this.resources.legendPath,
                        latlng: L.latLng(31.145890, 34.5702167),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=path"],
                        link: ""
                    },
                    {
                        title: this.resources.legendFootPath,
                        latlng: L.latLng(30.5360, 34.781),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=footway", "bicycle=no"],
                        link: ""
                    },
                    {
                        title: this.resources.legendBicyclePath,
                        latlng: L.latLng(31.3422, 34.6253),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=cycleway", "bicycle=designated"],
                        link: ""
                    },
                    {
                        title: this.resources.legendSteps,
                        latlng: L.latLng(31.7684, 35.1661),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=steps"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendWater,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendStream,
                        latlng: L.latLng(33.157367, 35.6587136),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["waterway=stream"],
                        link: ""
                    },
                    {
                        title: this.resources.legendWadi,
                        latlng: L.latLng(30.463327, 34.8630524),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["waterway=stream", "intermittent=yes"],
                        link: ""
                    },
                    {
                        title: this.resources.legendRiver,
                        latlng: L.latLng(32.686559, 35.5675507),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["waterway=river"],
                        link: ""
                    },
                    {
                        title: this.resources.legendLakeReservoir,
                        latlng: L.latLng(33.142870, 35.7321739),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["landuse=reservoir"],
                        link: ""
                    },
                    {
                        title: this.resources.legendSeasonalLake,
                        latlng: L.latLng(31.7849, 34.8694),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=water", "water=reservoir", "intermittent=yes"],
                        link: ""
                    },
                    {
                        title: this.resources.legendWetland,
                        latlng: L.latLng(32.24501, 34.85836),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=wetland"],
                        link: ""
                    },
                    {
                        title: this.resources.legendDryRiverbed,
                        latlng: L.latLng(30.3726, 34.8351),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["waterway=riverbank", "intermittent=yes"],
                        link: ""
                    },
                    {
                        title: this.resources.legendSpringPond,
                        latlng: L.latLng(31.780383, 35.057466),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=spring"],
                        link: ""
                    },
                    {
                        title: this.resources.legendWaterHole,
                        latlng: L.latLng(30.8267548, 34.9205041),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=waterhole"],
                        link: ""
                    },
                    {
                        title: this.resources.legendWaterWell,
                        latlng: L.latLng(31.2748449, 34.5187547),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["man_made=water_well"],
                        link: ""
                    },
                    {
                        title: this.resources.legendCistern,
                        latlng: L.latLng(30.5711209, 35.011185),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["man_made=cistern"],
                        link: ""
                    },
                    {
                        title: this.resources.legendWaterfall,
                        latlng: L.latLng(30.9369968, 35.0723868),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["waterway=waterfall"],
                        link: ""
                    },
                    {
                        title: this.resources.legendWaterTower,
                        latlng: L.latLng(33.0754925, 35.1646104),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["man_made=water_tower"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendRoads,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendMotorway,
                        latlng: L.latLng(32.4088604, 34.946265),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["hihgway=motorway"],
                        link: ""
                    },
                    {
                        title: this.resources.legendTrunk,
                        latlng: L.latLng(31.2540928, 35.109671),
                        zoom: 14,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["hihgway=trunk"],
                        link: ""
                    },
                    {
                        title: this.resources.legendPrimary,
                        latlng: L.latLng(31.7449610, 34.861808),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["hihgway=primary"],
                        link: ""
                    },
                    {
                        title: this.resources.legendSecondary,
                        latlng: L.latLng(31.7421349, 34.720887),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["hihgway=secondary"],
                        link: ""
                    },
                    {
                        title: this.resources.legendTertiary,
                        latlng: L.latLng(31.557, 34.626),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["hihgway=tertiary"],
                        link: ""
                    },
                    {
                        title: this.resources.legendUnclassified,
                        latlng: L.latLng(31.731, 34.610),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["hihgway=unclassified"],
                        link: ""
                    },
                    {
                        title: this.resources.legendLowSpeedStreet,
                        latlng: L.latLng(32.126961, 34.80634),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=residential", "maxspeed=..."],
                        link: ""
                    },
                    {
                        title: this.resources.legendResidental,
                        latlng: L.latLng(31.1980, 34.8364),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=residential"],
                        link: ""
                    },
                    {
                        title: this.resources.legendBridge,
                        latlng: L.latLng(32.115785, 34.9408268),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=...", "bridge=yes"],
                        link: ""
                    },
                    {
                        title: this.resources.legendTunnel,
                        latlng: L.latLng(31.800750, 35.1934469),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["highway=...", "tunnel=yes"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendTransportation,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendRailway,
                        latlng: L.latLng(32.627, 35.267),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["railway=rail"],
                        link: ""
                    },
                    {
                        title: this.resources.legendRailwayTunnel,
                        latlng: L.latLng(31.894930, 34.9952048),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["railway=rail", "tunnel=yes"],
                        link: ""
                    },
                    {
                        title: this.resources.legendRailwayStation,
                        latlng: L.latLng(32.164006, 34.8175406),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["railway=station"],
                        link: ""
                    },
                    {
                        title: this.resources.legendRunwayTaxiway,
                        latlng: L.latLng(32.5960, 35.2300),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["aeroway=runway", "aeroway=taxiway"],
                        link: ""
                    },
                    {
                        title: this.resources.legendAerialway,
                        latlng: L.latLng(33.194320, 35.5600405),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["aerialway=cable_car"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendPoi,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendViewpoint,
                        latlng: L.latLng(30.5972172, 34.772286),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["tourism=viewpoint"],
                        link: ""
                    },
                    {
                        title: this.resources.legendPeak,
                        latlng: L.latLng(30.5544, 34.6933),
                        zoom: 14,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=peak"],
                        link: ""
                    },
                    {
                        title: this.resources.legendRuins,
                        latlng: L.latLng(32.9499110, 35.600000),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["historic=ruins"],
                        link: ""
                    },
                    {
                        title: this.resources.legendArcheologicalSite,
                        latlng: L.latLng(30.7880108, 34.734390),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["historic=archaeological_site"],
                        link: ""
                    },
                    {
                        title: this.resources.legendCave,
                        latlng: L.latLng(30.9097767, 34.759085),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=cave"],
                        link: ""
                    },
                    {
                        title: this.resources.legendAttraction,
                        latlng: L.latLng(32.8644745, 35.7402285),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["tourism=attraction"],
                        link: ""
                    },
                    {
                        title: this.resources.legendTree,
                        latlng: L.latLng(30.909059, 34.7503607),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=tree"],
                        link: ""
                    },
                    {
                        title: this.resources.legendSynagogue,
                        latlng: L.latLng(31.7766, 35.2343),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=place_of_worship", "religion=jewish"],
                        link: ""
                    },
                    {
                        title: this.resources.legendChurch,
                        latlng: L.latLng(32.7210574, 35.0627426),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=place_of_worship", "religion=christian"],
                        link: ""
                    },
                    {
                        title: this.resources.legendMosque,
                        latlng: L.latLng(32.5397514, 34.9137149),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=place_of_worship", "religion=muslim"],
                        link: ""
                    },
                    {
                        title: this.resources.legendHolyPlace,
                        latlng: L.latLng(32.814602, 34.9871233),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=place_of_worship", "religion=bahai"],
                        link: ""
                    },
                    {
                        title: this.resources.legendMemorial,
                        latlng: L.latLng(30.9181904, 35.1389056),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["historic=memorial"],
                        link: ""
                    },
                    {
                        title: this.resources.legendMonument,
                        latlng: L.latLng(31.4608616, 34.5003406),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["historic=monument"],
                        link: ""
                    },
                    {
                        title: this.resources.legendObservationTower,
                        latlng: L.latLng(31.518188, 34.8975115),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["man_made=tower", "tower:type=observation"],
                        link: ""
                    },
                    {
                        title: this.resources.legendAntenna,
                        latlng: L.latLng(31.8972804, 34.753103),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["man_made=tower", "tower:type=communication"],
                        link: ""
                    },
                    {
                        title: this.resources.legendPowerLine,
                        latlng: L.latLng(31.0381288, 35.2023074),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["power=line"],
                        link: ""
                    },
                    {
                        title: this.resources.legendPlayground,
                        latlng: L.latLng(31.9028, 34.8233),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["leisure=playground"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendBarriers,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendGate,
                        latlng: L.latLng(32.722562, 35.0182021),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["barrier=gate", "access=yes"],
                        link: ""
                    },
                    {
                        title: this.resources.legendClosedGate,
                        latlng: L.latLng(32.5326335, 35.5364611),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["barrier=gate", "access=no"],
                        link: ""
                    },
                    {
                        title: this.resources.legendStile,
                        latlng: L.latLng(33.015421, 35.2032667),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["barrier=stile"],
                        link: ""
                    },
                    {
                        title: this.resources.legendBlock,
                        latlng: L.latLng(30.5730456, 35.0763874),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["barrier=block"],
                        link: ""
                    },
                    {
                        title: this.resources.legendLiftGate,
                        latlng: L.latLng(31.1628851, 35.3668841),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["barrier=lift_gate"],
                        link: ""
                    },
                    {
                        title: this.resources.legendCattleGrid,
                        latlng: L.latLng(31.5469925, 34.8662107),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["barrier=cattle_grid"],
                        link: ""
                    },
                    {
                        title: this.resources.legendFence,
                        latlng: L.latLng(31.744669, 35.0464806),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["barrier=fence"],
                        link: ""
                    },
                    {
                        title: this.resources.legendWall,
                        latlng: L.latLng(31.745796, 35.1680724),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["barrier=wall"],
                        link: ""
                    },
                    {
                        title: this.resources.legendCliff,
                        latlng: L.latLng(30.562612, 34.6870565),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["natural=cliff"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendBorders,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendBikePark,
                        latlng: L.latLng(30.8728, 34.7713),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    },
                    {
                        title: this.resources.legendNatureReserveNationalPark,
                        latlng: L.latLng(30.918757, 34.7706127),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["boundary=protected_area"],
                        link: ""
                    },
                    {
                        title: this.resources.legendMilitaryArea,
                        latlng: L.latLng(31.212850, 34.6078000),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["landuse=military"],
                        link: ""
                    },
                    {
                        title: this.resources.legendAreaA,
                        latlng: L.latLng(32.275980, 35.3625011),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=4", 'Relation "שטח A"'],
                        link: ""
                    },
                    {
                        title: this.resources.legendAreaB,
                        latlng: L.latLng(31.3971, 35.0136),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=4", 'Relation "שטח B"'],
                        link: ""
                    },
                    {
                        title: this.resources.legendInternationalBorder,
                        latlng: L.latLng(33.1161, 35.5114),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=2", "border_type=nation"],
                        link: ""
                    },
                    {
                        title: this.resources.legendTheGreenLine,
                        latlng: L.latLng(31.372492, 35.2131299),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=2", "border_type=armistice line"],
                        link: ""
                    },
                    {
                        title: this.resources.legendThePurpleLine,
                        latlng: L.latLng(33.104053, 35.8432388),
                        zoom: 14,
                        id: "_" + id++,
                        map: null,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=2", "border_type=armistice line"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendAmenities,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendBikeShop,
                        latlng: L.latLng(32.103655, 34.8643425),
                        zoom: 14,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["shop=bicycle"],
                        link: ""
                    },
                    {
                        title: this.resources.legendFirstAid,
                        latlng: L.latLng(32.087698, 34.9044684),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=clinic"],
                        link: ""
                    },
                    {
                        title: this.resources.legendPicnicArea,
                        latlng: L.latLng(32.62849, 35.1192),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["tourism=picnic_site"],
                        link: ""
                    },
                    {
                        title: this.resources.legendCampsite,
                        latlng: L.latLng(30.3312823, 35.101190),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["tourism=camp_site"],
                        link: ""
                    },
                    {
                        title: this.resources.legendDrinkingWater,
                        latlng: L.latLng(31.2572354, 35.1596253),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=drinking_water"],
                        link: ""
                    },
                    {
                        title: this.resources.legendCafé,
                        latlng: L.latLng(31.841830, 34.9697882),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=cafe"],
                        link: ""
                    },
                    {
                        title: this.resources.legendReastaurant,
                        latlng: L.latLng(31.830534, 35.0722647),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=restaurant"],
                        link: ""
                    },
                    {
                        title: this.resources.legendParking,
                        latlng: L.latLng(30.831737, 34.7706771),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=parking"],
                        link: ""
                    },
                    {
                        title: this.resources.legendFuelStation,
                        latlng: L.latLng(31.104538, 34.8242998),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=fuel"],
                        link: ""
                    },
                    {
                        title: this.resources.legendConvenienceStore,
                        latlng: L.latLng(32.4341, 34.9222),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["shop=supermarket"],
                        link: ""
                    },
                    {
                        title: this.resources.legendLodging,
                        latlng: L.latLng(30.616876, 34.7959084),
                        zoom: 14,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["tourism=guest_house"],
                        link: ""
                    },
                    {
                        title: this.resources.legendToilettes,
                        latlng: L.latLng(31.0162, 34.7607),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["amenity=toilets"],
                        link: ""
                    },
                    {
                        title: this.resources.legendInformationCenter,
                        latlng: L.latLng(30.611540, 34.8035610),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["tourism=information"],
                        link: ""
                    },
                    {
                        title: this.resources.legendGuidepost,
                        latlng: L.latLng(30.599868, 34.8085070),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["tourism=information", "information=guidepost"],
                        link: ""
                    }
                ]
            },
            {
                title: this.resources.legendAreas,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendCitySettelment,
                        latlng: L.latLng(30.490800, 35.1667000),
                        zoom: 13,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["place=...", "landuse=residential"],
                        link: ""
                    },
                    {
                        title: this.resources.legendOrchard,
                        latlng: L.latLng(30.966883, 34.7150803),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["landuse=orchard"],
                        link: ""
                    },
                    {
                        title: this.resources.legendCrop,
                        latlng: L.latLng(31.289700, 34.5855000),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["landuse=farmland"],
                        link: ""
                    },
                    {
                        title: this.resources.legendWoods,
                        latlng: L.latLng(31.111483, 34.8333120),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["landuse=forst"],
                        link: ""
                    },
                    {
                        title: this.resources.legendGrass,
                        latlng: L.latLng(32.112612, 34.91582358),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["leisure=park"],
                        link: ""
                    },
                    {
                        title: this.resources.legendScrub,
                        latlng: L.latLng(32.485095, 34.8953676),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=scrub"],
                        link: ""
                    },
                    {
                        title: this.resources.legendSand,
                        latlng: L.latLng(31.161293, 34.7459793),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["natural=sand"],
                        link: ""
                    },
                    {
                        title: this.resources.legendCemetary,
                        latlng: L.latLng(32.831568, 35.7989717),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["landuse=cemetery"],
                        link: ""
                    },
                    {
                        title: this.resources.legendQuarry,
                        latlng: L.latLng(31.232942, 35.2049447),
                        zoom: 16,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["landuse=quarry"],
                        link: "http://wiki.openstreetmap.org/wiki/Tag:landuse%3Dquarry"
                    },
                    {
                        title: this.resources.legendConstructionSite,
                        latlng: L.latLng(30.9796, 34.9221),
                        zoom: 15,
                        id: "_" + id++,
                        map: null,
                        type: "POI",
                        osmTags: ["landuse=construction"],
                        link: ""
                    }
                ]
            }
        ];
        // End Of Legend content definition //

        this.dataContainerService.initializationFinished.then(() => {
            if (this.layersService.selectedBaseLayer.key === LayersService.ISRAEL_MTB_MAP) {
                this.removeMtbUnwantedLegend();
            } else if (this.layersService.selectedBaseLayer.key === LayersService.ISRAEL_HIKING_MAP) {
                this.removeIhmUnwantedLegend();
            } else if (this.layersService.selectedBaseLayer.key === LayersService.ESRI) {
                this.legendSections = [];
            }
        });
        let section = _.find(this.legendSections, sectionToFind => sectionToFind.id === this.visibleSectionId);
        if (!section) {
            return;
        }
        for (let item of section.items) {
            this.initializeItemMap(item);
        }
    }

    private removeMtbUnwantedLegend() {
        _.remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendRegionalTrails);
        _.remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendMarkedTrails);

        this.removeItemInSection(this.resources.legendTrails, this.resources.legendDifficult4WD);
        this.removeItemInSection(this.resources.legendTrails, this.resources.legendSteps);
        this.removeItemInSection(this.resources.legendTrails, this.resources.legendBicyclePath);

        this.removeItemInSection(this.resources.legendWater, this.resources.legendSeasonalLake);

        this.removeItemInSection(this.resources.legendRoads, this.resources.legendBridge);
        this.removeItemInSection(this.resources.legendRoads, this.resources.legendTunnel);

        this.removeItemInSection(this.resources.legendPoi, this.resources.legendMonument);

        this.removeItemInSection(this.resources.legendBarriers, this.resources.legendStile);
        this.removeItemInSection(this.resources.legendBarriers, this.resources.legendBlock);
        this.removeItemInSection(this.resources.legendBarriers, this.resources.legendLiftGate);

        this.removeItemInSection(this.resources.legendBorders, this.resources.legendTheGreenLine);
        this.removeItemInSection(this.resources.legendBorders, this.resources.legendThePurpleLine);

        this.removeItemInSection(this.resources.legendAreas, this.resources.legendScrub);
    }

    private removeIhmUnwantedLegend() {
        _.remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendSingles);
        _.remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendBicycleTrails);

        this.removeItemInSection(this.resources.legendWater, this.resources.legendRiver);
        this.removeItemInSection(this.resources.legendWater, this.resources.legendWetland);
        this.removeItemInSection(this.resources.legendWater, this.resources.legendWaterfall);

        this.removeItemInSection(this.resources.legendPoi, this.resources.legendAttraction);
        this.removeItemInSection(this.resources.legendPoi, this.resources.legendObservationTower);
        this.removeItemInSection(this.resources.legendPoi, this.resources.legendAntenna);

        this.removeItemInSection(this.resources.legendBarriers, this.resources.legendStile);
        this.removeItemInSection(this.resources.legendBarriers, this.resources.legendLiftGate);

        this.removeItemInSection(this.resources.legendBorders, this.resources.legendBikePark);

        this.removeItemInSection(this.resources.legendRoads, this.resources.legendLowSpeedStreet);

        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendBikeShop);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendFirstAid);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendCafé);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendReastaurant);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendConvenienceStore);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendLodging);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendToilettes);
        this.removeItemInSection(this.resources.legendAmenities, this.resources.legendInformationCenter);

        this.removeItemInSection(this.resources.legendAreas, this.resources.legendWetland);
        this.removeItemInSection(this.resources.legendAreas, this.resources.legendCemetary);
        this.removeItemInSection(this.resources.legendAreas, this.resources.legendConstructionSite);
    }

    private removeItemInSection(sectionTitle: string, title: string) {
        let section = _.find(this.legendSections, sectionToFind => sectionToFind.title === sectionTitle);
        if (section) {
            _.remove(section.items, itemToRemove => itemToRemove.title === title);
        }
    }
}

