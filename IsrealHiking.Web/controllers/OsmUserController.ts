namespace IsraelHiking.Controllers {

    interface IRank {
        name: string;
        points: number;
    }

    type OsmUserState = "shares" | "traces";

    export interface IOsmUserScope extends IRootScope {
        ranks: IRank[];
        state: OsmUserState;
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
        open(file: File): void;
        setState(state: OsmUserState): void;
    }

    export class OsmUserController extends BaseMapController {
        private static OSM_USER_STATE_KEY = "OsmUserState";

        private $compile: angular.ICompileService;
        private modalInstnace: angular.ui.bootstrap.IModalServiceInstance;
        private osmTraceLayer: L.LayerGroup<any>;

        constructor($scope: IOsmUserScope,
            $window: angular.IWindowService,
            $uibModal: angular.ui.bootstrap.IModalService,
            $compile: angular.ICompileService,
            Upload: angular.angularFileUpload.IUploadService,
            mapService: Services.MapService,
            osmUserService: Services.OsmUserService,
            fileService: Services.FileService,
            layersService: Services.Layers.LayersService,
            localStorageService: angular.local.storage.ILocalStorageService,
            toastr: Toastr) {
            super(mapService);

            this.$compile = $compile;
            this.initializeRanks($scope);
            this.osmTraceLayer = L.layerGroup([]);
            this.map.addLayer(this.osmTraceLayer);

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
                $scope.state = localStorageService.get(OsmUserController.OSM_USER_STATE_KEY) as OsmUserState || "traces";
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
                    this.osmTraceLayer.clearLayers();
                    for (let route of dataContainer.routes) {
                        for (let segment of route.segments) {
                            let polyLine = L.polyline(segment.latlngzs, this.getPathOprtions());
                            this.osmTraceLayer.addLayer(polyLine);
                        }
                        for (let markerData of route.markers) {
                            let marker = L.marker(markerData.latlng, { draggable: false, clickable: false, riseOnHover: true, icon: Services.IconsService.createMarkerIconWithColor(this.getPathOprtions().color), opacity: this.getPathOprtions().opacity } as L.MarkerOptions);
                            marker.bindLabel(markerData.title, { noHide: true, className: "marker-label" } as L.LabelOptions);
                            this.osmTraceLayer.addLayer(marker);
                        }
                    }
                    let bounds = L.latLngBounds(dataContainer.southWest, dataContainer.northEast);
                    let mainMarker = L.marker(bounds.getCenter(), { icon: Services.IconsService.createTraceMarkerIcon(), draggable: false }) as Services.Layers.RouteLayers.IMarkerWithTitle; // marker to allow remove of this layer.
                    mainMarker.title = trace.fileName;
                    let newScope = $scope.$new() as ISearchResultsMarkerPopupScope;
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

            $scope.open = (file: File): void => {
                Upload.upload({
                    url: Common.Urls.osm,
                    params: {
                        url: ""
                    } as any,
                    method: "POST",
                    data: { file: file }
                } as angular.angularFileUpload.IFileUploadConfigFile).then((response: { data: GeoJSON.FeatureCollection<GeoJSON.LineString> }) => {
                    let geoJson = response.data;
                    if (geoJson.features.length === 0) {
                        toastr.success($scope.resources.noUnmappedRoutes);
                        return;
                    }
                    this.modalInstnace.close();
                    this.addMissingPartsToMap($scope, geoJson);
                });
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
                            this.addMissingPartsToMap($scope, geoJson);
                        });
                    });
            }

            $scope.setState = (state: OsmUserState): void => {
                localStorageService.set(OsmUserController.OSM_USER_STATE_KEY, state);
                $scope.state = state;
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

        private addMissingPartsToMap = ($scope: IOsmUserScope, geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>) => {
            var geoJsonLayer = L.geoJson(geoJson);
            for (let feature of geoJson.features) {
                let lineString = feature.geometry as GeoJSON.LineString;
                let latLngs = Services.Parsers.GeoJsonParser.createLatlngArray(lineString.coordinates);
                let polyline = L.polyline(latLngs, { color: "red", weight: 5, opacity: 1 } as L.PolylineOptions);
                this.osmTraceLayer.addLayer(polyline);
                let marker = L.marker(latLngs[0], { draggable: false, clickable: true, icon: Services.IconsService.createMissingPartMarkerIcon() } as L.MarkerOptions);
                let newScope = $scope.$new() as MarkerPopup.IMissingPartMarkerPopupScope;
                newScope.marker = marker as Services.Layers.RouteLayers.IMarkerWithTitle;
                newScope.feature = feature;
                newScope.remove = () => {
                    marker.closePopup();
                    this.osmTraceLayer.removeLayer(polyline);
                    this.osmTraceLayer.removeLayer(marker);
                };
                marker.bindPopup(this.$compile("<div missing-part-marker-popup></div>")(newScope)[0], { className: "marker-popup" } as L.PopupOptions);
                this.osmTraceLayer.addLayer(marker);
            }

            this.map.fitBounds(geoJsonLayer.getBounds());
        }
    }

}