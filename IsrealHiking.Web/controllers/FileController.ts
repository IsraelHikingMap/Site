module IsraelHiking.Controllers {

    export interface IFileScope extends angular.IScope {
        open($files, e: Event): void;
        openFileChooser(e: Event): void;
        save(e: Event, fileName: string): void;
    }

    export class FileController extends BaseMapControllerWithToolTip {
        private fileChooserTooltip: any;

        constructor($scope: IFileScope,
            $http: angular.IHttpService,
            mapService: Services.MapService,
            $tooltip,
            layersService: Services.LayersService,
            hashService: Services.HashService,
            fileService: Services.FileService,
            toastr: Toastr) {
            super(mapService, $tooltip);

            this.setDragAndDrop($scope);
            this.fileChooserTooltip = null;

            if (hashService.externalUrl != "") {
                $http.get(Common.Urls.convertFiles + "?url=" + hashService.externalUrl).success((content: GeoJSON.FeatureCollection) => {
                    var dataContainer = fileService.readFromFile("External.geojson", JSON.stringify(content), Common.RoutingType.hike);
                    this.addFileDataToMap(dataContainer, layersService);
                }).error(() => {
                    toastr.error("Failed to load external url file.");
                });
            }

            $scope.open = ($files, e: Event) => {

                if ($files.length <= 0) {
                    return;
                }
                var file = $files.shift();
                var reader = new FileReader();
                reader.onload = (e: any) => {
                    var data = fileService.readFromFile(file.name, e.target.result, layersService.getSelectedDrawing().getRoutingType());
                    this.addFileDataToMap(data, layersService);
                    $scope.$apply();
                };
                reader.readAsText(file);
            }

            $scope.openFileChooser = (e: Event) => {
                if (this.fileChooserTooltip == null) {
                    this.fileChooserTooltip = this.createToolTip(e.target, "views/templates/fileTooltip.tpl.html", "Save", $scope, "left");
                    this.fileChooserTooltip.$promise.then(this.fileChooserTooltip.show);
                }
                this.suppressEvents(e);
            }

            $scope.save = (e: Event, fileName: string) => {
                var data = hashService.getDataContainer();
                fileService.saveToFile(fileName, data);
                this.suppressEvents(e);
            }

            $(window).bind("keydown", (e: JQueryEventObject) => {

                if (e.ctrlKey == false) {
                    return;
                }
                switch (String.fromCharCode(e.which).toLowerCase()) {
                    //case "o":
                        // Opening a file dialog is a violation of security it can not be done.
                        //break;
                    case "s":
                        angular.element("#saveFile").trigger("click");
                        break;
                    default:
                        return;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
                return false;
            });
        }

        private setDragAndDrop = ($scope: IFileScope) => {
            var dropbox = this.map.getContainer();

            var callbacks = {
                dragenter: () => {
                    this.map.scrollWheelZoom.disable();
                },
                dragleave: () => {
                    this.map.scrollWheelZoom.enable();
                },
                dragover: (e: DragEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                },
                drop: (e: DragEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                    var files = Array.prototype.slice.apply(e.dataTransfer.files);
                    setTimeout(() => {
                        $scope.open(files, null);
                    }, 25);
                    this.map.scrollWheelZoom.enable();
                }
            };
            for (var name in callbacks) {
                dropbox.addEventListener(name, callbacks[name], false);
            }
        }

        private addFileDataToMap = (data: Common.DataContainer, layersService: Services.LayersService) => {
            if (data.bounds != null) {
                this.map.fitBounds(data.bounds);
            }
            for (var routeIndex = 0; routeIndex < data.routes.length; routeIndex++) {
                var route = data.routes[routeIndex];
                if (layersService.isNameAvailable(route.name)) {
                    layersService.addRoute(route.name, route, null);
                } else {
                    layersService.addRoute("", route, null); // will cause an automatic name to be created.
                }
            }
            layersService.addMarkers(data.markers);
        }
    }
} 