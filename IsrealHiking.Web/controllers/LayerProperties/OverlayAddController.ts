module IsraelHiking.Controllers.LayerProperties {
    export class OverlayAddController extends LayerBaseController {
        constructor($scope: ILayerBaseScope,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Add Overlay";
            $scope.isNew = true;
        }

        protected internalSave = ($scope: ILayerBaseScope, layerData: Services.ILayerData) => {
            var overlay = this.layersService.addOverlay(layerData);
            this.layersService.toggleOverlay(overlay);
            return "";
        }
    }
}