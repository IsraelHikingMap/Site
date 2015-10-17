module IsraelHiking.Controllers {
    export interface IEditOSMScope extends angular.IScope {
        editOsm(e: Event): void;
    }


    export class EditOSMController extends BaseMapController {

        constructor($scope: IEditOSMScope,
            $window: angular.IWindowService,
            mapService: Services.MapService,
            layersService: Services.LayersService) {
            super(mapService);

            $scope.editOsm = (e: Event) => {
                var center = this.map.getCenter();
                var zoom = this.map.getZoom();
                var baseLayerAddress = layersService.selectedBaseLayer.address;
                var background = "background=bing";
                if (baseLayerAddress != "") {
                    var address = baseLayerAddress.indexOf("{s}") == -1 ? baseLayerAddress : Services.LayersService.DEFAULT_TILES_ADDRESS;
                    background = "background=custom:" + address;
                }
                $window.open("http://www.openstreetmap.org/edit#" + background + "&map=" + zoom + "/" + center.lat + "/" + center.lng);
                this.suppressEvents(e);
            };
        } 
    }

} 