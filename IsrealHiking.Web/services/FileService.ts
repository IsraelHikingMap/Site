module IsraelHiking.Services {

    export interface IFileSaver {
        saveAs(blob: Blob, fileName: string): void;
    }

    export class FileService {

        private Upload: angular.angularFileUpload.IUploadService;
        private FileSaver: IFileSaver;
        private $http: angular.IHttpService;

        constructor($http: angular.IHttpService,
            Upload: angular.angularFileUpload.IUploadService,
            FileSaver: IFileSaver) {
            this.$http = $http;
            this.Upload = Upload;
            this.FileSaver = FileSaver;
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

        private saveBytesResponseToFile = (data, fileName: string) => {
            var byteCharacters = atob(data);
            var byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            var byteArray = new Uint8Array(byteNumbers);
            var blobToSave = new Blob([byteArray], { type: "application/octet-stream" });
            this.FileSaver.saveAs(blobToSave, fileName);
        }
    }

}