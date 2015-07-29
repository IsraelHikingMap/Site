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
    }

    export class DrawingController extends BaseMapController {
        private layersService: Services.LayersService;
        private selectedDrawing: Services.Drawing.IDrawing;

        constructor($scope: IDrawingScope,
            mapService: Services.MapService,
            layersService: Services.LayersService) {
            super(mapService);
            this.layersService = layersService;
            this.selectedDrawing = this.layersService.getSelectedDrawing();

            this.layersService.eventHelper.addListener((args: Common.IDataChangedEventArgs) => {
                this.selectedDrawing = this.layersService.getSelectedDrawing();
            });

            $scope.clear = (e: Event) => {
                this.selectedDrawing.clear();
                this.suppressEvents(e);
            }

            $scope.toggleDrawing = (e: Event) => {
                if (this.selectedDrawing.isEnabled()) {
                    this.selectedDrawing.enable(false);
                    this.setDragMapCursor();
                }
                else {
                    this.selectedDrawing.enable(true);
                    this.setDrawingCursor();
                }
                this.suppressEvents(e);
            };

            $scope.toggleRouting = (routingType: string, e: Event) => {
                if (this.selectedDrawing.getRoutingType() == routingType) {
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
                return this.selectedDrawing.isEnabled();
            };

            $scope.getRoutingType = (): string => {
                return this.selectedDrawing.getRoutingType();
            };

            $scope.isUndoDisbaled = (): boolean => {
                return this.selectedDrawing.isUndoDisbaled();
            };

            $scope.showRouting = (): boolean => {
                return this.selectedDrawing.name != Common.Constants.MARKERS;
            }

            document.onkeydown = (e: KeyboardEvent) => {
                if (e.keyCode == 90 && e.ctrlKey) { // ctrl+Z
                    this.selectedDrawing.undo();
                }
                else if (e.keyCode == 27) { // escape
                    this.selectedDrawing.enable(false);
                    this.setDragMapCursor();
                }
                else {
                    return;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            };
        }

        private setDrawingCursor() {
            $(".leaflet-container").addClass("cursor-crosshair");
        }

        private setDragMapCursor() {
            $(".leaflet-container").removeClass("cursor-crosshair");
        }
    }
}