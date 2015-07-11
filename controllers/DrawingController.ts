module IsraelHiking.Controllers {
    export interface IDrawingScope extends angular.IScope {
        toggleRoute(e: Event): void;
        toggleRouting(e: Event): void;
        toggleMarkers(e: Event): void;
        undo(e: Event): void;
        clear(e: Event): void;
        isRouteEnabled(): boolean;
        isRoutingEnabled(): boolean;
        isMarkersEnabled(): boolean;
        isUndoDisbaled(): boolean;
    }

    export class DrawingController extends BaseMapController {
        private dataStack: Function[];
        private drawingRouteService: Services.DrawingRouteService;
        private drawingMarkerService: Services.DrawingMarkerService;
        private ignoreDataChanged: boolean;

        constructor($scope: IDrawingScope,
            mapService: Services.MapService,
            drawingRouteService: Services.DrawingRouteService,
            drawingMarkerService: Services.DrawingMarkerService) {
            super(mapService);
            this.drawingRouteService = drawingRouteService;
            this.drawingMarkerService = drawingMarkerService;
            this.dataStack = [];
            this.addCurrentData();
            this.ignoreDataChanged = false;

            this.drawingRouteService.eventHelper.addListener((args: Services.IDataChangedEventArgs) => {
                this.addCurrentData();
                this.updateScope($scope, args.applyToScope);
            });
            this.drawingMarkerService.eventHelper.addListener((args: Services.IDataChangedEventArgs) => {
                this.addCurrentData();
                this.updateScope($scope, args.applyToScope);
            });

            $scope.toggleRoute = (e: Event) => {
                if (this.drawingRouteService.isEnabled()) {
                    this.drawingRouteService.enable(false);
                    this.setDragMapCursor();
                }
                else {
                    this.drawingRouteService.enable(true);
                    this.drawingMarkerService.enable(false);
                    this.setDrawingCursor();
                }
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
            };

            $scope.toggleRouting = (e: Event) => {
                if (this.drawingRouteService.isRoutingEnabled()) {
                    this.drawingRouteService.changeRoutingType(Common.routingType.none);
                } else {
                    this.drawingRouteService.changeRoutingType(Common.routingType.hike);
                }
                this.suppressEvents(e);
            };

            $scope.toggleMarkers = (e: Event) => {
                if (this.drawingMarkerService.isEnabled()) {
                    this.drawingMarkerService.enable(false);
                    this.setDragMapCursor();
                }
                else {
                    this.drawingMarkerService.enable(true);
                    this.drawingRouteService.enable(false);
                    this.setDrawingCursor();
                }
                this.suppressEvents(e);
            };

            $scope.undo = (e: Event) => {
                if ($scope.isUndoDisbaled()) {
                    return;
                }
                this.dataStack.pop();
                var undoDelegate = this.dataStack[this.dataStack.length - 1];
                undoDelegate();
                this.suppressEvents(e);
            };

            $scope.clear = (e: Event) => {
                this.ignoreDataChanged = true;
                this.drawingRouteService.clear();
                this.drawingMarkerService.clear();
                this.ignoreDataChanged = false;
                this.addCurrentData();
                this.suppressEvents(e);
            };

            $scope.isRouteEnabled = (): boolean => {
                return this.drawingRouteService.isEnabled();
            };

            $scope.isRoutingEnabled = (): boolean => {
                return this.drawingRouteService.isRoutingEnabled();
            };

            $scope.isMarkersEnabled = (): boolean => {
                return this.drawingMarkerService.isEnabled();
            };

            $scope.isUndoDisbaled = (): boolean => {
                return this.dataStack.length <= 1;
            };

            document.onkeydown = (e: KeyboardEvent) => {
                if (e.keyCode != 27) {
                    return;
                }
                this.drawingRouteService.enable(false);
                this.setDragMapCursor();
                this.updateScope($scope, true);
            };
        }

        private addCurrentData = () => {
            if (this.ignoreDataChanged) {
                return;
            }
            var routeData = this.drawingRouteService.getData();
            var markersData = this.drawingMarkerService.getData();

            this.dataStack.push(() => {
                this.drawingRouteService.setData(routeData);
                this.drawingMarkerService.setData(markersData);
            });
        }

        private setDrawingCursor() {
            $(".leaflet-container").addClass("cursor-crosshair");
        }

        private setDragMapCursor() {
            $(".leaflet-container").removeClass("cursor-crosshair");
        }

        private updateScope($scope: angular.IScope, isApplyNeed: boolean) {
            if (!$scope.$$phase && isApplyNeed) {
                $scope.$apply();
            }
        }
    }
}