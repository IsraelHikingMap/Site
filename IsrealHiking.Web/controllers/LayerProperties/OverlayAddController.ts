namespace IsraelHiking.Controllers.LayerProperties {
    export class OverlayAddController extends LayerBaseController {
        constructor($scope: ILayerBaseScope,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Add Overlay";
            $scope.isNew = true;
        }

        protected internalSave = ($scope: ILayerBaseScope, layerData: Common.LayerData) => {
            var overlay = this.layersService.addOverlay(layerData);
            this.layersService.toggleOverlay(overlay);
            return "";
        }
    }
}