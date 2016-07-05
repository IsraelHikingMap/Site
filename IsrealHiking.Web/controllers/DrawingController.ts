module IsraelHiking.Controllers {
    export interface IDrawingScope extends angular.IScope {
        clear(e: Event): void;
        toggleDrawing(e: Event): void;
        toggleRouting(routingType: string, e: Event): void;
        undo(e: Event): void;
        isDrawingEnabled(): boolean;
        getRoutingType(): string;
        isUndoDisbaled(): boolean;
        showRouting(): boolean;
        openStatistics(e: Event): void;
        isStatisticsOpen(): boolean;
    }

    export class DrawingController extends BaseMapControllerWithToolTip {
        private layersService: Services.LayersService;
        private selectedDrawing: Services.Drawing.IDrawing;
        private routeStatisticsTooltip;

        constructor($scope: IDrawingScope,
            $tooltip,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            snappingService:  Services.SnappingService) {
            super(mapService, $tooltip);
            this.layersService = layersService;
            this.selectedDrawing = this.layersService.getSelectedDrawing();
            this.routeStatisticsTooltip = null;

            this.layersService.eventHelper.addListener(() => {
                this.selectedDrawing = this.layersService.getSelectedDrawing();
                snappingService.enable(this.selectedDrawing.isEnabled());
            });

            $scope.clear = (e: Event) => {
                this.selectedDrawing.clear();
                this.suppressEvents(e);
            }

            $scope.toggleDrawing = (e: Event) => {
                if (this.selectedDrawing.isEnabled()) {
                    this.selectedDrawing.enable(false);
                }
                else {
                    this.selectedDrawing.enable(true);
                }
                this.suppressEvents(e);
            };

            $scope.toggleRouting = (routingType: string, e: Event) => {
                if (this.selectedDrawing.getRoutingType() === routingType) {
                    this.selectedDrawing.setRoutingType(Common.RoutingType.none);
                } else {
                    this.selectedDrawing.setRoutingType(routingType);
                }
                this.suppressEvents(e);
            };

            $scope.undo = (e: Event) => {
                this.selectedDrawing.undo();
                this.suppressEvents(e);
            };

            $scope.isDrawingEnabled = (): boolean => {
                if (this.selectedDrawing == null) {
                    return false;
                }
                return this.selectedDrawing.isEnabled();
            };

            $scope.getRoutingType = (): string => {
                if (this.selectedDrawing == null) {
                    return Common.RoutingType.hike;
                }
                return this.selectedDrawing.getRoutingType();
            };

            $scope.isUndoDisbaled = (): boolean => {
                if (this.selectedDrawing == null) {
                    return false;
                }
                return this.selectedDrawing.isUndoDisbaled();
            };

            $scope.showRouting = (): boolean => {
                if (this.selectedDrawing == null) {
                    return false;
                }
                return this.selectedDrawing.name !== Common.Constants.MARKERS;
            }

            $scope.openStatistics = (e: Event) => {
                if (this.routeStatisticsTooltip == null) {
                    var newScope = <IRouteStatisticsScope>$scope.$new();
                    var controller = new RouteStatisticsController(newScope, this.layersService, mapService); // updates the new scope
                    
                    this.routeStatisticsTooltip = this.createToolTip(e.target, "controllers/routeStatisticsTooltip.html", "Route Statistics", newScope);
                    this.routeStatisticsTooltip.$promise.then(this.routeStatisticsTooltip.show);
                }
                this.suppressEvents(e);
            }

            $scope.isStatisticsOpen = () => {
                return this.routeStatisticsTooltip != null && this.routeStatisticsTooltip.$isShown;
            }

            document.onkeydown = (e: KeyboardEvent) => {
                if (e.keyCode === 90 && e.ctrlKey) { // ctrl+Z
                    this.selectedDrawing.undo();
                }
                else if (e.keyCode === 27) { // escape
                    this.selectedDrawing.enable(false);
                }
                else {
                    return;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            };
        }
    }
}