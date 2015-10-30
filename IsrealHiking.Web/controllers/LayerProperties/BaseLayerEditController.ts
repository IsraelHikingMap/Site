module IsraelHiking.Controllers.LayerProperties {
    export class BaseLayerEditController extends LayerBaseController {
        constructor($scope: ILayerBaseEditScope<Services.IBaseLayer>,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            layer: Services.IBaseLayer,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Update Base Layer";
            $scope.isNew = false;
            $scope.layer = layer;
            $scope.key = layer.key;
            $scope.maxZoom = layer.maxZoom;
            $scope.minZoom = layer.minZoom;
            $scope.address = layer.address;

            $scope.removeLayer = (e: Event) => {
                layersService.removeBaseLayer(<Services.IBaseLayer>$scope.layer);
                this.suppressEvents(e);
            }
        }

        protected internalSave = ($scope: ILayerBaseEditScope<Services.IBaseLayer>, layerData: Services.ILayerData) => {
            return this.layersService.updateBaseLayer($scope.layer, layerData);
        }


    }
}