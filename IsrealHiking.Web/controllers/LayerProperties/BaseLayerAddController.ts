namespace IsraelHiking.Controllers.LayerProperties {
    export class BaseLayerAddController extends LayerBaseController {
        constructor($scope: ILayerBaseScope,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Add Base Layer";
            $scope.isNew = true;
        }

        protected internalSave = ($scope: ILayerBaseScope, layerData: Common.LayerData): string => {
            var layer = this.layersService.addBaseLayer(layerData);
            this.layersService.selectBaseLayer(layer);
            return "";
        }
    }
}