module IsraelHiking.Controllers {
    export interface IDrawingScope extends angular.IScope {
        clear(e: Event): void;
        setEditMode(editMode: string, e: Event): void;
        getEditMode(): string;
        toggleRouting(routingType: string, e: Event): void;
        getRoutingType(): string;
        
        undo(e: Event): void;
        isUndoDisbaled(): boolean;
        openStatistics(e: Event): void;
        isStatisticsOpen(): boolean;
    }

    export class DrawingController extends BaseMapControllerWithToolTip {
        private localStorageService: angular.local.storage.ILocalStorageService;
        private layersService: Services.LayersService;
        private routeStatisticsTooltip;
        private static ESCAPE_KEYCODE = 27;

        constructor($scope: IDrawingScope,
            $tooltip,
            $window: angular.IWindowService,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.LayersService) {
            super(mapService, $tooltip);
            this.localStorageService = localStorageService;
            this.layersService = layersService;
            this.routeStatisticsTooltip = null;

            $scope.clear = (e: Event) => {
                this.suppressEvents(e);
                if (this.layersService.getSelectedRoute() == null) {
                    return;
                }
                this.layersService.getSelectedRoute().clear();
            }

            $scope.setEditMode = (editMode: string, e: Event) => {
                this.suppressEvents(e);
                let selectedRoute = this.layersService.getSelectedRoute();
                if (selectedRoute == null) {
                    return;
                }
                if (selectedRoute.getEditMode() === editMode)
                {
                    selectedRoute.readOnly();
                }
                else if (editMode === Services.Layers.RouteLayers.EditMode.ROUTE) {
                    selectedRoute.editRoute();
                }
                else if (editMode === Services.Layers.RouteLayers.EditMode.POI) {
                    selectedRoute.editPoi();
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
                if (this.layersService.getSelectedRoute() == null) {
                    return;
                }
                this.layersService.getSelectedRoute().undo();
                
            };

            $scope.getEditMode = (): string => {
                if (this.layersService.getSelectedRoute() == null) {
                    return Services.Layers.RouteLayers.EditMode.NONE;
                }
                return this.layersService.getSelectedRoute().getEditMode();
            };

            $scope.getRoutingType = (): string => {
                if (this.layersService.getSelectedRoute() == null) {
                    return Common.RoutingType.none;
                }
                return this.layersService.getSelectedRoute().getRouteProperties().currentRoutingType;
            };

            $scope.isUndoDisbaled = (): boolean => {
                if (this.layersService.getSelectedRoute() == null) {
                    return true;
                }
                return this.layersService.getSelectedRoute().isUndoDisbaled();
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
                    this.layersService.getSelectedRoute().undo();
                } else if (e.keyCode === DrawingController.ESCAPE_KEYCODE) {
                    this.layersService.getSelectedRoute().readOnly();
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