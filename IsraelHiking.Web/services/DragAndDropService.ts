namespace IsraelHiking.Services {

    export class DragAndDropService extends ObjectWithMap {

        constructor($timeout: angular.ITimeoutService,
            resourcesService: ResourcesService,
            mapservice: MapService,
            fileService: FileService,
            layersService: Layers.LayersService,
            toastr: Toastr) {
            super(mapservice);

            var dropbox = angular.element(this.map.getContainer());

            dropbox.on("dragenter", () => { this.map.scrollWheelZoom.disable(); });
            dropbox.on("dragleave", () => { this.map.scrollWheelZoom.enable(); });
            dropbox.on("dragover", (e: JQueryEventObject) => {
                e.stopPropagation();
                e.preventDefault();
            });
            dropbox.on("drop", (e: JQueryEventObject) => {
                e.stopPropagation();
                e.preventDefault();
                this.map.scrollWheelZoom.enable();
                let transferData = (e.originalEvent as DragEvent).dataTransfer;
                let files = Array.prototype.slice.apply(transferData.files) as File[];
                if (files && files.length > 0) {
                    $timeout(() => {
                        for (let file of files) {
                            fileService.openFromFile(file).success((dataContainer: Common.DataContainer) => {
                                layersService.setJsonData(dataContainer);
                            }).error(() => {
                                toastr.error(resourcesService.unableToLoadFromFile + `: ${file.name}`);
                            });
                        }
                    }, 25);
                    return;
                }

                let url = transferData.getData("text");
                if (url) {
                    fileService.openFromUrl(url).success((dataContainer: Common.DataContainer) => {
                        layersService.setJsonData(dataContainer);
                    }).error(() => {
                        toastr.error(resourcesService.unableToLoadFromUrl + `: ${url}`);
                    });
                }
            });
        }
    }
}