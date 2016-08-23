namespace IsraelHiking.Controllers {
    export interface IDrawingScope extends angular.IScope {
        
        clear(e: Event): void;
        setEditMode(editMode: string, e: Event): void;
        editMode: Services.Layers.EditMode;
        setRouting(routingType: Common.RoutingType, e: Event): void;
        getRoutingType(): Common.RoutingType;
        undo(e: Event): void;
        isUndoDisbaled(): boolean;
        toggleStatistics(): void;
        isStatisticsOpen(): boolean;
    }

    export class DrawingController extends BaseMapController {
        private localStorageService: angular.local.storage.ILocalStorageService;
        private layersService: Services.Layers.LayersService;
        private routeStatisticsService: Services.RouteStatisticsService;
        private static ESCAPE_KEYCODE = 27;

        constructor($scope: IDrawingScope,
            $window: angular.IWindowService,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            routeStatisticsService: Services.RouteStatisticsService) {
            super(mapService);
            this.localStorageService = localStorageService;
            this.layersService = layersService;
            this.routeStatisticsService = routeStatisticsService;

            $scope.editMode = Services.Layers.EditModeString.none;

            this.layersService.routeChangedEvent.addListener(() => {
                if ($scope.editMode === Services.Layers.EditModeString.route) {
                    $scope.editMode = (this.layersService.getSelectedRoute() != null) ? this.layersService.getSelectedRoute().getEditMode() : Services.Layers.EditModeString.none;
                }
            });

            $scope.toggleStatistics = () => {
                this.routeStatisticsService.toggle();
            }

            $scope.isStatisticsOpen = () => {
                return this.routeStatisticsService.isVisible;
            }

            $scope.clear = (e: Event) => {
                this.suppressEvents(e);
                let layer = this.getDrawingLayer($scope);
                if (layer != null) {
                    layer.clear();
                }
            }

            $scope.setEditMode = (editMode: Services.Layers.EditMode, e: Event) => {
                this.suppressEvents(e);
                let selectedRoute = this.layersService.getSelectedRoute();
                let markers = this.layersService.markers;
                if ($scope.editMode === editMode) {
                    if (selectedRoute != null) {
                        selectedRoute.readOnly();
                    }
                    markers.readOnly();
                    $scope.editMode = Services.Layers.EditModeString.none;
                    return;
                }

                switch (editMode) {
                    case Services.Layers.EditModeString.poi:
                        if (selectedRoute != null) {
                            selectedRoute.readOnly();
                        }
                        markers.edit();
                        $scope.editMode = editMode;
                        return;
                    case Services.Layers.EditModeString.route:
                        markers.readOnly();
                        if (selectedRoute != null) {
                            selectedRoute.editRoute();
                            $scope.editMode = editMode;
                        }
                        return;
                }
            };

            $scope.setRouting = (routingType: Common.RoutingType, e: Event) => {
                this.suppressEvents(e);
                if (this.layersService.getSelectedRoute() == null) {
                    return;
                }
                this.localStorageService.set(Services.Layers.RouteLayers.RouteLayerFactory.ROUTING_TYPE, routingType);
                this.layersService.getSelectedRoute().setRoutingType(routingType);
            };

            $scope.undo = (e: Event) => {
                this.suppressEvents(e);
                let layer = this.getDrawingLayer($scope);
                if (layer != null) {
                    layer.undo();
                }
            };

            $scope.getRoutingType = (): Common.RoutingType => {
                if (this.layersService.getSelectedRoute() == null) {
                    return "None";
                }
                return this.layersService.getSelectedRoute().getRouteProperties().currentRoutingType;
            };

            $scope.isUndoDisbaled = (): boolean => {
                let layer = this.getDrawingLayer($scope);
                return layer != null ? layer.isUndoDisbaled() : true;
            };


            angular.element($window).bind("keydown", (e: JQueryEventObject) => {
                if (this.layersService.getSelectedRoute() == null) {
                    return;
                }
                if (e.ctrlKey && String.fromCharCode(e.which).toLowerCase() === "z") {
                    $scope.undo(e);
                } else if (e.keyCode === DrawingController.ESCAPE_KEYCODE) {
                    let layer = this.getDrawingLayer($scope);
                    if (layer != null) {
                        layer.readOnly();
                    }
                    $scope.editMode = Services.Layers.EditModeString.none;
                } else {
                    return;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            });
        }

        private getDrawingLayer($scope: IDrawingScope): Services.Layers.IDrawingLayer {
            if ($scope.editMode === Services.Layers.EditModeString.route && this.layersService.getSelectedRoute() != null) {
                return this.layersService.getSelectedRoute();
            }
            if ($scope.editMode === Services.Layers.EditModeString.poi) {
                return this.layersService.markers;
            }
            return null;
        }
    }
}