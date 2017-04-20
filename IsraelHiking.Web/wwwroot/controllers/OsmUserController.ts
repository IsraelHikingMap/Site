namespace IsraelHiking.Controllers {

    interface IRank {
        name: string;
        points: number;
    }

    type OsmUserModalTab = "shares" | "traces";

    export interface IOsmUserModalState {
        selectedTab: OsmUserModalTab;
        searchTerm: string;
        scrollPosition: number;
    }

    export interface IOsmUserScope extends IRootScope {
        ranks: IRank[];
        state: IOsmUserModalState;
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
        setSelectedTab(tab: OsmUserModalTab): void;
        setSearchTerm(searchTerm: string): void;
        uploadToOsm(file: File): void;
    }

    export class OsmUserController extends BaseMapController {
        private static OSM_USER_MODAL_CACHE_KEY = "OsmUserModalCache";
        private static OSM_USER_MODAL_STATE_KEY = "OsmUserModalState";

        private $compile: angular.ICompileService;
        private modalInstnace: angular.ui.bootstrap.IModalServiceInstance;
        private osmTraceLayer: L.LayerGroup;
        private fitBoundsService: Services.FitBoundService;

        constructor($scope: IOsmUserScope,
            $window: angular.IWindowService,
            $uibModal: angular.ui.bootstrap.IModalService,
            $compile: angular.ICompileService,
            $cacheFactory: angular.ICacheFactoryService,
            Upload: angular.angularFileUpload.IUploadService,
            mapService: Services.MapService,
            osmUserService: Services.OsmUserService,
            fileService: Services.FileService,
            layersService: Services.Layers.LayersService,
            fitBoundsService: Services.FitBoundService,
            toastr: Toastr) {
            super(mapService);

            this.$compile = $compile;
            this.fitBoundsService = fitBoundsService;
            this.initializeRanks($scope);
            this.osmTraceLayer = L.layerGroup([]);
            this.map.addLayer(this.osmTraceLayer);

            let defaultState = {
                selectedTab: "traces",
                scrollPosition: 0,
                searchTerm: ""
            } as IOsmUserModalState;
            let cache = $cacheFactory.get(OsmUserController.OSM_USER_MODAL_CACHE_KEY) || $cacheFactory(OsmUserController.OSM_USER_MODAL_CACHE_KEY);
            $scope.state = cache.get(OsmUserController.OSM_USER_MODAL_STATE_KEY) as IOsmUserModalState || defaultState;
            cache.put(OsmUserController.OSM_USER_MODAL_STATE_KEY, $scope.state);

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
                $scope.state = cache.get(OsmUserController.OSM_USER_MODAL_STATE_KEY) as IOsmUserModalState;
                    
                this.modalInstnace = $uibModal.open({
                    scope: $scope,
                    templateUrl: "controllers/osmUserDetailsModal.html"
                });

                this.modalInstnace.opened.then(() => {
                    let modalElement = angular.element(".modal");
                    modalElement.delay(700)
                        .animate({
                                scrollTop: $scope.state.scrollPosition
                            },
                            "slow");
                    modalElement.on("scroll", () => {
                        $scope.state.scrollPosition = modalElement.scrollTop();
                        cache.put(OsmUserController.OSM_USER_MODAL_STATE_KEY, $scope.state);
                    });
                    
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

            $scope.showTrace = (trace: Services.ITrace): angular.IHttpPromise<Common.DataContainer> => {
                this.modalInstnace.close();
                let promise = fileService.openFromUrl(trace.dataUrl);
                promise.then((resposnse) => {
                    this.osmTraceLayer.clearLayers();
                    for (let route of resposnse.data.routes) {
                        for (let segment of route.segments) {
                            let polyLine = L.polyline(segment.latlngzs, this.getPathOprtions());
                            this.osmTraceLayer.addLayer(polyLine);
                        }
                        for (let markerData of route.markers) {
                            let icon = Services.IconsService.createPoiDefaultMarkerIcon(this.getPathOprtions().color);
                            let marker = L.marker(markerData.latlng, { draggable: false, clickable: false, keyboard: false, riseOnHover: true, icon: icon, opacity: this.getPathOprtions().opacity } as L.MarkerOptions) as Common.IMarkerWithTitle;
                            Services.MapService.setMarkerTitle(marker, markerData.title);
                            this.osmTraceLayer.addLayer(marker);
                        }
                    }
                    let bounds = L.latLngBounds(resposnse.data.southWest, resposnse.data.northEast);
                    let mainMarker = L.marker(bounds.getCenter(), { icon: Services.IconsService.createTraceMarkerIcon(), draggable: false }) as Common.IMarkerWithTitle; // marker to allow remove of this layer.
                    mainMarker.title = trace.fileName;
                    let newScope = $scope.$new() as ISearchResultsMarkerPopupScope;
                    newScope.marker = mainMarker;
                    newScope.remove = () => {
                        this.osmTraceLayer.clearLayers();
                    }
                    newScope.convertToRoute = () => {
                        layersService.setJsonData(resposnse.data);
                        this.osmTraceLayer.clearLayers();
                    }
                    mainMarker.bindPopup($compile("<div search-results-marker-popup></div>")(newScope)[0], { className: "marker-popup" } as L.PopupOptions);
                    this.osmTraceLayer.addLayer(mainMarker);
                    this.fitBoundsService.fitBounds(bounds, { maxZoom: Services.Layers.LayersService.MAX_NATIVE_ZOOM } as L.FitBoundsOptions);
                });
                return promise;
            }

            $scope.editTrace = (trace: Services.ITrace) => {
                this.modalInstnace.close();
                fileService.openFromUrl(trace.dataUrl).then((response) => {
                    layersService.setJsonData(response.data);
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

            $scope.setSelectedTab = (tab: OsmUserModalTab): void => {
                $scope.state.selectedTab = tab;
                cache.put(OsmUserController.OSM_USER_MODAL_STATE_KEY, $scope.state);
            }

            $scope.setSearchTerm = (searchTerm: string): void =>
            {
                $scope.state.searchTerm = searchTerm;
                cache.put(OsmUserController.OSM_USER_MODAL_STATE_KEY, $scope.state);
            }

            $scope.uploadToOsm = (file: File) => {
                if (!file) {
                    return;
                }
                Upload.upload({
                    url: Common.Urls.osmUploadTrace,
                    method: "POST",
                    data: { file: file }
                } as angular.angularFileUpload.IFileUploadConfigFile).then(() => {
                    toastr.success($scope.resources.fileUploadedSuccefullyItWillTakeTime);
                    osmUserService.refreshDetails();
                }, () => {
                    toastr.error($scope.resources.unableToUploadFile);
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

        private addMissingPartsToMap = ($scope: IOsmUserScope, geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>) => {
            var geoJsonLayer = L.geoJSON(geoJson);
            for (let feature of geoJson.features) {
                let lineString = feature.geometry as GeoJSON.LineString;
                let latLngs = Services.Parsers.GeoJsonParser.createLatlngArray(lineString.coordinates);
                let unselectedPathOptions = { color: "red", weight: 3, opacity: 1 } as L.PathOptions;
                let polyline = L.polyline(latLngs, unselectedPathOptions);
                this.osmTraceLayer.addLayer(polyline);
                let marker = L.marker(latLngs[0], { draggable: false, clickable: true, keyboard: false, icon: Services.IconsService.createMissingPartMarkerIcon() } as L.MarkerOptions);
                let newScope = $scope.$new() as MarkerPopup.IMissingPartMarkerPopupScope;
                newScope.marker = marker as Common.IMarkerWithTitle;
                newScope.feature = feature;
                newScope.remove = () => {
                    marker.closePopup();
                    marker.off("popupopen");
                    marker.off("popupclose");
                    polyline.off("click");
                    this.osmTraceLayer.removeLayer(polyline);
                    this.osmTraceLayer.removeLayer(marker);
                };
                marker.bindPopup(this.$compile("<div missing-part-marker-popup></div>")(newScope)[0], { className: "marker-popup" } as L.PopupOptions);
                marker.on("popupopen", () => { polyline.setStyle({ color: "DarkRed", weight: 5, opacity: 1 } as L.PathOptions); });
                marker.on("popupclose", () => { polyline.setStyle(unselectedPathOptions); });
                polyline.on("click", () => { marker.openPopup() });
                this.osmTraceLayer.addLayer(marker);
            }

            this.fitBoundsService.fitBounds(geoJsonLayer.getBounds());
        }
    }

}