namespace IsraelHiking.Controllers {
    export interface IEditOSMScope extends angular.IScope {
        editOsm(e: Event): void;
    }

    export class EditOSMController extends BaseMapController {

        constructor($scope: IEditOSMScope,
            $window: angular.IWindowService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService) {
            super(mapService);

            $scope.editOsm = (e: Event) => {
                let center = this.map.getCenter();
                let zoom = this.map.getZoom();
                let baseLayerAddress = layersService.selectedBaseLayer.address;
                let background = "background=bing";
                if (baseLayerAddress !== "") {
                    if (baseLayerAddress.indexOf("/") === 0) {
                        baseLayerAddress = Common.Urls.baseAddress + baseLayerAddress;
                    }
                    let address = baseLayerAddress.indexOf("{s}") === -1 ? baseLayerAddress : Common.Urls.baseAddress + Services.Layers.LayersService.DEFAULT_TILES_ADDRESS;
                    background = `background=custom:${address}`;
                }
                $window.open(`http://www.openstreetmap.org/edit#${background}&map=${zoom}/${center.lat}/${center.lng}`);
                this.suppressEvents(e);
            };
        } 
    }

} 