module IsraelHiking.Controllers {
    export interface IEditOSMScope extends angular.IScope {
        editOsm(e: Event): void;
    }


    export class EditOSMController extends BaseMapController {

        constructor($scope: IEditOSMScope,
            mapService: Services.MapService) {
            super(mapService);

            $scope.editOsm = (e: Event) => {
                var center = this.map.getCenter();
                var zoom = this.map.getZoom();
                window.open("http://www.openstreetmap.org/edit#background=custom:http://osm.org.il/IsraelHiking/Tiles/{z}/{x}/{y}.png&map=" + zoom + "/" + center.lat + "/" + center.lng);
                this.suppressEvents(e);
            };
        } 
    }

} 