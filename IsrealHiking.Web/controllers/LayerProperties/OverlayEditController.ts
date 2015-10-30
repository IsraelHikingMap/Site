module IsraelHiking.Controllers.LayerProperties {
    export class OverlayEditController extends LayerBaseController {
        constructor($scope: ILayerBaseEditScope<Services.IOverlay>,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            layer: Services.IOverlay,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Update Overlay";
            $scope.isNew = false;
            $scope.layer = layer;

            $scope.removeLayer = (e: Event) => {
                var message = layersService.removeOverlay($scope.layer);
                this.suppressEvents(e);
            }
        }

        protected internalSave = ($scope: ILayerBaseEditScope<Services.IOverlay>, layerData: Services.ILayerData) => {
            return this.layersService.updateOverlay($scope.layer, layerData);
        }
    }
}