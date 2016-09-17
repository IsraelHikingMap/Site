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
        isVisible: boolean;
    }

    export interface IInfoScope extends IRootScope {
        state: InfoState;
        legendSections: ILegendSection[];
        toggleInfo(e: Event): void;
        isActive(): boolean;
        getLegendImage(): string;
        toggleSectionVisibility(legendSection: ILegendSection): void;
    }

    export class InfoController extends BaseMapController {

        constructor($scope: IInfoScope,
            $timeout: angular.ITimeoutService,
            sidebarService: Services.SidebarService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService) {
            super(mapService);

            $scope.state = "legend";

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

            $scope.getLegendImage = () => {
                return layersService.selectedBaseLayer.key === Services.Layers.LayersService.ISRAEL_MTB_MAP ?
                    "/mtbtiles/legend.png" :
                    "/tiles/legend.png";
            }

            $scope.toggleSectionVisibility = (section: ILegendSection) => {
                section.isVisible = !section.isVisible;
                if (!section.isVisible) {
                    return;
                }
                for (let item of section.items) {
                    if (item.map) {
                        continue;
                    }
                    $timeout(() => {
                        item.map = L.map(item.id.toString(),
                            {
                                center: item.latlng,
                                zoom: item.zoom,
                                zoomControl: false,
                                attributionControl: false,
                                dragging: false,
                                scrollWheelZoom: false,
                                doubleClickZoom: false,
                                layers: [L.tileLayer(layersService.selectedBaseLayer.address)]
                            });
                    }, 200);
                }
            };
        }

        private initalizeLegendSections($scope: IInfoScope) {
            let id = 0;
            $scope.legendSections = [
                {
                    title: $scope.resources.legendMarkedTrails,
                    isVisible: false,
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
                            latlng: L.latLng(30.462, 34.654),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendBlackMarkedTrail,
                            latlng: L.latLng(30.358, 35.101),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendIsraelTrail,
                            latlng: L.latLng(31.539, 34.807),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendRegionalTrail,
                            latlng: L.latLng(30.497, 34.642),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                        // Do we really want this
                        //{
                        //    title: "Jerusalen Trail",
                        //    latlng: L.latLng(31.768, 35.230),
                        //    zoom: 15,
                        //    id: id++,
                        //    map: null,
                        //    type: "Way"
                        //}
                    ]
                },
                {
                    title: $scope.resources.legendTrails,
                    isVisible: false,
                    items: [
                        {
                            title: $scope.resources.legendAllVehicles,
                            latlng: L.latLng(30.624, 34.924),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendLight4WDVehicles,
                            latlng: L.latLng(30.588, 34.885),
                            zoom: 15,
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
                            latlng: L.latLng(31.210, 35.291),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendFootPath,
                            latlng: L.latLng(30.536, 34.781),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendBicyclePath,
                            latlng: L.latLng(31.193, 35.307),
                            zoom: 15,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendRoads,
                    isVisible: false,
                    items: [
                        {
                            title: $scope.resources.legendMotorway,
                            latlng: L.latLng(31.918, 34.914),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendTrunkTunnel,
                            latlng: L.latLng(31.649, 34.721),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendPrimary,
                            latlng: L.latLng(31.746, 34.862),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendSecondary,
                            latlng: L.latLng(31.743, 34.721),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        },
                        {
                            title: $scope.resources.legendTeriary,
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
                            latlng: L.latLng(32.597, 35.233),
                            zoom: 13,
                            id: id++,
                            map: null,
                            type: "Way"
                        }
                    ]
                },
                {
                    title: $scope.resources.legendPoi,
                    isVisible: false,
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
                            latlng: L.latLng(30.660, 34.955),
                            zoom: 19,
                            id: id++,
                            map: null,
                            type: "POI"
                        },
                        {
                            title: $scope.resources.legendViewpoint,
                            latlng: L.latLng(30.618, 34.890),
                            zoom: 17,
                            id: id++,
                            map: null,
                            type: "POI"
                        }
                    ]
                }
            ];
        }
    }

}  