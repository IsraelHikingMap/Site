module IsraelHiking.Controllers {

    export interface IFileScope extends angular.IScope {
        open($files): void;
        save(e: Event): void;
    }

    export class FileController extends BaseMapController {

        constructor($scope: IFileScope,
            $timeout: angular.ITimeoutService,
            $window: angular.IWindowService,
            mapService: Services.MapService,
            layersService: Services.LayersService,
            hashService: Services.HashService,
            fileService: Services.FileService,
            toastr: Toastr) {
            super(mapService);

            this.setDragAndDrop($scope, $timeout);

            if (hashService.externalUrl !== "") {
                fileService.openFromUrl(hashService.externalUrl)
                    .success((dataContainer: Common.DataContainer) => {
                        layersService.setJsonData(dataContainer);
                    }).error(() => {
                        toastr.error("Failed to load external url file.");
                    });
            }

            $scope.open = (file: File) => {
                if (!file)
                    return;
                fileService.openFromFile(file).success((dataContainer: Common.DataContainer) => {
                    layersService.setJsonData(dataContainer);
                }).error(() => {
                    toastr.error("Failed to load file.");
                });
            }

            $scope.save = (e: Event) => {
                var data = layersService.getData();
                fileService.saveToFile("IsraelHikingMap.gpx", data)
                    .then(() => { }, () => {
                        toastr.error("Unable to save file...");
                    });
                this.suppressEvents(e);
            }

            angular.element($window).bind("keydown", (e: JQueryEventObject) => {

                if (e.ctrlKey === false) {
                    return true;
                }
                switch (String.fromCharCode(e.which).toLowerCase()) {
                    case "o":
                        // this doesn't work on firefox due to security reasons. it does work in chrome and IE though. 
                        $("#openFile").click();
                    break;
                    case "s":
                        $scope.save(e);
                        break;
                    default:
                        return true;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
                return true;
            });
        }

        private setDragAndDrop = ($scope: IFileScope, $timeout: angular.ITimeoutService) => {
            var dropbox = this.map.getContainer();

            dropbox.addEventListener("dragenter", () => { this.map.scrollWheelZoom.disable(); }, false);
            dropbox.addEventListener("dragleave", () => { this.map.scrollWheelZoom.enable(); }, false);
            dropbox.addEventListener("dragover", (e: DragEvent) => {
                e.stopPropagation();
                e.preventDefault();
            }, false);
            dropbox.addEventListener("drop", (e: DragEvent) => {
                e.stopPropagation();
                e.preventDefault();
                var files = Array.prototype.slice.apply(e.dataTransfer.files);
                if (files && files.length > 0) {
                    $timeout(() => {
                        $scope.open(files.shift());
                    }, 25);
                }
                this.map.scrollWheelZoom.enable();
            }, false);
        }
    }
} 