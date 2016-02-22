module IsraelHiking.Controllers {
    export interface IConvertFormatScope extends angular.IScope {
        formats: string[];
        selectedFormat: string;
        selectedFileName: string;
        setSelectedFormat(selectedFormat: string): void;
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
                scope: $scope,
            });

            $scope.formats = ["gpx", "kml", "twl", "csv"];
            $scope.openConvert = (e: Event) => {
                this.convertModal.$promise.then(this.convertModal.show);
                this.suppressEvents(e);
            }

            $scope.setSelectedFormat = (selectedFormat: string) => {
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
                var extension = this.fileToUpload.name.split('.').pop();
                var outputFileName = (this.fileToUpload.name).replace("." + extension, "." + $scope.selectedFormat);
                fileService.uploadForConversionAndSave(this.fileToUpload, $scope.selectedFormat, outputFileName);
            }
        }
    }
}