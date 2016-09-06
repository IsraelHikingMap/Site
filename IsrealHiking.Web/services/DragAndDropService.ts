namespace IsraelHiking.Services {

    export class DragAndDropService extends ObjectWithMap {
        constructor($timeout: angular.ITimeoutService,
            mapservice: MapService,
            fileService: FileService,
            layersService: Layers.LayersService,
            toastr: Toastr) {
            super(mapservice);

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
                var files = Array.prototype.slice.apply(e.dataTransfer.files) as File[];
                if (files && files.length > 0) {
                    $timeout(() => {
                        for (let file of files) {
                            fileService.openFromFile(file).success((dataContainer: Common.DataContainer) => {
                                layersService.setJsonData(dataContainer);
                            }).error(() => {
                                toastr.error(`unable to load file: ${file.name}`);
                            });
                        }
                    }, 25);
                } else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                    var items = Array.prototype.slice.apply(e.dataTransfer.items) as DataTransferItem[];
                    for (let item of items.filter(itemToFind => itemToFind.type === "text/uri-list")) {
                        item.getAsString((url) => {
                            fileService.openFromUrl(url).success((dataContainer: Common.DataContainer) => {
                                layersService.setJsonData(dataContainer);
                            }).error(() => {
                                toastr.error(`unable to load url: ${url}`);
                            });
                        });
                    }
                }
                this.map.scrollWheelZoom.enable();
            }, false);
        }
    }
}