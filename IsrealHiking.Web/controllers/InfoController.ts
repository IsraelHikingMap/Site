namespace IsraelHiking.Controllers {
    type InfoState = "legend" | "help" | "about";
    type LegendItemType = "POI" | "Way";

    export interface ILegendItem {
        latlng: L.LatLng;
        zoom: number;
        title: string;
        id: number;
        map: L.Map;
        type: LegendItemType;
    }

    export interface ILegendSection {
        items: ILegendItem[];
        title: string;
        id: number;
    }

    export interface IInfoScope extends IRootScope {
        state: InfoState;
        legendSections: ILegendSection[];
        visibleSections: Map<number, boolean>;
        toggleInfo(e: Event): void;
        isActive(): boolean;
        setState(state: InfoState): void;
        isSectionVisible(legendSection: ILegendSection): boolean;
        toggleSectionVisibility(legendSection: ILegendSection): void;
    }

    export class InfoController extends BaseMapController {

        private layersService: Services.Layers.LayersService;
        private $timeout: angular.ITimeoutService;

        constructor($scope: IInfoScope,
            $timeout: angular.ITimeoutService,
            sidebarService: Services.SidebarService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService) {
            super(mapService);

            this.$timeout = $timeout;
            this.layersService = layersService;

            $scope.state = "legend";
            $scope.visibleSections = {};
            this.initalizeLegendSections($scope);

            $scope.$watch(() => $scope.resources.currentLanguage, () => {
                this.initalizeLegendSections($scope);
            });

            $scope.toggleInfo = (e: Event) => {
                sidebarService.toggle("info");
                this.suppressEvents(e);
            };

            $scope.isActive = (): boolean => {
                return sidebarService.viewName === "info";
            }

            $scope.isSectionVisible = (section: ILegendSection) => {
                return $scope.visibleSections[section.id] || false;
            }

            $scope.toggleSectionVisibility = (section: ILegendSection) => {
                $scope.visibleSections[section.id] = !$scope.isSectionVisible(section);
                if (!$scope.visibleSections[section.id]) {
                    return;
                }
                angular.element("#sidebar-wrapper").animate({ scrollTop: angular.element(`#${section.id}`).offset().top }, "slow");
                for (let item of section.items) {
                    if (item.map) {
                        continue;
                    }
                    this.initializeItemMap(item);
                }
            };

            $scope.setState = (state: InfoState) => {
                $scope.state = state;
                if (state === "legend") {
                    this.initalizeLegendSections($scope);
                }
            }
        }

        private initializeItemMap = (item: ILegendItem): void => {
            this.$timeout(() => {
                item.map = L.map(item.id.toString(),
                    {
                        center: item.latlng,
                        zoom: item.zoom,
                        zoomControl: false,
                        attributionControl: false,
                        dragging: false,
                        scrollWheelZoom: false,
                        doubleClickZoom: false,
                        layers: [L.tileLayer(this.layersService.selectedBaseLayer.address)]
                    });
            }, 200);
        }

        private initalizeLegendSections($scope: IInfoScope) {
            let id = 0;
            $scope.legendSections = [
                {
                    title: $scope.resources.legendMarkedTrails,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendRedMarkedTrail,
                            latlng: L.latLng(32.858, 35.150),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendBlueMarkedTrail,
                            latlng: L.latLng(32.827, 35.313),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendGreenMarkedTrail,
                            latlng: L.latLng(30.4626, 34.6535),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendBlackMarkedTrail,
                            latlng: L.latLng(32.9408850, 35.376500),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendIsraelTrail,
                            latlng: L.latLng(31.5386, 34.8068),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendPurpleRegionalTrail,
                            latlng: L.latLng(30.4967, 34.642),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendOrangeRegionalTrail,
                            latlng: L.latLng(32.7992, 35.451357),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendRegionalTrails,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendJerusalemTrail,
                            latlng: L.latLng(31.7681051, 35.229898),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendSeatoSeaTrail,
                            latlng: L.latLng(33.0039669, 35.384796),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendGolanTrail,
                            latlng: L.latLng(32.9979383, 35.816524),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendKinneretTrail,
                            latlng: L.latLng(32.8935159, 35.629950),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendHaifaWadisTrail,
                            latlng: L.latLng(32.7684757, 35.020230),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendKinneretBicycleTrail,
                            latlng: L.latLng(32.8664313, 35.524077),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendSingles,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendUnknownScale,
                            latlng: L.latLng(31.7181377, 35.074078),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendEasyWithDirection,
                            latlng: L.latLng(31.8394124, 34.925923),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendModerate,
                            latlng: L.latLng(32.5911896, 35.139556),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendAdvanced,
                            latlng: L.latLng(32.5967000, 35.135100),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendChallangingWithDirection,
                            latlng: L.latLng(31.8295000, 35.084302),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendBicycleTrails,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendLocalTrail,
                            latlng: L.latLng(30.6234487, 34.906955),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendRegionalTrail,
                            latlng: L.latLng(31.8647653, 34.940742),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendNationalTrail,
                            latlng: L.latLng(29.7095249, 34.940128),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendTrails,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendAllVehicles,
                            latlng: L.latLng(31.1402847, 34.675276),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendLight4WDVehicles,
                            latlng: L.latLng(30.5885, 34.8847),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendStrong4WDVehicles,
                            latlng: L.latLng(30.590, 34.824),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendDifficult4WD,
                            latlng: L.latLng(31.116553, 34.4296074),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendPath,
                            latlng: L.latLng(31.2097, 35.291),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendFootPath,
                            latlng: L.latLng(30.5362, 34.781),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendBicyclePath,
                            latlng: L.latLng(31.633, 35.348),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendSteps,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(31.894805, 35.0051826),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendWater,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendStream,
                            latlng: L.latLng(33.157367, 35.6587136),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendWadi,
                            latlng: L.latLng(30.463327, 34.8630524),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendRiver,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(32.686559, 35.5675507),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendLakeReservoir,
                            latlng: L.latLng(33.142870, 35.7321739),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendSeasonalLake,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(32.566527, 35.0658488),
                            zoom: 14,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendSpringPond,
                            latlng: L.latLng(31.780383, 35.057466),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendWaterHole,
                            latlng: L.latLng(30.8267548, 34.9205041),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendWaterWell,
                            latlng: L.latLng(30.3513872, 34.7330626),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendCistern,
                            latlng: L.latLng(30.5711209, 35.011185),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendWaterfall,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(30.9369968, 35.0723868),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendWaterTower,
                            latlng: L.latLng(33.0754925, 35.1646104),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendRoads,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendMotorway,
                            latlng: L.latLng(32.4088604, 34.946265),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendTrunk,
                            latlng: L.latLng(31.2540928, 35.109671),
                            zoom: 14,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendPrimary,
                            latlng: L.latLng(31.7449610, 34.861808),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendSecondary,
                            latlng: L.latLng(31.7421349, 34.720887),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendTertiary,
                            latlng: L.latLng(31.557, 34.626),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendUnclassified,
                            latlng: L.latLng(31.731, 34.610),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendBridge,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(32.115785, 34.9408268),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendTunnel,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(31.800750, 35.1934469),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendTransportation,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendRailway,
                            latlng: L.latLng(32.627, 35.267),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendRailwayTunnel,
                            latlng: L.latLng(31.894930, 34.9952048),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendRailwayStation,
                            latlng: L.latLng(32.164006, 34.8175406),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendRunwayTaxiway,
                            latlng: L.latLng(32.5960, 35.2300),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendAerialway,
                            latlng: L.latLng(33.194320, 35.5600405),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendPoi,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendViewpoint,
                            latlng: L.latLng(30.5972172, 34.772286),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendPeak,
                            latlng: L.latLng(32.9010649, 35.402584),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendRuins,
                            latlng: L.latLng(32.9499110, 35.600000),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendArcheologicalSite,
                            latlng: L.latLng(30.7880108, 34.734390),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendCave,
                            latlng: L.latLng(30.9097767, 34.759085),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendTree,
                            latlng: L.latLng(30.909059, 34.7503607),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendSynagogue,
                            latlng: L.latLng(30.850875, 34.7822589),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendChurch,
                            latlng: L.latLng(32.7210574, 35.0627426),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendMosque,
                            latlng: L.latLng(32.5397514, 34.9137149),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendHolyPlace,
                            latlng: L.latLng(32.814602, 34.9871233),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendMemorial,
                            latlng: L.latLng(30.9181904, 35.1389056),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendMonument,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(31.4608616, 34.5003406),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendObservationTower,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(31.518188, 34.8975115),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendAntenna,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(31.8972804, 34.753103),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendPowerLine,
                            latlng: L.latLng(31.0381288, 35.2023074),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendBarriers,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendGate,
                            latlng: L.latLng(32.722562, 35.0182021),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendClosedGate,
                            latlng: L.latLng(32.5326335, 35.5364611),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendStile,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(33.015421, 35.2032667),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendBlock,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(30.5730456, 35.0763874),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendLiftGate,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(31.1628851, 35.3668841),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendCattleGrid,
                            latlng: L.latLng(31.5469925, 34.8662107),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendFence,
                            latlng: L.latLng(31.744669, 35.0464806),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendWall,
                            latlng: L.latLng(31.745796, 35.1680724),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendCliff,
                            latlng: L.latLng(30.562612, 34.6870565),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendBorders,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendNatureReserveNationalPark,
                            latlng: L.latLng(30.918757, 34.7706127),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendMilitaryArea,
                            latlng: L.latLng(31.212850, 34.6078000),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendAreaA,
                            latlng: L.latLng(32.275980, 35.3625011),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendAreaB,
                            latlng: L.latLng(31.375623, 35.0551200),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendInternationalBorder,
                            latlng: L.latLng(33.282037, 35.6545830),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendTheGreenLine,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(31.372492, 35.2131299),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendThePurpleLine,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(33.104053, 35.8432388),
                            zoom: 14,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendAmenities,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendBikeShop,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(32.103655, 34.8643425),
                            zoom: 14,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendFirstAid,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(32.087698, 34.9044684),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendPicnicArea,
                            latlng: L.latLng(32.62849, 35.1192),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendCampsite,
                            latlng: L.latLng(30.3312823, 35.101190),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendDrinkingWater,
                            latlng: L.latLng(31.2572354, 35.1596253),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendCafé,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(31.841830, 34.9697882),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendReastaurant,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(31.830534, 35.0722647),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendParking,
                            latlng: L.latLng(30.831737, 34.7706771),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendFuelStation,
                            latlng: L.latLng(31.104538, 34.8242998),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendConvenienceStore,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(32.094323, 34.7984970),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendLodging,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(30.616876, 34.7959084),
                            zoom: 14,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendToilettes,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(32.097891, 34.8056316),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendInformationCenter,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(30.611540, 34.8035610),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendGuidepost,
                            latlng: L.latLng(30.599868, 34.8085070),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendAreas,
                    id: id++,
                    items: [
                        {
                            title: $scope.resources.legendCitySettelment,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(30.490800, 35.1667000),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendOrchard,
                            latlng: L.latLng(30.966883, 34.7150803),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendCrop,
                            latlng: L.latLng(31.289700, 34.5855000),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendWoods,
                            latlng: L.latLng(31.111483, 34.8333120),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendGrass,
                            latlng: L.latLng(32.112612, 34.91582358),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendScrub,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_MTB_MAP 
                            latlng: L.latLng(32.485095, 34.8953676),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendSand,
                            latlng: L.latLng(31.161293, 34.7459793),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendWetland,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(32.410690, 34.9005125),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendCemetary,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(32.831568, 35.7989717),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendQuarry,
                            latlng: L.latLng(31.232942, 35.2049447),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendConstructionSite,
                            // remove: IsraelHiking.Services.Layers.LayersService.ISRAEL_HIKING_MAP 
                            latlng: L.latLng(32.034755, 34.7461963),
                            zoom: 16,
                            id: id++,
                            map: null,
                            type: "POI"
                        }
                    ]
                }
            ];
            // End Of Legend content definition //

            if (this.layersService.selectedBaseLayer.key === Services.Layers.LayersService.ISRAEL_MTB_MAP) {
                _.remove($scope.legendSections, sectionToRemove => sectionToRemove.title === $scope.resources.legendRegionalTrails);
                _.remove($scope.legendSections, sectionToRemove => sectionToRemove.title === $scope.resources.legendMarkedTrails);
            } else if (this.layersService.selectedBaseLayer.key === Services.Layers.LayersService.ISRAEL_HIKING_MAP) {
                _.remove($scope.legendSections, sectionToRemove => sectionToRemove.title === $scope.resources.legendSingles);
                _.remove($scope.legendSections, sectionToRemove => sectionToRemove.title === $scope.resources.legendBicycleTrails);
            } else {
                _.remove($scope.legendSections, sectionToRemove => sectionToRemove.title === $scope.resources.legendRegionalTrails);
                _.remove($scope.legendSections, sectionToRemove => sectionToRemove.title === $scope.resources.legendMarkedTrails);
                _.remove($scope.legendSections, sectionToRemove => sectionToRemove.title === $scope.resources.legendSingles);
                _.remove($scope.legendSections, sectionToRemove => sectionToRemove.title === $scope.resources.legendBicycleTrails);
            }
            for (let visibleSectionId in $scope.visibleSections) {
                if ($scope.visibleSections.hasOwnProperty(visibleSectionId) && $scope.visibleSections[visibleSectionId]) {
                    let section = _.find($scope.legendSections, sectionToFind => sectionToFind.id.toString() === visibleSectionId);
                    for (let item of section.items) {
                        this.initializeItemMap(item);
                    }
                }
            }
        }
    }

}  
  
