module IsraelHiking.Controllers {

    export interface ILayersScope extends angular.IScope {
        baseLayers: Services.IBaseLayer[];
        overlays: Services.IOverlay[];
        routes: Services.Drawing.IDrawing[];
        markers: Services.Drawing.IDrawing;
        advanced: boolean;
        hovering: boolean;

        addBaseLayer(e: Event): void;
        editBaseLayer(layer: Services.ILayer, e: Event): void;
        addOverlay(e: Event): void;
        editOverlay(layer: Services.ILayer, e: Event): void;
        addRoute(e: Event): void;
        editRoute(routeName: string, e: Event): void;
        selectBaseLayer(baseLayer: Services.IBaseLayer, e: Event): void;
        toggleVisibility(overlay: Services.IOverlay, e: Event): void;
        selectDrawing(name: string, e: Event): void;
        toggleAdvanced(e: Event): void;
        toggleHovering(e: Event): void;
    }

    export class LayersController extends BaseMapController {
        constructor($scope: ILayersScope,
            $modal,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            fileService: Services.FileService,
            toastr: Toastr) {
            super(mapService);
            $scope.baseLayers = layersService.baseLayers;
            $scope.overlays = layersService.overlays;
            $scope.routes = layersService.routes;
            $scope.markers = layersService.markers;
            $scope.advanced = false;
            $scope.hovering = false;


            $scope.addBaseLayer = (e: Event) => {
                var newScope = <LayerProperties.ILayerBaseScope>$scope.$new();
                var controller = new LayerProperties.BaseLayerAddController(newScope, mapService, layersService, toastr);
                this.showLayerModal(newScope, $modal, e);
            }

            $scope.editBaseLayer = (layer: Services.IBaseLayer, e: Event) => {
                var newScope = <LayerProperties.ILayerBaseEditScope<Services.IBaseLayer>>$scope.$new();
                var controller = new LayerProperties.BaseLayerEditController(newScope, mapService, layersService, layer, toastr);
                this.showLayerModal(newScope, $modal, e);
            }

            $scope.addOverlay = (e: Event) => {
                var newScope = <LayerProperties.ILayerBaseScope>$scope.$new();
                var controller = new LayerProperties.OverlayAddController(newScope, mapService, layersService, toastr);
                this.showLayerModal(newScope, $modal, e);
            }

            $scope.editOverlay = (layer: Services.IOverlay, e: Event) => {
                var newScope = <LayerProperties.ILayerBaseEditScope<Services.IOverlay>>$scope.$new();
                var controller = new LayerProperties.OverlayEditController(newScope, mapService, layersService, layer, toastr);
                this.showLayerModal(newScope, $modal, e);
            }

            $scope.addRoute = (e: Event) => {
                var routePropertiesScope = <RouteProperties.IRouteAddScope> $scope.$new();
                var routeAddController = new RouteProperties.RouteAddController(routePropertiesScope, mapService, layersService, toastr);
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

            $scope.selectBaseLayer = (baseLayer: Services.IBaseLayer, e: Event) => {
                layersService.selectBaseLayer(baseLayer);
                this.suppressEvents(e);
            }

            $scope.toggleVisibility = (overlay: Services.IOverlay, e: Event) => {
                layersService.toggleOverlay(overlay);
                this.suppressEvents(e);
            }

            $scope.selectDrawing = (name: string, e: Event) => {
                layersService.changeDrawingState(name);
                this.suppressEvents(e);
            }

            $scope.toggleAdvanced = (e: Event) => {
                $scope.advanced = !$scope.advanced;
                this.suppressEvents(e);
            }

            $scope.toggleHovering = (e: Event) => {
                $scope.hovering = !$scope.hovering;
                this.suppressEvents(e);
            }
        }

        private createRoutePropertiesModal = (routePropertiesScope: RouteProperties.IRouteBaseScope, $modal): any => {
            return $modal({
                title: "Route Properties",
                templateUrl: "views/templates/routePropertiesModal.tpl.html",
                show: false,
                scope: routePropertiesScope,
            });
        }

        private showLayerModal = ($scope: LayerProperties.ILayerBaseScope, $modal, e: Event) => {
            var modal = $modal({
                title: $scope.title,
                templateUrl: "views/templates/layerPropertiesModal.tpl.html",
                show: false,
                scope: $scope,
            });
            modal.$promise.then(modal.show);
            this.suppressEvents(e);
        }
    }
} 