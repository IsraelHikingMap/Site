module IsraelHiking.Controllers {
    export interface IFormatViewModel {
        label: string,
        outputFormat: string,
        extension:  string,
    }

    export interface IConvertFormatScope extends angular.IScope {
        formats: IFormatViewModel[];
        selectedFormat: IFormatViewModel;
        selectedFileName: string;
        setSelectedFormat(selectedFormat: IFormatViewModel): void;
        openConvert(e: Event): void;
        selectFile($files, e: Event): void;
        convertFile(selectedFormat: string): void;
    }

    export class ConvertFormatController extends BaseMapController {
        private convertModal;
        private fileToUpload: File;

        constructor($scope: IConvertFormatScope,
            $modal,
            fileService: Services.FileService,
            mapService: Services.MapService,
            toastr: Toastr) {
            super(mapService);

            this.convertModal = $modal({
                title: "Convert File Format",
                templateUrl: "views/templates/convertFormatModal.tpl.html",
                show: false,
                scope: $scope
            });

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
                } as IFormatViewModel
            ];

            $scope.selectedFormat = $scope.formats[0];

            $scope.openConvert = (e: Event) => {
                this.convertModal.$promise.then(this.convertModal.show);
                this.suppressEvents(e);
            }

            $scope.setSelectedFormat = (selectedFormat: IFormatViewModel) => {
                $scope.selectedFormat = selectedFormat;
            }

            $scope.selectFile = ($files, e: Event) => {
                if ($files.length <= 0) {
                    return;
                }                
                this.fileToUpload = $files.shift();
                $scope.selectedFileName = this.fileToUpload.name;
            }

            $scope.convertFile = () => {
                var extension = this.fileToUpload.name.split(".").pop();
                var outputFileName = this.fileToUpload.name.replace(`.${extension}`, `.${$scope.selectedFormat.extension}`);
                fileService.uploadForConversionAndSave(this.fileToUpload, outputFileName, $scope.selectedFormat.outputFormat);
            }
        }
    }
}