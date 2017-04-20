namespace IsraelHiking.Controllers {
    export interface IDrawingScope extends angular.IScope {

        clear(e: Event): void;
        setEditMode(editMode: string, e: Event): void;
        editMode: Services.Layers.EditMode;
        setRouting(routingType: Common.RoutingType, e: Event): void;
        getRoutingType(): Common.RoutingType;
        undo(e: Event): void;
        isUndoDisbaled(): boolean;
        getRouteColor(editMode: Services.Layers.EditMode): string;
    }

    export class DrawingController extends BaseMapController {
        private localStorageService: angular.local.storage.ILocalStorageService;
        private layersService: Services.Layers.LayersService;
        private static ESCAPE_KEYCODE = 27;

        constructor($scope: IDrawingScope,
            $window: angular.IWindowService,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService) {
            super(mapService);
            this.localStorageService = localStorageService;
            this.layersService = layersService;

            $scope.editMode = Services.Layers.EditModeString.none;

            this.layersService.routeChangedEvent.addListener(() => {
                if ($scope.editMode === Services.Layers.EditModeString.route) {
                    $scope.editMode = (this.layersService.getSelectedRoute() != null) ? this.layersService.getSelectedRoute().getEditMode() : Services.Layers.EditModeString.none;
                }
            });

            $scope.clear = (e: Event) => {
                this.suppressEvents(e);
                let layer = this.layersService.getSelectedRoute();
                if (layer != null) {
                    layer.clear();
                }
            }

            $scope.setEditMode = (editMode: Services.Layers.EditMode, e: Event) => {
                this.suppressEvents(e);
                let selectedRoute = this.layersService.getSelectedRoute();
                if ($scope.editMode === editMode) {
                    if (selectedRoute != null) {
                        selectedRoute.readOnly();
                    }
                    $scope.editMode = Services.Layers.EditModeString.none;
                    return;
                }

                switch (editMode) {
                    case Services.Layers.EditModeString.poi:
                        if (selectedRoute != null) {
                            selectedRoute.editPoi();
                            $scope.editMode = editMode;
                        }
                        return;
                    case Services.Layers.EditModeString.route:
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
                let layer = this.layersService.getSelectedRoute();
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
                let layer = this.layersService.getSelectedRoute();
                return layer != null ? layer.isUndoDisbaled() : true;
            };

            $scope.getRouteColor = (editMode: Services.Layers.EditMode): string => {
                if (this.layersService.getSelectedRoute() == null) {
                    return "black";
                }
                if ($scope.editMode != editMode) {
                    return "black";
                }
                return this.layersService.getSelectedRoute().route.properties.pathOptions.color;
            }

            angular.element($window).bind("keydown", (e: JQueryEventObject) => {
                if (this.layersService.getSelectedRoute() == null) {
                    return;
                }
                if (e.ctrlKey && String.fromCharCode(e.which).toLowerCase() === "z") {
                    $scope.undo(e);
                } else if (e.keyCode === DrawingController.ESCAPE_KEYCODE) {
                    let layer = this.layersService.getSelectedRoute();
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
    }
}