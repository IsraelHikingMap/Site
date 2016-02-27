module IsraelHiking.Controllers.LayerProperties {
    export class OverlayEditController extends LayerBaseController {
        constructor($scope: ILayerBaseEditScope<Services.IOverlay>,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            layer: Services.IOverlay,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Overlay Properties";
            $scope.isNew = false;
            $scope.layer = layer;
            $scope.key = layer.key;
            $scope.maxZoom = layer.maxZoom;
            $scope.minZoom = layer.minZoom;
            $scope.address = layer.address;

            $scope.removeLayer = (e: Event) => {
                layersService.removeOverlay($scope.layer);
                this.suppressEvents(e);
            }
        }

        protected internalSave = ($scope: ILayerBaseEditScope<Services.IOverlay>, layerData: Common.LayerData) => {
            return this.layersService.updateOverlay($scope.layer, layerData);
        }
    }
}