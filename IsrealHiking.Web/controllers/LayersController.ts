namespace IsraelHiking.Controllers {

    export interface ILayersScope extends angular.IScope {
        baseLayers: Services.Layers.IBaseLayer[];
        overlays: Services.Layers.IOverlay[];
        routes: Services.Layers.RouteLayers.RouteLayer[];
        advanced: boolean;

        addBaseLayer(e: Event): void;
        editBaseLayer(layer: Services.Layers.ILayer, e: Event): void;
        addOverlay(e: Event): void;
        editOverlay(layer: Services.Layers.ILayer, e: Event): void;
        addRoute(e: Event): void;
        editRoute(routeName: string, e: Event): void;
        selectBaseLayer(baseLayer: Services.Layers.IBaseLayer, e: Event): void;
        toggleVisibility(overlay: Services.Layers.IOverlay, e: Event): void;
        selectRoute(routeLayer: Services.Layers.RouteLayers.RouteLayer, e: Event): void;
        toggleAdvanced(e: Event): void;
        toggleShow(e: Event): void;
        getRouteColorName(route: Services.Layers.RouteLayers.RouteLayer):void;
        getRouteName(route: Services.Layers.RouteLayers.RouteLayer): void;
        isRouteVisisble(route: Services.Layers.RouteLayers.RouteLayer): boolean;
        isRouteSelected(route: Services.Layers.RouteLayers.RouteLayer): boolean;
    }

    export class LayersController extends BaseMapController {
        private static SHOW_ADVANCED_KEY = "showAdvancedLayerControl";

        constructor($scope: ILayersScope,
            $modal,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            fileService: Services.FileService,
            sidebarService: Services.SidebarService,
            routeLayerFactory: Services.Layers.RouteLayers.RouteLayerFactory,
            toastr: Toastr) {
            super(mapService);
            $scope.baseLayers = layersService.baseLayers;
            $scope.overlays = layersService.overlays;
            $scope.routes = layersService.routes;
            $scope.advanced = localStorageService.get(LayersController.SHOW_ADVANCED_KEY) ? true : false;
            $scope.addBaseLayer = (e: Event) => {
                var newScope = $scope.$new() as LayerProperties.ILayerBaseScope;
                var controller = new LayerProperties.BaseLayerAddController(newScope, mapService, layersService, toastr);
                this.showLayerModal(newScope, $modal, e);
            }

            $scope.editBaseLayer = (layer: Services.Layers.IBaseLayer, e: Event) => {
                var newScope = $scope.$new() as LayerProperties.ILayerBaseEditScope<Services.Layers.IBaseLayer>;
                var controller = new LayerProperties.BaseLayerEditController(newScope, mapService, layersService, layer, toastr);
                this.showLayerModal(newScope, $modal, e);
            }

            $scope.addOverlay = (e: Event) => {
                var newScope = $scope.$new() as LayerProperties.ILayerBaseScope;
                var controller = new LayerProperties.OverlayAddController(newScope, mapService, layersService, toastr);
                this.showLayerModal(newScope, $modal, e);
            }

            $scope.editOverlay = (layer: Services.Layers.IOverlay, e: Event) => {
                var newScope = $scope.$new() as LayerProperties.ILayerBaseEditScope<Services.Layers.IOverlay>;
                var controller = new LayerProperties.OverlayEditController(newScope, mapService, layersService, layer, toastr);
                this.showLayerModal(newScope, $modal, e);
            }

            $scope.addRoute = (e: Event) => {
                var routePropertiesScope = $scope.$new() as RouteProperties.IRouteAddScope;
                var routeAddController = new RouteProperties.RouteAddController(routePropertiesScope, mapService, layersService, routeLayerFactory, toastr);
                var modal = this.createRoutePropertiesModal(routePropertiesScope, $modal);
                modal.$promise.then(modal.show);
                this.suppressEvents(e);
            }

            $scope.editRoute = (routeName: string, e: Event) => {
                var routePropertiesScope = <RouteProperties.IRouteUpdateScope>$scope.$new();
                var routeUpdateController = new RouteProperties.RouteUpdateController(routePropertiesScope, mapService, layersService, fileService, toastr, routeName);
                var modal = this.createRoutePropertiesModal(routePropertiesScope, $modal);
                modal.$promise.then(modal.show);
                this.suppressEvents(e);
            }

            $scope.selectBaseLayer = (baseLayer: Services.Layers.IBaseLayer, e: Event) => {
                layersService.selectBaseLayer(baseLayer);
                this.suppressEvents(e);
            }

            $scope.toggleVisibility = (overlay: Services.Layers.IOverlay, e: Event) => {
                layersService.toggleOverlay(overlay);
                this.suppressEvents(e);
            }

            $scope.selectRoute = (routeLayer: Services.Layers.RouteLayers.RouteLayer, e: Event) => {
                layersService.changeRouteState(routeLayer);
                this.suppressEvents(e);
            }

            $scope.toggleAdvanced = (e: Event) => {
                $scope.advanced = !$scope.advanced;
                localStorageService.set(LayersController.SHOW_ADVANCED_KEY, $scope.advanced);
                this.suppressEvents(e);
            }

            $scope.toggleShow = (e: Event) => {
                sidebarService.toggle("layers");
                this.suppressEvents(e);
            }

            $scope.getRouteColorName = (routeLayer: Services.Layers.RouteLayers.RouteLayer) => {
                return _.find(Common.Constants.COLORS, colorToFind => colorToFind.value === routeLayer.getRouteProperties().pathOptions.color).key;
            }

            $scope.getRouteName = (routeLayer: Services.Layers.RouteLayers.RouteLayer) => {
                return routeLayer.getRouteProperties().name;
            }

            $scope.isRouteVisisble = (routeLayer: Services.Layers.RouteLayers.RouteLayer) => {
                return routeLayer.getRouteProperties().isVisible;
            }

            $scope.isRouteSelected = (routeLayer: Services.Layers.RouteLayers.RouteLayer) => {
                return layersService.getSelectedRoute() === routeLayer;
            }
        }

        private createRoutePropertiesModal = (routePropertiesScope: RouteProperties.IRouteBaseScope, $modal): any => {
            return $modal({
                title: "Route Properties",
                templateUrl: "controllers/RouteProperties/routePropertiesModal.html",
                show: false,
                scope: routePropertiesScope
            });
        }

        private showLayerModal = ($scope: LayerProperties.ILayerBaseScope, $modal, e: Event) => {
            var modal = $modal({
                title: $scope.title,
                templateUrl: "controllers/LayerProperties/layerPropertiesModal.html",
                show: false,
                scope: $scope
            });
            modal.$promise.then(modal.show);
            this.suppressEvents(e);
        }
    }
} 