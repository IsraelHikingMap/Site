module IsraelHiking.Controllers {

    export interface IFileScope extends angular.IScope {
        file: File;
        open($files): void;
        save(e: Event): void;
    }

    export class FileController extends BaseMapController {

        constructor($scope: IFileScope,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            hashService: Services.HashService,
            fileService: Services.FileService,
            toastr: Toastr) {
            super(mapService);

            this.setDragAndDrop($scope);

            if (hashService.externalUrl !== "") {
                fileService.openFromUrl(hashService.externalUrl)
                    .success((dataContainer: Common.DataContainer) => {
                        layersService.setJsonData(dataContainer);
                    }).error(() => {
                        toastr.error("Failed to load external url file.");
                    });
            }

            $scope.open = () => {
                if ($scope.file) {
                    fileService.openFromFile($scope.file).success((dataContainer: Common.DataContainer) => {
                        layersService.setJsonData(dataContainer);
                    }).error(() => {
                        toastr.error("Failed to load file.");
                    });
                }
            }

            $scope.save = (e: Event) => {
                var data = layersService.getData();
                fileService.saveToFile("IsraelHikingMap.gpx", data)
                    .then(() => { }, () => {
                        toastr.error("Unable to save file...");
                    });
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
                        $scope.open(files);
                    }, 25);
                    this.map.scrollWheelZoom.enable();
                }
            };
            for (let name in callbacks) {
                dropbox.addEventListener(name, callbacks[name], false);
            }
        }
    }
} 