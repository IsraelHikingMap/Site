module IsraelHiking.Controllers {
    export interface IDrawingScope extends angular.IScope {
        toggleRoute(e: Event): void;
        toggleRouting(e: Event): void;
        toggleMarkers(e: Event): void;
        undo(e: Event): void;
        isRouteEnabled(): boolean;
        isRoutingEnabled(): boolean;
        isMarkersEnabled(): boolean;
        isUndoDisbaled(): boolean;
    }

    export class DrawingController extends BaseMapController {
        private layersService: Services.LayersService;
        private drawingMarkerService: Services.DrawingMarkerService;
        private ignoreDataChanged: boolean;
        private selectedRoute: Services.DrawingRouteService;

        constructor($scope: IDrawingScope,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            drawingMarkerService: Services.DrawingMarkerService) {
            super(mapService);
            this.layersService = layersService;
            this.drawingMarkerService = drawingMarkerService;
            this.ignoreDataChanged = false;
            this.selectedRoute = this.layersService.getSelectedRoute();
            if (this.selectedRoute == null) {
                this.layersService.setData([]);
                this.selectedRoute = this.layersService.getSelectedRoute();
            }

            this.layersService.eventHelper.addListener((args: Services.IDataChangedEventArgs) => {
                this.selectedRoute = this.layersService.getSelectedRoute();
            });
            this.drawingMarkerService.eventHelper.addListener((args: Services.IDataChangedEventArgs) => {
                this.updateScope($scope, args.applyToScope);
            });

            $scope.toggleRoute = (e: Event) => {
                if (this.selectedRoute == null) {
                    return;
                }

                if (this.selectedRoute.isEnabled()) {
                    this.selectedRoute.enable(false);
                    this.setDragMapCursor();
                }
                else {
                    this.selectedRoute.enable(true);
                    this.drawingMarkerService.enable(false);
                    this.setDrawingCursor();
                }
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
            };

            $scope.toggleRouting = (e: Event) => {
                if (this.selectedRoute.isRoutingEnabled()) {
                    this.selectedRoute.changeRoutingType(Common.routingType.none);
                } else {
                    this.selectedRoute.changeRoutingType(Common.routingType.hike);
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
                    this.selectedRoute.enable(false);
                    this.setDrawingCursor();
                }
                this.suppressEvents(e);
            };

            $scope.undo = (e: Event) => {
                // HM TODO: add undo logic
                this.suppressEvents(e);
            };

            $scope.isRouteEnabled = (): boolean => {
                return this.selectedRoute.isEnabled();
            };

            $scope.isRoutingEnabled = (): boolean => {
                return this.selectedRoute.isRoutingEnabled();
            };

            $scope.isMarkersEnabled = (): boolean => {
                return this.drawingMarkerService.isEnabled();
            };

            $scope.isUndoDisbaled = (): boolean => {
                // HM TODO: add undo logic
                return false;
            };

            document.onkeydown = (e: KeyboardEvent) => {
                if (e.keyCode != 27) {
                    return;
                }
                this.selectedRoute.enable(false);
                this.setDragMapCursor();
                this.updateScope($scope, true);
            };
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