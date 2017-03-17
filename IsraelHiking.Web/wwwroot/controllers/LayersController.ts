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
        isVisisble(): boolean;
        getRouteColorName(route: Services.Layers.RouteLayers.RouteLayer): void;
        getRouteName(route: Services.Layers.RouteLayers.RouteLayer): void;
        isRouteVisisble(route: Services.Layers.RouteLayers.RouteLayer): boolean;
        isRouteSelected(route: Services.Layers.RouteLayers.RouteLayer): boolean;
    }

    export class LayersController extends BaseMapController {
        public static SHOW_ADVANCED_KEY = "showAdvancedLayerControl";

        constructor($scope: ILayersScope,
            $uibModal: angular.ui.bootstrap.IModalService,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            fileService: Services.FileService,
            sidebarService: Services.SidebarService) {
            super(mapService);
            $scope.baseLayers = layersService.baseLayers;
            $scope.overlays = layersService.overlays;
            $scope.routes = layersService.routes;
            $scope.advanced = localStorageService.get(LayersController.SHOW_ADVANCED_KEY) ? true : false;
            $scope.addBaseLayer = (e: Event) => {
                this.suppressEvents(e);
                $uibModal.open({
                    templateUrl: "controllers/LayerProperties/layerPropertiesModal.html",
                    controller: LayerProperties.BaseLayerAddController
                });
            }

            $scope.editBaseLayer = (layer: Services.Layers.IBaseLayer, e: Event) => {
                this.suppressEvents(e);
                let newScope = $scope.$new() as LayerProperties.ILayerBaseEditScope<Services.Layers.IBaseLayer>;
                newScope.layer = layer;
                $uibModal.open({
                    templateUrl: "controllers/LayerProperties/layerPropertiesModal.html",
                    scope: newScope,
                    controller: LayerProperties.BaseLayerEditController
                });
            }

            $scope.addOverlay = (e: Event) => {
                this.suppressEvents(e);
                $uibModal.open({
                    templateUrl: "controllers/LayerProperties/layerPropertiesModal.html",
                    controller: LayerProperties.OverlayAddController
                });
            }

            $scope.editOverlay = (layer: Services.Layers.IOverlay, e: Event) => {
                this.suppressEvents(e);
                let newScope = $scope.$new() as LayerProperties.ILayerBaseEditScope<Services.Layers.IOverlay>;
                newScope.layer = layer;
                $uibModal.open({
                    templateUrl: "controllers/LayerProperties/layerPropertiesModal.html",
                    scope: newScope,
                    controller: LayerProperties.OverlayEditController
                });
            }

            $scope.addRoute = (e: Event) => {
                this.suppressEvents(e);
                $uibModal.open({
                    templateUrl: "controllers/RouteProperties/routePropertiesModal.html",
                    controller: RouteProperties.RouteAddController
                });
            }

            $scope.editRoute = (routeName: string, e: Event) => {
                var routePropertiesScope = $scope.$new() as RouteProperties.IRouteUpdateScope;
                this.suppressEvents(e);
                routePropertiesScope.name = routeName;
                $uibModal.open({
                    templateUrl: "controllers/RouteProperties/routePropertiesModal.html",
                    controller: RouteProperties.RouteUpdateController,
                    scope: routePropertiesScope
                });
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

            $scope.isVisisble = (): boolean => {
                return sidebarService.viewName === "layers";
            }

            $scope.getRouteColorName = (routeLayer: Services.Layers.RouteLayers.RouteLayer) => {
                return routeLayer.getColorName();
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
    }
} 