module IsraelHiking.Controllers {

    export interface IAddLayerModalScope extends angular.IScope {
        addLayer(name, address, e: Event): void;
    }

    export interface IAddRouteModalScope extends angular.IScope {
        addRoute(name, e: Event): void;
    }

    export interface ILayersScope extends angular.IScope {
        baseLayers: Services.IBaseLayer[];
        overlays: Services.IOvelay[];
        routes: Services.IRoute[];

        addBaseLayer(e: Event): void;
        addOverlay(e: Event): void;
        addRoute(key: string, e: Event): void;
        removeBaseLayer(baseLayer: Services.IBaseLayer, e: Event): void;
        removeOverlay(overlay: Services.IOvelay, e: Event): void;
        removeRoute(route: Services.IRoute, e: Event): void;
        selectBaseLayer(baseLayer: Services.IBaseLayer, e: Event): void;
        toggleVisibility(overlay: Services.IOvelay, e: Event): void;
        selectRoute(route: Services.IRoute, e: Event): void;
    }

    export class LayersController extends BaseMapController {
        constructor($scope: ILayersScope,
            $modal,
            mapService: Services.MapService,
            layersService: Services.LayersService) {
            super(mapService);
            $scope.baseLayers = layersService.baseLayers;
            $scope.overlays = layersService.overlays;
            $scope.routes = layersService.routes;
            var addBaseLayerModal = this.createBaseLayerModal($scope, $modal, layersService);
            var addOverlayModal = this.createOverlayModal($scope, $modal, layersService);
            var addRouteModal = this.createRouteModal($scope, $modal, layersService);

            $scope.addBaseLayer = (e: Event) => {
                addBaseLayerModal.show();
                this.suppressEvents(e);
            }

            $scope.addOverlay = (e: Event) => {
                addOverlayModal.show();
                this.suppressEvents(e);
            }

            $scope.addRoute = (key: string, e: Event) => {
                addRouteModal.show();
                this.suppressEvents(e);
            }

            $scope.removeBaseLayer = (baseLayer: Services.IBaseLayer, e: Event) => {
                layersService.removeBaseLayer(baseLayer);
                this.suppressEvents(e);
            }

            $scope.removeOverlay = (overlay: Services.IOvelay, e: Event) => {
                layersService.removeOverlay(overlay);
                this.suppressEvents(e);
            }
            $scope.removeRoute = (route: Services.IRoute, e: Event) => {
                layersService.removeRoute(route);
                this.suppressEvents(e);
            }

            $scope.selectBaseLayer = (baseLayer: Services.IBaseLayer, e: Event) => {
                layersService.selectBaseLayer(baseLayer);
                this.suppressEvents(e);
            }

            $scope.toggleVisibility = (overlay: Services.IOvelay, e: Event) => {
                layersService.toggleOverlay(overlay);
                this.suppressEvents(e);
            }

            $scope.selectRoute = (route: Services.IRoute, e: Event) => {
                layersService.selectRoute(route);
                this.suppressEvents(e);
            }
        }

        private createBaseLayerModal = ($scope: ILayersScope, $modal, layersService: Services.LayersService): any => {
            var addBaseLayerScope = <IAddLayerModalScope>$scope.$new();
            addBaseLayerScope.addLayer = (name: string, address: string, e: Event) => {
                layersService.addBaseLayer(name, address);
                this.suppressEvents(e);
            }
            return this.createAddLayerModal($modal, "Add Base Layer", addBaseLayerScope);
        }

        private createOverlayModal = ($scope: ILayersScope, $modal, layersService: Services.LayersService): any => {
            var addOvelayScope = <IAddLayerModalScope>$scope.$new();
            addOvelayScope.addLayer = (name: string, address: string, e: Event) => {
                layersService.addOverlay(name, address);
                this.suppressEvents(e);
            }
            return this.createAddLayerModal($modal, "Add Overlay", addOvelayScope);
        }

        private createRouteModal = ($scope: ILayersScope, $modal, layersService: Services.LayersService): any => {
            var addRouteScope = <IAddRouteModalScope>$scope.$new();
            addRouteScope.addRoute = (name: string, e: Event) => {
                layersService.addRoute(name);
                this.suppressEvents(e);
            }
            return $modal({
                title: "Add Route",
                template: "views/templates/addRouteModal.tpl.html",
                show: false,
                scope: addRouteScope,
            });
        }

        private createAddLayerModal($modal, title, scope): any {
            return $modal({
                title: title,
                template: "views/templates/addLayerModal.tpl.html",
                show: false,
                scope: scope,
            });
        }
    }
} 