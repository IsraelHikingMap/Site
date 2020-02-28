import { Injectable, NgZone } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Style } from "mapbox-gl";
import { File as FileSystemWrapper } from "@ionic-native/file/ngx";
import { Zip } from "@ionic-native/zip/ngx";
import { Subject } from "rxjs";
import JSZip from "jszip";

import { ImageResizeService } from "./image-resize.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { Urls } from "../urls";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { DataContainer } from "../models/models";
import { throttleTime } from "rxjs/operators";

export interface IFormatViewModel {
    label: string;
    outputFormat: string;
    extension: string;
}

@Injectable()
export class FileService {
    public formats: IFormatViewModel[];

    constructor(private readonly httpClient: HttpClient,
        private readonly fileSystemWrapper: FileSystemWrapper,
        private readonly zip: Zip,
        private readonly runningContextService: RunningContextService,
        private readonly imageResizeService: ImageResizeService,
        private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly loggingService: LoggingService,
        private readonly ngZone: NgZone) {
        this.formats = [];
    }

    public async initialize() {
        let response = await this.httpClient.get(Urls.fileFormats).toPromise() as IFormatViewModel[];
        this.formats.splice(0);
        for (let format of response) {
            this.formats.push(format);
        }
        this.formats.push({
            label: "All routes to a single Track GPX",
            extension: "gpx",
            outputFormat: "all_gpx_single_track"
        } as IFormatViewModel);

        for (let format of this.formats) {
            format.label += ` (.${format.extension})`;
        }
        // HM TODO: move this to required function to avoid permission on startup?
        if (this.runningContextService.isCordova) {
            let folder = this.runningContextService.isIos
                ? this.fileSystemWrapper.documentsDirectory
                : this.fileSystemWrapper.externalRootDirectory;
            await this.fileSystemWrapper.createDir(folder, "IsraelHikingMap", true);
        }
    }

    public getFileFromEvent(e: any): File {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return null;
        }
        let target = e.target || e.srcElement;
        target.value = "";
        return file;
    }

    public getFilesFromEvent(e: any): File[] {
        let files: FileList = e.dataTransfer ? e.dataTransfer.files : e.target.files;
        if (!files || files.length === 0) {
            return [];
        }
        let filesToReturn = [];
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < files.length; i++) {
            filesToReturn.push(files[i]);
        }
        let target = e.target || e.srcElement;
        target.value = ""; // this will reset files so we need to clone the array.
        return filesToReturn;
    }

    public getFullFilePath(relativePath: string): string {
        if (!this.runningContextService.isCordova) {
            return (window.origin || window.location.origin) + "/" + relativePath;
        }
        let path = relativePath;
        if (this.runningContextService.isIos) {
            path = this.fileSystemWrapper.applicationDirectory + "www/" + relativePath;
            path = (window as any).Ionic.WebView.convertFileSrc(path);
        } else {
            path = "http://localhost/" + relativePath;
        }
        return path;
    }

    public getDataUrl(url: string): string {
        if (!url.startsWith("https://") && this.runningContextService.isCordova) {

            url = (window as any).Ionic.WebView.convertFileSrc(this.fileSystemWrapper.dataDirectory + url.replace("custom://", ""));
        }
        return url;
    }

    public getStyleJsonContent(url: string): Promise<Style> {
        return this.httpClient.get(this.getDataUrl(url)).toPromise() as Promise<Style>;
    }

    public saveToFile = async (fileName: string, format: string, dataContainer: DataContainer): Promise<boolean> => {
        let responseData = await this.httpClient.post(Urls.files + "?format=" + format, dataContainer).toPromise() as string;
        return await this.saveBytesResponseToFile(responseData, fileName);
    }

    public async addRoutesFromFile(file: File): Promise<any> {
        if (file.type === ImageResizeService.JPEG) {
            let container = await this.imageResizeService.resizeImageAndConvert(file);
            if (container.routes.length === 0 || container.routes[0].markers.length === 0) {
                throw new Error("no geographic information found in file...");
            }
            this.addRoutesFromContainer(container);
            return;
        }
        let formData = new FormData();
        formData.append("file", file, file.name);
        let fileContainer = await this.httpClient.post(Urls.openFile, formData).toPromise() as DataContainer;
        this.addRoutesFromContainer(fileContainer);
    }

    public openFromUrl = (url: string): Promise<DataContainer> => {
        return this.httpClient.get(Urls.files + "?url=" + url).toPromise() as Promise<DataContainer>;
    }

    public async addRoutesFromUrl(url: string) {
        let container = await this.openFromUrl(url);
        this.addRoutesFromContainer(container);
    }

    private addRoutesFromContainer(container: DataContainer) {
        this.selectedRouteService.addRoutes(container.routes);
        this.fitBoundsService.fitBounds(SpatialService.getBounds([container.southWest, container.northEast]));
    }

    private saveBytesResponseToFile = async (data: string, fileName: string): Promise<boolean> => {
        let blobToSave = this.nonAngularObjectsFactory.b64ToBlob(data, "application/octet-stream");
        return await this.saveAsWorkAround(blobToSave, fileName);
    }

    /**
     * This is an ugly workaround suggested here:
     * https://github.com/eligrey/FileSaver.js/issues/330
     * Plus cordova file save.
     * Return true if there's a need to show a toast message.
     * @param blob - the file to save
     * @param fileName - the file name
     */
    private async saveAsWorkAround(blob: Blob, fileName: string): Promise<boolean> {
        if (!this.runningContextService.isCordova) {
            this.nonAngularObjectsFactory.saveAsWrapper(blob, fileName, { autoBom: false });
            return false;
        }
        let fullFileName = new Date().toISOString().split(":").join("-").replace("T", "_")
            .replace("Z", "_") +
            fileName.replace(/[/\\?%*:|"<>]/g, "-").split(" ").join("_");
        await this.fileSystemWrapper.writeFile(this.getStorageBasePath(), "IsraelHikingMap/" + fullFileName, blob);
        return true;
    }

    private getStorageBasePath(): string {
        return this.runningContextService.isIos
            ? this.fileSystemWrapper.documentsDirectory
            : this.fileSystemWrapper.externalRootDirectory;
    }

    public async openIHMfile(blob: Blob,
        tilesCallback: (address: string, content: string, percentage: number) => Promise<void>,
        poisCallback: (content: string) => Promise<void>,
        imagesCallback: (content: string, percentage: number) => Promise<void>,
        glyphsCallback: (percentage: number) => void
    ): Promise<void> {
        let zip = new JSZip();
        await zip.loadAsync(blob);
        await this.writeSources(zip, tilesCallback);
        await this.writePois(zip, poisCallback);
        await this.writeImages(zip, imagesCallback);

        if (!this.runningContextService.isCordova) {
            return;
        }
        await this.writeStyles(zip);
        await this.writeGlyphs(blob, zip, glyphsCallback);
        await this.writeSprite(zip);
    }

    private async writeSources(zip: JSZip, tilesCallback: (address: string, content: string, percentage: number) => Promise<void>) {
        let sources = Object.keys(zip.files).filter(name => name.startsWith("sources/") && name.endsWith(".json"));
        for (let sourceFileIndex = 0; sourceFileIndex < sources.length; sourceFileIndex++) {
            let sourceFile = sources[sourceFileIndex];
            let sourceName = sourceFile.split("/")[1];
            await tilesCallback(sourceName, await zip.file(sourceFile).async("text") as string,
                ((sourceFileIndex + 1) / sources.length * 100));
            this.loggingService.debug("Added: " + sourceFile);
        }
    }

    private async writePois(zip: JSZip, poisCallback: (content: string) => Promise<void>) {
        let poisFileName = Object.keys(zip.files).find(name => name.startsWith("pois/") && name.endsWith(".geojson"));
        if (poisFileName != null) {
            let poisText = (await zip.file(poisFileName).async("text")).trim();
            await poisCallback(poisText);
            this.loggingService.debug("Added pois.");
        }
    }

    private async writeImages(zip: JSZip, imagesCallback: (content: string, percentage: number) => Promise<void>) {
        let images = Object.keys(zip.files).filter(name => name.startsWith("images/") && name.endsWith(".json"));
        for (let imagesFileIndex = 0; imagesFileIndex < images.length; imagesFileIndex++) {
            let imagesFile = images[imagesFileIndex];
            await imagesCallback(await zip.file(imagesFile).async("text") as string, (imagesFileIndex + 1) / images.length * 100);
            this.loggingService.debug("Added images: " + imagesFile);
        }
    }

    private async writeGlyphs(blob: Blob, zip: JSZip, progressCallback: (percentage: number) => void) {
        let fonts = Object.keys(zip.files).filter(name => name.startsWith("glyphs/"));
        if (fonts.length !== Object.keys(zip.files).length) {
            this.loggingService.error("Invalid glyph file - there are files outside the glyph folder that are not allowed");
            return;
        }
        await this.fileSystemWrapper.writeFile(this.fileSystemWrapper.cacheDirectory, "fonts.zip", blob,
            { truncate: 0, replace: true, append: false });

        let subject = new Subject<{ loaded: number, total: number }>();
        subject.pipe(throttleTime(500)).subscribe((p) => this.ngZone.run(() => progressCallback((p.loaded / p.total) * 100)));
        await this.zip.unzip(this.fileSystemWrapper.cacheDirectory + "fonts.zip",
            this.fileSystemWrapper.dataDirectory, (p) => subject.next(p));
        this.loggingService.debug("Write glyphs finished succefully!");
    }

    private async writeStyles(zip: JSZip) {
        let styles = Object.keys(zip.files).filter(name => name.startsWith("styles/") && name.endsWith(".json"));
        for (let styleFileName of styles) {
            let styleText = (await zip.file(styleFileName).async("text")).trim();
            await this.fileSystemWrapper.writeFile(this.fileSystemWrapper.dataDirectory, styleFileName.replace("styles/", ""), styleText,
                { append: false, replace: true, truncate: 0 });
            this.loggingService.debug("Write style finished succefully!");
        }
    }

    private async writeSprite(zip: JSZip) {
        let sprites = Object.keys(zip.files)
            .filter(name => name.startsWith("sprite/") && (name.endsWith(".json") || name.endsWith(".png")));
        for (let spriteFile of sprites) {
            let folderSplit = spriteFile.split("/");
            if (folderSplit.length !== 2) {
                continue;
            }
            await this.fileSystemWrapper.createDir(this.fileSystemWrapper.dataDirectory, folderSplit[0], true);
            await this.fileSystemWrapper.writeFile(this.fileSystemWrapper.dataDirectory, spriteFile,
                await zip.file(spriteFile).async("blob") as Blob, { append: false, replace: true, truncate: 0 });
        }
        this.loggingService.debug("Write sprite finished succefully!");
    }

    public async zipAndStoreFile(content: string): Promise<string> {
        let zip = new JSZip();
        zip.file("log.txt", content);
        try {
            let blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
            let fullFileName = "Report_" + new Date().toISOString().split(":").join("-").replace("T", "_").replace("Z", "_") + ".zip";
            await this.fileSystemWrapper.writeFile(this.getStorageBasePath(), "IsraelHikingMap/" + fullFileName, blob);
        } catch {
            // no need to do anything
        }
        return zip.generateAsync({ type: "base64" });
    }
}
