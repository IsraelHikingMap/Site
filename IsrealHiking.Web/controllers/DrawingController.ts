namespace IsraelHiking.Controllers {
    export interface IDrawingScope extends angular.IScope {
        clear(e: Event): void;
        setEditMode(editMode: string, e: Event): void;
        editMode: string;
        toggleRouting(routingType: string, e: Event): void;
        getRoutingType(): string;

        undo(e: Event): void;
        isUndoDisbaled(): boolean;
        openStatistics(e: Event): void;
        isStatisticsOpen(): boolean;
    }

    export class DrawingController extends BaseMapControllerWithToolTip {
        private localStorageService: angular.local.storage.ILocalStorageService;
        private layersService: Services.Layers.LayersService;
        private routeStatisticsTooltip;
        private static ESCAPE_KEYCODE = 27;

        constructor($scope: IDrawingScope,
            $tooltip,
            $window: angular.IWindowService,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService) {
            super(mapService, $tooltip);
            this.localStorageService = localStorageService;
            this.layersService = layersService;
            this.routeStatisticsTooltip = null;

            $scope.editMode = Services.Layers.RouteLayers.EditMode.NONE;

            $scope.clear = (e: Event) => {
                this.suppressEvents(e);
                if ($scope.editMode === Services.Layers.RouteLayers.EditMode.ROUTE && this.layersService.getSelectedRoute() != null) {
                    this.layersService.getSelectedRoute().clear();
                }
                if ($scope.editMode === Services.Layers.RouteLayers.EditMode.POI) {
                    this.layersService.markers.clear();
                }
            }

            $scope.setEditMode = (editMode: string, e: Event) => {
                this.suppressEvents(e);
                let selectedRoute = this.layersService.getSelectedRoute();
                let markers = this.layersService.markers;
                if ($scope.editMode === editMode) {
                    if (selectedRoute != null) {
                        selectedRoute.readOnly();
                    }
                    markers.readOnly();
                    $scope.editMode = Services.Layers.RouteLayers.EditMode.NONE;
                    return;
                }

                if (editMode === Services.Layers.RouteLayers.EditMode.POI) {
                    if (selectedRoute != null) {
                        selectedRoute.readOnly();
                    }
                    markers.edit();
                    $scope.editMode = editMode;
                    return;
                }
                if (editMode === Services.Layers.RouteLayers.EditMode.ROUTE) {
                    markers.readOnly();
                    if (selectedRoute != null) {
                        selectedRoute.editRoute();
                        $scope.editMode = editMode;
                    }
                }
            };

            $scope.toggleRouting = (routingType: string, e: Event) => {
                this.suppressEvents(e);
                if (this.layersService.getSelectedRoute() == null) {
                    return;
                }
                this.localStorageService.set(Services.Layers.RouteLayers.RouteLayerFactory.ROUTING_TYPE, routingType);
                this.layersService.getSelectedRoute().setRoutingType(routingType);
            };

            $scope.undo = (e: Event) => {
                this.suppressEvents(e);
                if ($scope.editMode === Services.Layers.RouteLayers.EditMode.ROUTE && this.layersService.getSelectedRoute() != null) {
                    this.layersService.getSelectedRoute().undo();
                }
                if ($scope.editMode === Services.Layers.RouteLayers.EditMode.POI) {
                    this.layersService.markers.undo();
                }
            };

            $scope.getRoutingType = (): string => {
                if (this.layersService.getSelectedRoute() == null) {
                    return Common.RoutingType.none;
                }
                return this.layersService.getSelectedRoute().getRouteProperties().currentRoutingType;
            };

            $scope.isUndoDisbaled = (): boolean => {
                if ($scope.editMode === Services.Layers.RouteLayers.EditMode.ROUTE && this.layersService.getSelectedRoute() != null) {
                    return this.layersService.getSelectedRoute().isUndoDisbaled();
                }
                if ($scope.editMode === Services.Layers.RouteLayers.EditMode.POI) {
                    return this.layersService.markers.isUndoDisbaled();
                }
                return true;
            };

            $scope.openStatistics = (e: Event) => {
                this.suppressEvents(e);
                if (this.routeStatisticsTooltip != null || this.layersService.getSelectedRoute() == null) {
                    return;
                }
                var newScope = $scope.$new() as IRouteStatisticsScope;
                var controller = new RouteStatisticsController(newScope, this.layersService, mapService); // updates the new scope

                this.routeStatisticsTooltip = this.createToolTip(e.target, "controllers/routeStatisticsTooltip.html", "Route Statistics", newScope);
                this.routeStatisticsTooltip.$promise.then(this.routeStatisticsTooltip.show);
            }

            $scope.isStatisticsOpen = () => {
                return this.routeStatisticsTooltip != null && this.routeStatisticsTooltip.$isShown;
            }

            angular.element($window).bind("keydown", (e: JQueryEventObject) => {
                if (this.layersService.getSelectedRoute() == null) {
                    return;
                }
                if (e.ctrlKey && String.fromCharCode(e.which).toLowerCase() === "z") {
                    $scope.undo(e);
                } else if (e.keyCode === DrawingController.ESCAPE_KEYCODE) {
                    if ($scope.editMode === Services.Layers.RouteLayers.EditMode.ROUTE && this.layersService.getSelectedRoute() != null) {
                        this.layersService.getSelectedRoute().readOnly();;
                    }
                    else if ($scope.editMode === Services.Layers.RouteLayers.EditMode.POI) {
                        this.layersService.markers.readOnly();
                    }
                    $scope.editMode = Services.Layers.RouteLayers.EditMode.NONE;
                } else {
                    return;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            });
        }
    }
}