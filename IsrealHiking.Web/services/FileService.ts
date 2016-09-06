namespace IsraelHiking.Services {

    export interface IFileSaver {
        saveAs(blob: Blob, fileName: string): void;
    }

    export class FileService {

        private upload: angular.angularFileUpload.IUploadService;
        private fileSaver: IFileSaver;
        private $http: angular.IHttpService;

        constructor($http: angular.IHttpService,
            upload: angular.angularFileUpload.IUploadService,
            fileSaver: IFileSaver) {
            this.$http = $http;
            this.upload = upload;
            this.fileSaver = fileSaver;
        }

        public saveToFile = (fileName: string, format:string, dataContainer: Common.DataContainer): angular.IPromise<{}> => {
            return this.$http.post(Common.Urls.files + "?format=" + format, dataContainer)
                .success((responseData) => {
                    this.saveBytesResponseToFile(responseData, fileName);
                });
        }

        public openFromFile = (file: File): angular.IHttpPromise<Common.DataContainer> => {
            return this.upload.upload({
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
            this.fileSaver.saveAs(blobToSave, fileName);
        }
    }

}