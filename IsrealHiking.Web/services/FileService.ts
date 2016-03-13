module IsraelHiking.Services {

    export class FileService {

        private parserFactory: Parsers.ParserFactory;
        private elevationProvider: Services.Elevation.IElevationProvider;
        private Upload: angular.angularFileUpload.IUploadService;
        private $http: angular.IHttpService;

        constructor($http: angular.IHttpService,
            parserFactory: Parsers.ParserFactory,
            elevationProvider: Services.Elevation.IElevationProvider,
            Upload: angular.angularFileUpload.IUploadService) {
            this.$http = $http;
            this.parserFactory = parserFactory;
            this.elevationProvider = elevationProvider;
            this.Upload = Upload;
        }

        public saveToFile = (fileName: string, format:string, dataContainer: Common.DataContainer): angular.IPromise<{}> => {
            return this.$http.post(Common.Urls.files + "?format=" + format, dataContainer)
                .success((responseData) => {
                    this.saveBytesResponseToFile(responseData, fileName);
                });
        }

        public openFromFile = (file: File): angular.IHttpPromise<Common.DataContainer> => {
            return this.Upload.upload({
                data: { file: file },
                url: Common.Urls.openFile
            } as angular.angularFileUpload.IFileUploadConfigFile);
        }

        public openFromUrl = (url: string): angular.IHttpPromise<Common.DataContainer> => {
            return this.$http.get(Common.Urls.files + "?url=" + url);
        }

        public uploadForConversionAndSave = (blob: Blob, fileName: string, format: string): angular.IHttpPromise<{}> => {
            return this.Upload.upload(<angular.angularFileUpload.IFileUploadConfigFile>{
                data: { file: blob },
                url: Common.Urls.files + "?outputFormat=" + format
            }).success((data) => {
                this.saveBytesResponseToFile(data, fileName);
            });
        }

        private saveBytesResponseToFile = (data, fileName: string) => {
            var byteCharacters = atob(data);
            var byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            var byteArray = new Uint8Array(byteNumbers);
            var blobToSave = new Blob([byteArray], { type: "application/octet-stream" });
            saveAs(blobToSave, fileName);
        }
    }

}