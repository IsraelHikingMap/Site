module IsraelHiking.Controllers {
    export interface IRouteUpdateScope extends IRouteBaseScope {
        isVisible: boolean;
        toggleVisibility(e: Event): void;
        deleteRoute(e: Event): void;
        reverseRoute(e: Event): void;
        saveRouteToFile(extention: string, e: Event);
    }

    export class RouteUpdateController extends RouteBaseController {

        constructor($scope: IRouteUpdateScope,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            parserFactory: Services.Parsers.ParserFactory,
            name: string) {
            super($scope, mapService, layersService);
            var route = layersService.getRouteByName(name);
            var options = route.getPathOptions();
            $scope.name = name;
            $scope.isNew = false;
            $scope.weight = options.weight;
            $scope.color = options.color;
            $scope.isVisible = route.state != Services.Drawing.DrawingState.hidden;

            $scope.toggleVisibility = (e: Event) => {
                $scope.isVisible = !$scope.isVisible;
                if ($scope.isVisible) {
                    route.show();
                } else {
                    route.hide();
                }
                this.suppressEvents(e);
            }
            $scope.saveRoute = (name: string, weight: number, e: Event) => {
                if (layersService.isNameAvailable(name) == true) {
                    route.setName(name);
                } else {
                    // HM TODO: toast? return false?
                }
                route.setPathOptions({ color: $scope.color, weight: weight });
                this.suppressEvents(e);
            }
            $scope.deleteRoute = (e: Event) => {
                layersService.removeRoute(route.name);
                this.suppressEvents(e);
            }
            $scope.saveRouteToFile = (extention: string, e: Event): void=> {
                var data = <Common.DataContainer> {
                    markers: [],
                    routes: [route.getData()]
                };
                var parser = parserFactory.Create(extention);
                var dataString = parser.toString(data);
                var blob = new Blob([dataString], { type: "application/json" })
                var blobURL = ((<any>window).URL || (<any>window).webkitURL).createObjectURL(blob);
                var anchor = <any>document.createElement("a");
                anchor.style = "display: none";
                anchor.download = route.name + "." + extention;
                anchor.href = blobURL;
                document.body.appendChild(anchor);
                anchor.click();

                setTimeout(function () {
                    document.body.removeChild(anchor);
                    ((<any>window).URL || (<any>window).webkitURL).revokeObjectURL(blobURL);
                }, 100);
                this.suppressEvents(e);
            }

            $scope.reverseRoute = (e: Event) => {
                route.reverse();
                this.suppressEvents(e);
            }
        }
    }
}