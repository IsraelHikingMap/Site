namespace IsraelHiking.Controllers {
    export interface IZoomScope {
        zoomIn(e: Event): void;
        zoomOut(e: Event): void;
    }

    export class ZoomController extends BaseMapController {
        constructor($scope: IZoomScope,
                    mapService: Services.MapService) {
            super(mapService);

            $scope.zoomIn = (e: Event) => {
                this.map.zoomIn();
                this.suppressEvents(e);
            }

            $scope.zoomOut = (e: Event) => {
                this.map.zoomOut();
                this.suppressEvents(e);
            }
        }
    }
}