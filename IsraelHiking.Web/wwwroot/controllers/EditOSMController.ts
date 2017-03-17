namespace IsraelHiking.Controllers {
    export interface IEditOSMScope extends angular.IScope {
        editOsm(e: Event): void;
    }

    export class EditOSMController extends BaseMapController {

        constructor($scope: IEditOSMScope,
            $window: angular.IWindowService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            osmUserService: Services.OsmUserService) {
            super(mapService);

            $scope.editOsm = (e: Event) => {
                let center = this.map.getCenter();
                let zoom = this.map.getZoom();
                let baseLayerAddress = layersService.selectedBaseLayer.address;
                $window.open(osmUserService.getEditOsmLocationAddress(baseLayerAddress, zoom, center));
                this.suppressEvents(e);
            };
        } 
    }

} 