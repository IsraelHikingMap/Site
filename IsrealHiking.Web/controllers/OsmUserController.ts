namespace IsraelHiking.Controllers {

    interface IRank {
        name: string;
        points: number;
    }

    export interface IOsmUserScope extends IRootScope {
        ranks: IRank[];
        userService: Services.OsmUserService;
        login(e: Event);
        openUserDetails(e: Event);
        getRank(): IRank;
        getRankPercentage(): number;
        getPorgessbarType(): string;
        showTrace(trace: Services.ITrace): angular.IPromise<{}>;
        editTrace(trace: Services.ITrace): void;
        findUnmappedRoutes(trace: Services.ITrace): void;
        editInOsm(trace: Services.ITrace): void;
    }

    export class OsmUserController extends BaseMapController {
        private modalInstnace: angular.ui.bootstrap.IModalServiceInstance;
        private osmTraceLayer: L.LayerGroup<any>;

        constructor($scope: IOsmUserScope,
            $window: angular.IWindowService,
            $uibModal: angular.ui.bootstrap.IModalService,
            $compile: angular.ICompileService,
            mapService: Services.MapService,
            osmUserService: Services.OsmUserService,
            fileService: Services.FileService,
            layersService: Services.Layers.LayersService,
            toastr: Toastr) {
            super(mapService);

            this.initializeRanks($scope);
            this.osmTraceLayer = L.layerGroup([]);

            $scope.userService = osmUserService;
            $scope.$watch(() => $scope.resources.language, () => this.initializeRanks($scope));

            $scope.login = (e: Event) => {
                this.suppressEvents(e);
                osmUserService.login().then(() => {
                    // osm login creates a new page and therefore the scope get out of sync.
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                }, () => {
                    toastr.warning($scope.resources.unableToLogin);
                });
            }

            $scope.openUserDetails = (e: Event) => {
                this.suppressEvents(e);
                osmUserService.refreshDetails();
                this.modalInstnace = $uibModal.open({
                    scope: $scope,
                    templateUrl: "controllers/osmUserDetailsModal.html"
                });
            }

            $scope.getRank = () => {
                let rankIndex = 0;
                while (osmUserService.changeSets > $scope.ranks[rankIndex].points) {
                    rankIndex++;
                }
                return $scope.ranks[rankIndex];
            }

            $scope.getRankPercentage = () => {
                let rank = $scope.getRank();
                if (rank === $scope.ranks[$scope.ranks.length - 1]) {
                    return 100;
                }
                return ((osmUserService.changeSets / rank.points) * 100);
            }

            $scope.getPorgessbarType = () => {
                if ($scope.getRankPercentage() < 5) {
                    return "danger";
                }
                if ($scope.getRankPercentage() < 30) {
                    return "warning";
                }
                return "success";
            }

            $scope.showTrace = (trace: Services.ITrace): angular.IPromise<{}> => {
                this.modalInstnace.close();
                return fileService.openFromUrl(trace.dataUrl).success((dataContainer) => {
                    this.osmTraceLayer = L.featureGroup([]);
                    for (let route of dataContainer.routes) {
                        for (let segment of route.segments) {
                            let polyLine = L.polyline(segment.latlngzs, this.getPathOprtions());
                            this.osmTraceLayer.addLayer(polyLine);
                        }
                    }
                    for (let markerData of dataContainer.markers) {
                        let marker = L.marker(markerData.latlng, { draggable: false, clickable: false, riseOnHover: true, icon: Services.IconsService.createMarkerIconWithColor(this.getPathOprtions().color), opacity: this.getPathOprtions().opacity } as L.MarkerOptions);
                        marker.bindLabel(markerData.title, { noHide: true, className: "marker-label" } as L.LabelOptions);
                        this.osmTraceLayer.addLayer(marker);
                    }
                    let bounds = L.latLngBounds(dataContainer.southWest, dataContainer.northEast);
                    let mainMarker = L.marker(bounds.getCenter(), { icon: Services.IconsService.createTraceMarkerIcon(), draggable: false }) as Services.Layers.PoiLayers.IMarkerWithTitle; // marker to allow remove of this layer.
                    mainMarker.title = trace.fileName;
                    let newScope = $scope.$new() as ISearchResultsMarkerPopup;
                    newScope.marker = mainMarker;
                    newScope.remove = () => {
                        this.osmTraceLayer.clearLayers();
                    }
                    newScope.convertToRoute = () => {
                        layersService.setJsonData(dataContainer);
                        this.osmTraceLayer.clearLayers();
                    }
                    mainMarker.bindPopup($compile("<div search-results-marker-popup></div>")(newScope)[0], { className: "marker-popup" } as L.PopupOptions);
                    this.osmTraceLayer.addLayer(mainMarker);
                    this.map.addLayer(this.osmTraceLayer);
                    this.map.fitBounds(bounds, { maxZoom: Services.Layers.LayersService.MAX_NATIVE_ZOOM } as L.Map.FitBoundsOptions);
                });
            }

            $scope.editTrace = (trace: Services.ITrace) => {
                this.modalInstnace.close();
                fileService.openFromUrl(trace.dataUrl).success((dataContainer) => {
                    layersService.setJsonData(dataContainer);
                });
            }

            $scope.editInOsm = (trace: Services.ITrace) => {
                let baseLayerAddress = layersService.selectedBaseLayer.address;
                $window.open(osmUserService.getEditOsmGpxAddress(baseLayerAddress, trace.id));
            }

            $scope.findUnmappedRoutes = (trace: Services.ITrace): void => {
                osmUserService.getMissingParts(trace)
                    .then((response: { data: GeoJSON.FeatureCollection<GeoJSON.LineString> }) => {
                        let geoJson = response.data;
                        if (geoJson.features.length === 0) {
                            toastr.success($scope.resources.noUnmappedRoutes);
                            return;
                        }
                        $scope.showTrace(trace).then(() => {
                            var geoJsonLayer = L.geoJson(geoJson, {
                                onEachFeature: (feature: GeoJSON.Feature<GeoJSON.GeometryObject>) => {
                                    this.osmTraceLayer.addLayer(L.marker(feature.geometry.coordinates[0]));
                                }, style: {
                                    color: "red",
                                    weight: 5,
                                    opacity: 1
                                } as any
                            } as L.GeoJSONOptions);
                            this.osmTraceLayer.addLayer(geoJsonLayer);
                            // HM TODO: make this better
                            this.map.fitBounds(geoJsonLayer.getBounds());
                        });
                    });
            }
        }

        private getPathOprtions = (): L.PathOptions => {
            return { opacity: 0.5, color: "blue", weight: 3 } as L.PathOptions;
        }

        private initializeRanks = ($scope: IOsmUserScope) => {
            $scope.ranks = [
                {
                    name: $scope.resources.junior,
                    points: 10
                },
                {
                    name: $scope.resources.partner,
                    points: 100
                },
                {
                    name: $scope.resources.master,
                    points: 1000
                },
                {
                    name: $scope.resources.guru,
                    points: Infinity
                }
            ];
        }
    }

}