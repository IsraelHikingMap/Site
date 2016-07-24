namespace IsraelHiking.Controllers.LayerProperties {
    export class BaseLayerEditController extends LayerBaseController {
        constructor($scope: ILayerBaseEditScope<Services.Layers.IBaseLayer>,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            layer: Services.Layers.IBaseLayer,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Base Layer Properties";
            $scope.isNew = false;
            $scope.layer = layer;
            $scope.key = layer.key;
            $scope.maxZoom = layer.maxZoom;
            $scope.minZoom = layer.minZoom;
            $scope.address = layer.address;

            $scope.removeLayer = (e: Event) => {
                layersService.removeBaseLayer($scope.layer);
                this.suppressEvents(e);
            }
        }

        protected internalSave = ($scope: ILayerBaseEditScope<Services.Layers.IBaseLayer>, layerData: Common.LayerData) => {
            return this.layersService.updateBaseLayer($scope.layer, layerData);
        }


    }
}