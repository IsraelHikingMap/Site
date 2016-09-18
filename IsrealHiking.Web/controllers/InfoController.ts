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
                            title: $scope.resources.legendRailway,
                            latlng: L.latLng(32.627, 35.267),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendRunwayTaxiway,
                            latlng: L.latLng(32.5960, 35.2300),
                            zoom: 13,
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
                }
            ];

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
