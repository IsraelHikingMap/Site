import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { remove } from "lodash";

import { SidebarService } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";
import { LayersService } from "../../services/layers/layers.service";
import { BaseMapComponent } from "../base-map.component";
import { ILegendItem, LegendItemComponent } from "./legend-item.component";
import { RouteStrings } from "../../services/hash.service";
import { environment } from "../../../environments/environment";

export interface ILegendSection {
    items: ILegendItem[];
    title: string;
    id: string;
}

@Component({
    selector: "info-sidebar",
    templateUrl: "./info-sidebar.component.html"
})
export class InfoSidebarComponent extends BaseMapComponent {
    public legendSections: ILegendSection[];
    public selectedTabIndex: number;
    private selectedSection: ILegendSection;

    constructor(resources: ResourcesService,
        private readonly router: Router,
        private readonly sidebarService: SidebarService,
        private readonly layersService: LayersService) {
        super(resources);

        this.selectedTabIndex = 0;
        this.selectedSection = null;
        this.legendSections = [];

        this.resources.languageChanged.subscribe(() => {
            this.initalizeLegendSections();
        });
    }

    public showDownloadDialog(): Boolean {
        return !environment.isCordova;
    }

    public openDownloadDialog = () => {
        this.router.navigate([RouteStrings.DOWNLOAD]);
    }

    public isActive = (): boolean => {
        return this.sidebarService.viewName === "info";
    }

    public selectedTabChanged(tabIndex: number) {
        if (tabIndex === 1) {
            this.initalizeLegendSections();
        }
    }

    public openSection(section: ILegendSection) {
        this.selectedSection = section;
    }

    public isSectionOpen(section: ILegendSection) {
        return this.selectedSection != null && this.selectedSection.id === section.id;
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
                        latlng: { lat: 32.858, lng: 35.150 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["colour=red"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendBlueMarkedTrail,
                        latlng: { lat: 32.827, lng: 35.313 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["colour=blue"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendGreenMarkedTrail,
                        latlng: { lat: 30.4626, lng: 34.6535 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["colour=green"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendBlackMarkedTrail,
                        latlng: { lat: 32.9408850, lng: 35.376500 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["colour=black"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendUnmarkedTrail,
                        latlng: { lat: 31.1862, lng: 34.7866 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [`no "colour" tag`],
                        link: "https://wiki.openstreetmap.org/wiki/Key:colour"
                    },
                    {
                        title: this.resources.legendIsraelTrail,
                        latlng: { lat: 31.5386, lng: 34.8068 },
                        zoom: 15,
                        type: "Way",
                        osmTags: [`Relation "שביל ישראל"`],
                        link: "https://www.openstreetmap.org/relation/282071"
                    },
                    {
                        title: this.resources.legendPurpleRegionalTrail,
                        latlng: { lat: 33.0476, lng: 35.3844 },
                        zoom: 15,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    },
                    {
                        title: this.resources.legendOrangeRegionalTrail,
                        latlng: { lat: 32.7992, lng: 35.451357 },
                        zoom: 16,
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
                        latlng: { lat: 31.7681051, lng: 35.229898 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [`Relation "שביל ירושלים"`],
                        link: "https://www.openstreetmap.org/relation/1314299"
                    },
                    {
                        title: this.resources.legendSeaToSeaTrail,
                        latlng: { lat: 33.0039669, lng: 35.384796 },
                        zoom: 15,
                        type: "Way",
                        osmTags: [`Relation "מים אל ים"`],
                        link: "https://www.openstreetmap.org/relation/2860967"
                    },
                    {
                        title: this.resources.legendGolanTrail,
                        latlng: { lat: 32.9979383, lng: 35.816524 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [`Relation "שביל הגולן"`],
                        link: "https://www.openstreetmap.org/relation/568661"
                    },
                    {
                        title: this.resources.legendKinneretTrail,
                        latlng: { lat: 32.8935159, lng: 35.629950 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [`Relation "שביל סובב כינרת"`],
                        link: "https://www.openstreetmap.org/relation/5145441"
                    },
                    {
                        title: this.resources.legendHaifaWadisTrail,
                        latlng: { lat: 32.7684757, lng: 35.020230 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [`Relation "שביל ואדיות חיפה"`],
                        link: "https://www.openstreetmap.org/relation/3734116"
                    },
                    {
                        title: this.resources.legendKinneretBicycleTrail,
                        latlng: { lat: 32.8664313, lng: 35.524077 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [`Relation "שביל אופניים צופה כינרת"`],
                        link: "https://www.openstreetmap.org/relation/1292788"
                    }
                ]
            },
            {
                title: this.resources.legendSingles,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendUnknownScale,
                        latlng: { lat: 31.7181377, lng: 35.074078 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [`no "mtb:scale" tag`],
                        link: "https://wiki.openstreetmap.org/wiki/Key:mtb:scale"
                    },
                    {
                        title: this.resources.legendEasyWithDirection,
                        latlng: { lat: 31.6208, lng: 34.7377 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["mtb:scale=0"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendModerate,
                        latlng: { lat: 32.5911896, lng: 35.139556 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["mtb:scale=1"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendAdvanced,
                        latlng: { lat: 32.5967000, lng: 35.135100 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["mtb:scale=2, mtb:scale=3"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendChallangingWithDirection,
                        latlng: { lat: 33.198423, lng: 35.5491829 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["mtb:scale=4, mtb:scale=5"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    }
                ]
            },
            {
                title: this.resources.legendBicycleTrails,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendLocalTrail,
                        latlng: { lat: 30.6234487, lng: 34.906955 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    },
                    {
                        title: this.resources.legendRegionalTrail,
                        latlng: { lat: 32.099950, lng: 34.8055512 },
                        zoom: 16,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    },
                    {
                        title: this.resources.legendNationalTrail,
                        latlng: { lat: 29.982344, lng: 35.0060463 },
                        zoom: 16,
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
                        latlng: { lat: 31.1402847, lng: 34.675276 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["tracktype=grade1", "highway=track"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendLight4WDVehicles,
                        latlng: { lat: 32.784185, lng: 35.1049876 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["tracktype=grade3", "highway=track"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendStrong4WDVehicles,
                        latlng: { lat: 30.590, lng: 34.824 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["tracktype=grade4", "highway=track"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendDifficult4WD,
                        latlng: { lat: 31.116553, lng: 34.4296074 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["tracktype=grade5", "highway=track"],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendPath,
                        latlng: { lat: 31.145890, lng: 34.5702167 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["highway=path"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendFootPath,
                        latlng: { lat: 30.5360, lng: 34.781 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["highway=footway", "bicycle=no"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendBicyclePath,
                        latlng: { lat: 31.3422, lng: 34.6253 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["highway=cycleway", "bicycle=designated"],
                        link: "https://wiki.openstreetmap.org/wiki/Bicycle"
                    },
                    {
                        title: this.resources.legendSteps,
                        latlng: { lat: 31.7684, lng: 35.1661 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["highway=steps"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    }
                ]
            },
            {
                title: this.resources.legendWater,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendStream,
                        latlng: { lat: 33.157367, lng: 35.6587136 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["waterway=stream"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendWadi,
                        latlng: { lat: 30.463327, lng: 34.8630524 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["waterway=stream", "intermittent=yes"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendRiver,
                        latlng: { lat: 32.686559, lng: 35.5675507 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["waterway=river"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendLakeReservoir,
                        latlng: { lat: 33.142870, lng: 35.7321739 },
                        zoom: 13,
                        type: "POI",
                        osmTags: ["landuse=reservoir"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendSeasonalLake,
                        latlng: { lat: 31.7849, lng: 34.8694 },
                        zoom: 13,
                        type: "POI",
                        osmTags: ["water=reservoir", "natural=water", "intermittent=yes"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendWetland,
                        latlng: { lat: 32.24501, lng: 34.85836 },
                        zoom: 13,
                        type: "POI",
                        osmTags: ["natural=wetland"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendDryRiverbed,
                        latlng: { lat: 30.3726, lng: 34.8351 },
                        zoom: 15,
                        type: "POI",
                        osmTags: ["waterway=riverbank", "intermittent=yes"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendSpringPond,
                        latlng: { lat: 31.780383, lng: 35.057466 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["natural=spring"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendWaterHole,
                        latlng: { lat: 30.8267548, lng: 34.9205041 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["natural=waterhole"],
                        link: "https://forum.openstreetmap.org/viewtopic.php?id=27160"
                    },
                    {
                        title: this.resources.legendWaterWell,
                        latlng: { lat: 31.2748449, lng: 34.5187547 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["man_made=water_well"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendCistern,
                        latlng: { lat: 30.5711209, lng: 35.011185 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["man_made=cistern"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendWaterfall,
                        latlng: { lat: 30.9369968, lng: 35.0723868 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["waterway=waterfall"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendWaterTower,
                        latlng: { lat: 33.0754925, lng: 35.1646104 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["man_made=water_tower"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    }
                ]
            },
            {
                title: this.resources.legendRoads,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendMotorway,
                        latlng: { lat: 32.4088604, lng: 34.946265 },
                        zoom: 13,
                        type: "Way",
                        osmTags: ["hihgway=motorway"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendTrunk,
                        latlng: { lat: 31.2540928, lng: 35.109671 },
                        zoom: 14,
                        type: "Way",
                        osmTags: ["hihgway=trunk"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendPrimary,
                        latlng: { lat: 31.7449610, lng: 34.861808 },
                        zoom: 13,
                        type: "Way",
                        osmTags: ["hihgway=primary"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendSecondary,
                        latlng: { lat: 31.7421349, lng: 34.720887 },
                        zoom: 13,
                        type: "Way",
                        osmTags: ["hihgway=secondary"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendTertiary,
                        latlng: { lat: 31.557, lng: 34.626 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["hihgway=tertiary"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendUnclassified,
                        latlng: { lat: 31.731, lng: 34.610 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["hihgway=unclassified"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendLowSpeedStreet,
                        latlng: { lat: 32.126961, lng: 34.80634 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["highway=residential", "maxspeed=..."],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendResidental,
                        latlng: { lat: 31.1980, lng: 34.8364 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["highway=residential"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendBridge,
                        latlng: { lat: 32.115785, lng: 34.9408268 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["bridge=yes", "highway=..."],
                        link: LegendItemComponent.OSM_KEY_LINK
                    },
                    {
                        title: this.resources.legendTunnel,
                        latlng: { lat: 31.800750, lng: 35.1934469 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["tunnel=yes", "highway=..."],
                        link: LegendItemComponent.OSM_KEY_LINK
                    }
                ]
            },
            {
                title: this.resources.legendTransportation,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendRailway,
                        latlng: { lat: 32.627, lng: 35.267 },
                        zoom: 13,
                        type: "Way",
                        osmTags: ["railway=rail"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendRailwayTunnel,
                        latlng: { lat: 31.894930, lng: 34.9952048 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["railway=rail", "tunnel=yes"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendRailwayStation,
                        latlng: { lat: 32.164006, lng: 34.8175406 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["railway=station"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendRunwayTaxiway,
                        latlng: { lat: 32.5960, lng: 35.2300 },
                        zoom: 13,
                        type: "Way",
                        osmTags: ["aeroway=runway", "aeroway=taxiway"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendAerialway,
                        latlng: { lat: 33.194320, lng: 35.5600405 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["aerialway=cable_car"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    }
                ]
            },
            {
                title: this.resources.legendPoi,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendViewpoint,
                        latlng: { lat: 30.5972172, lng: 34.772286 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["tourism=viewpoint"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendPeak,
                        latlng: { lat: 30.5544, lng: 34.6933 },
                        zoom: 14,
                        type: "POI",
                        osmTags: ["natural=peak"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendRuins,
                        latlng: { lat: 32.9499110, lng: 35.600000 },
                        zoom: 15,
                        type: "POI",
                        osmTags: ["historic=ruins"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendArcheologicalSite,
                        latlng: { lat: 30.7880108, lng: 34.734390 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["historic=archaeological_site"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendCave,
                        latlng: { lat: 31.386269, lng: 35.328282 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["natural=cave"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendAttraction,
                        latlng: { lat: 32.8644745, lng: 35.7402285 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["tourism=attraction"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendTree,
                        latlng: { lat: 30.909059, lng: 34.7503607 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["natural=tree"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendSynagogue,
                        latlng: { lat: 31.7766, lng: 35.2343 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=place_of_worship", "religion=jewish"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendChurch,
                        latlng: { lat: 32.7210574, lng: 35.0627426 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=place_of_worship", "religion=christian"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendMosque,
                        latlng: { lat: 32.5397514, lng: 34.9137149 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=place_of_worship", "religion=muslim"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendHolyPlace,
                        latlng: { lat: 32.814602, lng: 34.9871233 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=place_of_worship", "religion=bahai"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendMemorial,
                        latlng: { lat: 30.9181904, lng: 35.1389056 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["historic=memorial"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendMonument,
                        latlng: { lat: 31.4608616, lng: 34.5003406 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["historic=monument"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendObservationTower,
                        latlng: { lat: 31.518188, lng: 34.8975115 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["man_made=tower", "tower:type=observation"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendAntenna,
                        latlng: { lat: 31.8972804, lng: 34.753103 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["man_made=tower", "tower:type=communication"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendPowerLine,
                        latlng: { lat: 31.0381288, lng: 35.2023074 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["power=line"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendPlayground,
                        latlng: { lat: 31.9028, lng: 34.8233 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["leisure=playground"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    }
                ]
            },
            {
                title: this.resources.legendBarriers,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendGate,
                        latlng: { lat: 32.722562, lng: 35.0182021 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["barrier=gate", "access=yes"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendClosedGate,
                        latlng: { lat: 32.5326335, lng: 35.5364611 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["barrier=gate", "access=no"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendStile,
                        latlng: { lat: 33.015421, lng: 35.2032667 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["barrier=stile"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendBlock,
                        latlng: { lat: 30.5730456, lng: 35.0763874 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["barrier=block"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendLiftGate,
                        latlng: { lat: 31.1628851, lng: 35.3668841 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["barrier=lift_gate"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendCattleGrid,
                        latlng: { lat: 31.5469925, lng: 34.8662107 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["barrier=cattle_grid"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendFence,
                        latlng: { lat: 31.744669, lng: 35.0464806 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["barrier=fence"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendWall,
                        latlng: { lat: 31.745796, lng: 35.1680724 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["barrier=wall"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendCliff,
                        latlng: { lat: 30.562612, lng: 34.6870565 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["natural=cliff"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    }
                ]
            },
            {
                title: this.resources.legendBorders,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendBikePark,
                        latlng: { lat: 30.8728, lng: 34.7713 },
                        zoom: 15,
                        type: "Way",
                        osmTags: [],
                        link: ""
                    },
                    {
                        title: this.resources.legendNatureReserveNationalPark,
                        latlng: { lat: 30.918757, lng: 34.7706127 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["boundary=protected_area"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendMilitaryArea,
                        latlng: { lat: 31.212850, lng: 34.6078000 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["landuse=military"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendAreaA,
                        latlng: { lat: 32.275980, lng: 35.3625011 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=4", `Relation "שטח A"`],
                        link: "https://www.openstreetmap.org/relation/3791783"
                    },
                    {
                        title: this.resources.legendAreaB,
                        latlng: { lat: 31.3971, lng: 35.0136 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=4", `Relation "שטח B"`],
                        link: "https://www.openstreetmap.org/relation/3791784"
                    },
                    {
                        title: this.resources.legendInternationalBorder,
                        latlng: { lat: 33.1161, lng: 35.5114 },
                        zoom: 16,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=2", "border_type=nation"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendTheGreenLine,
                        latlng: { lat: 31.372492, lng: 35.2131299 },
                        zoom: 15,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=2", "border_type=armistice line"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendThePurpleLine,
                        latlng: { lat: 33.104053, lng: 35.8432388 },
                        zoom: 14,
                        type: "Way",
                        osmTags: ["boundary=administrative", "admin_level=2", "border_type=armistice line"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    }
                ]
            },
            {
                title: this.resources.legendAmenities,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendBikeShop,
                        latlng: { lat: 32.103655, lng: 34.8643425 },
                        zoom: 14,
                        type: "POI",
                        osmTags: ["shop=bicycle"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendFirstAid,
                        latlng: { lat: 32.087698, lng: 34.9044684 },
                        zoom: 13,
                        type: "POI",
                        osmTags: ["amenity=clinic"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendPicnicArea,
                        latlng: { lat: 32.62849, lng: 35.1192 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["tourism=picnic_site"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendCampsite,
                        latlng: { lat: 30.3312823, lng: 35.101190 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["tourism=camp_site"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendDrinkingWater,
                        latlng: { lat: 31.2572354, lng: 35.1596253 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=drinking_water"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendCafé,
                        latlng: { lat: 31.841830, lng: 34.9697882 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=cafe"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendReastaurant,
                        latlng: { lat: 31.830534, lng: 35.0722647 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=restaurant"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendParking,
                        latlng: { lat: 30.831737, lng: 34.7706771 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=parking"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendFuelStation,
                        latlng: { lat: 31.104538, lng: 34.8242998 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=fuel"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendConvenienceStore,
                        latlng: { lat: 32.4341, lng: 34.9222 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["shop=supermarket"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendLodging,
                        latlng: { lat: 30.616876, lng: 34.7959084 },
                        zoom: 14,
                        type: "POI",
                        osmTags: ["tourism=guest_house"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendToilettes,
                        latlng: { lat: 31.0162, lng: 34.7607 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["amenity=toilets"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendInformationCenter,
                        latlng: { lat: 30.611540, lng: 34.8035610 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["tourism=information"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendGuidepost,
                        latlng: { lat: 30.599868, lng: 34.8085070 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["information=guidepost", "tourism=information"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    }
                ]
            },
            {
                title: this.resources.legendAreas,
                id: "_" + id++,
                items: [
                    {
                        title: this.resources.legendCitySettelment,
                        latlng: { lat: 30.490800, lng: 35.1667000 },
                        zoom: 13,
                        type: "POI",
                        osmTags: ["landuse=residential", "place=..."],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendOrchard,
                        latlng: { lat: 30.966883, lng: 34.7150803 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["landuse=orchard"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendCrop,
                        latlng: { lat: 31.289700, lng: 34.5855000 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["landuse=farmland"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendWoods,
                        latlng: { lat: 31.111483, lng: 34.8333120 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["landuse=forst"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendGrass,
                        latlng: { lat: 32.112612, lng: 34.91582358 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["leisure=park"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendScrub,
                        latlng: { lat: 32.485095, lng: 34.8953676 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["natural=scrub"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendSand,
                        latlng: { lat: 31.161293, lng: 34.7459793 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["natural=sand"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendCemetary,
                        latlng: { lat: 32.831568, lng: 35.7989717 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["landuse=cemetery"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendQuarry,
                        latlng: { lat: 31.232942, lng: 35.2049447 },
                        zoom: 16,
                        type: "POI",
                        osmTags: ["landuse=quarry"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    },
                    {
                        title: this.resources.legendConstructionSite,
                        latlng: { lat: 30.9796, lng: 34.9221 },
                        zoom: 15,
                        type: "POI",
                        osmTags: ["landuse=construction"],
                        link: LegendItemComponent.OSM_TAG_LINK
                    }
                ]
            }
        ];
        // End Of Legend content definition //

        if (this.layersService.selectedBaseLayer.key === LayersService.ISRAEL_MTB_MAP) {
            this.removeMtbUnwantedLegend();
        } else if (this.layersService.selectedBaseLayer.key === LayersService.ISRAEL_HIKING_MAP) {
            this.removeIhmUnwantedLegend();
        } else if (this.layersService.selectedBaseLayer.key === LayersService.ESRI) {
            this.legendSections = [];
        }
    }

    private removeMtbUnwantedLegend() {
        remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendRegionalTrails);
        remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendMarkedTrails);

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
        remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendSingles);
        remove(this.legendSections, sectionToRemove => sectionToRemove.title === this.resources.legendBicycleTrails);

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
        let section = this.legendSections.find(sectionToFind => sectionToFind.title === sectionTitle);
        if (section) {
            remove(section.items, itemToRemove => itemToRemove.title === title);
        }
    }
}

