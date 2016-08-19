namespace IsraelHiking.Controllers.LayerProperties {
    export class BaseLayerEditController extends LayerBaseController {
        constructor($scope: ILayerBaseEditScope<Services.Layers.IBaseLayer>,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Base Layer Properties";
            $scope.isNew = false;
            $scope.key = $scope.layer.key;
            $scope.maxZoom = $scope.layer.maxZoom;
            $scope.minZoom = $scope.layer.minZoom;
            $scope.address = $scope.layer.address;

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