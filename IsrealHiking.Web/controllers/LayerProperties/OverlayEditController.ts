namespace IsraelHiking.Controllers.LayerProperties {
    export class OverlayEditController extends LayerBaseController {
        constructor($scope: ILayerBaseEditScope<Services.Layers.IOverlay>,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            toastr: Toastr) {
            super($scope, mapService, layersService, toastr);
            $scope.title = "Overlay Properties";
            $scope.isNew = false;
            $scope.key = $scope.layer.key;
            $scope.maxZoom = $scope.layer.maxZoom;
            $scope.minZoom = $scope.layer.minZoom;
            $scope.address = $scope.layer.address;

            $scope.removeLayer = (e: Event) => {
                layersService.removeOverlay($scope.layer);
                this.suppressEvents(e);
            }
        }

        protected internalSave = ($scope: ILayerBaseEditScope<Services.Layers.IOverlay>, layerData: Common.LayerData) => {
            return this.layersService.updateOverlay($scope.layer, layerData);
        }
    }
}