module IsraelHiking.Controllers {
    export interface IVisibleLayer {
        name: string;
        visible: boolean;
    }

    export interface ILayersScope extends angular.IScope {
        layers: string[];
        overlays: IVisibleLayer[];
        routes: IVisibleLayer[];
        selectedLayer: string;
        selectedRoute: IVisibleLayer;

        addLayer(e: Event): void;
        setLayer(layer: string, e: Event): void;
        selectRoute(route: IVisibleLayer, e: Event): void;
        toggleVisibility(layer: IVisibleLayer, e: Event): void;
        addRoute(e: Event): void;
    }

    export class LayersController extends BaseMapController {
        constructor($scope: ILayersScope,
            $injector: angular.auto.IInjectorService,
            mapService: Services.MapService,
            layersService: Services.LayersService) {
            super(mapService);
            $scope.layers = layersService.getLayersNames();
            $scope.selectedLayer = layersService.getSelectedLayer().key;
            $scope.overlays = [];
            $scope.routes = [];
            var overlaysNames = layersService.getOverlaysNames();
            for (var overlayIndex = 0; overlayIndex < overlaysNames.length; overlayIndex++) {
                $scope.overlays.push(<IVisibleLayer> {
                    name: overlaysNames[overlayIndex],
                    visible: true,
                });
            }
            var routeNames = layersService.getRouteNames();
            for (var routeIndex = 0; routeIndex < routeNames.length; routeIndex++) {
                $scope.routes.push(<IVisibleLayer> {
                    name: routeNames[routeIndex],
                    visible: true,
                });
            }

            $scope.setLayer = (layer: string, e: Event) => {
                layersService.setSelectedLayer(layer);
            }

            $scope.addLayer = (e: Event) => {
                // need to load modal and add new layer
            }

            $scope.addRoute = (e: Event) => {
                // need to load modal and add new layer
            }

            $scope.selectRoute = (route: IVisibleLayer, e: Event) => {
                $scope.selectedRoute = route;
            }

            $scope.toggleVisibility = (layer: IVisibleLayer, e: Event) => {
                layer.visible = !layer.visible
                layersService.toggleOverlay(layer.name, layer.visible);
            }
        }
    }
} 