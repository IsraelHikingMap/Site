module IsraelHiking.Controllers {
    export interface IMarkerPopupScope extends angular.IScope {
        title: string;
        setTitle(title: string): void;
    }

    export class MarkerPopupController {
        constructor($scope: IMarkerPopupScope) {
            // in case we neet do add anything here...
        }
    }
} 