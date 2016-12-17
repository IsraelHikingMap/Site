namespace IsraelHiking.Controllers {

    export interface IFormatViewModel {
        label: string,
        outputFormat: string,
        extension: string,
    }

    export interface IFileScope extends IRootScope {
        formats: IFormatViewModel[];
        selectedFormat: IFormatViewModel;
        isShowingSaveAs: boolean;
        isFromatsDropdownOpen: boolean;
        open($files): void;
        save(e: Event): void;
        toggleSaveAs(e: Event): void;
        saveAs(format: IFormatViewModel, e: Event): void;
        print(e: Event): void;
        ignoreClick(e: Event): void;
        selectFormat(format: IFormatViewModel, e: Event): void;
    }

    export class FileController extends BaseMapController {

        layersService: Services.Layers.LayersService;

        constructor($scope: IFileScope,
            $window: angular.IWindowService,
            $document: angular.IDocumentService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            fileService: Services.FileService,
            toastr: Toastr) {
            super(mapService);
            this.layersService = layersService;

            $scope.isShowingSaveAs = false;
            $scope.isFromatsDropdownOpen = false;
            $scope.formats = [
                {
                    label: "GPX version 1.1 (.gpx)",
                    extension: "gpx",
                    outputFormat: "gpx"
                } as IFormatViewModel, {
                    label: "Keyhole Markup Language (.kml)",
                    extension: "kml",
                    outputFormat: "kml"
                } as IFormatViewModel, {
                    label: "Naviguide binary route file (.twl)",
                    extension: "twl",
                    outputFormat: "twl"
                } as IFormatViewModel, {
                    label: "Comma-Separated Values (.csv)",
                    extension: "csv",
                    outputFormat: "csv"
                } as IFormatViewModel, {
                    label: "Single Track GPX (.gpx)",
                    extension: "gpx",
                    outputFormat: "gpx_single_track"
                } as IFormatViewModel, {
                    label: "All routes to a single Track GPX (.gpx)",
                    extension: "gpx",
                    outputFormat: "all_gpx_single_track"
                } as IFormatViewModel
            ];

            $scope.selectedFormat = $scope.formats[0];

            $scope.open = (file: File) => {
                if (!file)
                    return;
                fileService.openFromFile(file).success((dataContainer: Common.DataContainer) => {
                    layersService.setJsonData(dataContainer);
                }).error(() => {
                    toastr.error($scope.resources.unableToLoadFromFile);
                });
            }

            $scope.save = (e: Event) => {
                let data = this.getData();
                fileService.saveToFile(this.getName(data)+ ".gpx", "gpx", data)
                    .then(() => { }, () => {
                        toastr.error($scope.resources.unableToSaveToFile);
                    });
                this.suppressEvents(e);
            }

            $scope.toggleSaveAs = (e: Event) => {
                $scope.isShowingSaveAs = !$scope.isShowingSaveAs;
                this.suppressEvents(e);
            };

            $scope.saveAs = (format: IFormatViewModel, e: Event) => {
                let outputFormat = format.outputFormat;
                let data = this.getData();
                if (outputFormat === "all_gpx_single_track") {
                    outputFormat = "gpx_single_track";
                    data = layersService.getData();
                }
                let name = this.getName(data);
                fileService.saveToFile(`${name}.${format.extension}`, outputFormat, data)
                    .then(() => { }, () => {
                        toastr.error($scope.resources.unableToSaveToFile);
                    });
                $scope.isShowingSaveAs = false;
                this.suppressEvents(e);
            }

            $scope.print = (e: Event) => {
                angular.element($document[0].querySelectorAll(".leaflet-bar")).each((i, a) => {
                    angular.element(a).addClass("no-print");
                });
                
                $window.print();
                this.suppressEvents(e);
            } 

            $scope.ignoreClick = (e: Event) => {
                e.stopPropagation();
            }

            $scope.selectFormat = (format: IFormatViewModel, e: Event) => {
                $scope.selectedFormat = format;
                $scope.isFromatsDropdownOpen = false;
                this.suppressEvents(e);
            }

            angular.element($window).bind("keydown", (e: JQueryEventObject) => {

                if (e.ctrlKey === false) {
                    return true;
                }
                switch (String.fromCharCode(e.which).toLowerCase()) {
                    case "o":
                        // this doesn't work on firefox due to security reasons. it does work in chrome and IE though. 
                        angular.element("#openFile").click();
                    break;
                    case "s":
                        $scope.save(e);
                        break;
                    case "p":
                        $scope.print(e);
                    default:
                        return true;
                }
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
                return true;
            });
        }

        private getData(): Common.DataContainer {
            if (this.layersService.getSelectedRoute() == null) {
                return this.layersService.getData();
            }
            return {
                routes: [this.layersService.getSelectedRoute().getData()]
            } as Common.DataContainer;
        }

        private getName(data: Common.DataContainer): string {
            let name = "IsraelHikingMap";
            if (data.routes.length === 1 && data.routes[0].name) {
                name = data.routes[0].name;
            }
            return name;
        }
    }
} 