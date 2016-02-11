module IsraelHiking.Controllers {
    export interface IConvertFormatScope extends angular.IScope {
        formats: string[];
        selectedFormat: string;
        setSelectedFormat(selectedFormat: string): void;
        openConvert(e: Event): void;
        selectFile($files, e: Event): void;
        convertFile(selectedFormat: string): void;
    }

    export class ConvertFormatController extends BaseMapController {
        private convertModal;
        private fileToUpload;

        constructor($scope: IConvertFormatScope,
            $modal,
            Upload: angular.angularFileUpload.IUploadService,
            mapService: Services.MapService,
            fileService: Services.FileService,
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
            }

            $scope.convertFile = () => {
                Upload.upload(<angular.angularFileUpload.IFileUploadConfigFile> {
                    data: { file: this.fileToUpload },
                    url: Common.Urls.convertFiles + "?outputFormat=" + $scope.selectedFormat,
                }).success((data: any) => {
                    var extension = this.fileToUpload.name.split('.').pop();
                    var outputFileName = (<string>this.fileToUpload.name).replace("." + extension, "." + $scope.selectedFormat);
                    var byteCharacters = atob(data);
                    var byteNumbers = new Array(byteCharacters.length);
                    for (var i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    var byteArray = new Uint8Array(byteNumbers);
                    var blob = new Blob([byteArray], { type: "application/octet-stream" });
                    fileService.saveDataToFile(outputFileName, blob);
                }).error(() => {
                    toastr.error("Failed to convert file.");
                });
            }
        }
    }
}