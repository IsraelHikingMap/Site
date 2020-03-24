import { Component, HostListener, ViewChild, ElementRef } from "@angular/core";
import { NgRedux } from "@angular-redux/store";
import { every } from "lodash";

import { DataContainerService } from "../services/data-container.service";
import { ResourcesService } from "../services/resources.service";
import { FileService } from "../services/file.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import { RunningContextService } from "../services/running-context.service";
import { DatabaseService } from "../services/database.service";
import { SetOfflineLastModifiedAction } from "../reducres/offline.reducer";
import { DataContainer, ApplicationState } from "../models/models";

@Component({
    selector: "file",
    templateUrl: "./file.component.html"
})
export class FileComponent extends BaseMapComponent {

    @ViewChild("openFile", { static: false })
    public openFileElement: ElementRef;

    constructor(resources: ResourcesService,
                private readonly dataContainerService: DataContainerService,
                private readonly fileService: FileService,
                private readonly toastService: ToastService,
                private readonly runningContextService: RunningContextService,
                private readonly databaseService: DatabaseService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public async open(e: any) {
        let file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        if (file.name.endsWith(".ihm") && this.ngRedux.getState().offlineState.isOfflineAvailable) {
            this.toastService.info(this.resources.openingAFilePleaseWait);
            try {
                await this.fileService.openIHMfile(file,
                    this.tilesStoreCallback,
                    this.poisStoreCallback,
                    this.imagesStoreCallback,
                    this.glyphsCallback);
                this.toastService.confirm({ type: "Ok", message: this.resources.finishedOpeningTheFile });
            } catch (ex) {
                this.toastService.error(ex.message);
            }
            return;
        }
        if (file.name.endsWith(".mbtiles")) {
            // HM TODO:
            // && this.ngRedux.getState().offlineState.isOfflineAvailable
            this.toastService.info(this.resources.openingAFilePleaseWait);
            await this.fileService.saveToDatabasesFolder(file);
            this.toastService.confirm({ type: "Ok", message: this.resources.finishedOpeningTheFile });
            this.ngRedux.dispatch(new SetOfflineLastModifiedAction({ lastModifiedDate: new Date(file.lastModified) }));
            return;
        }
        try {
            await this.fileService.addRoutesFromFile(file);
        } catch (ex) {
            this.toastService.error(this.resources.unableToLoadFromFile);
        }
    }

    private tilesStoreCallback = async (sourceName: string, content: string, percentage: number) => {
        try {
            await this.databaseService.saveTilesContent(sourceName, content);
            this.toastService.info(percentage.toFixed(1) + "%");
        } catch (ex) {
            this.toastService.error(ex.toString());
        }
    }

    private poisStoreCallback = async (content: string) => {
        try {
            await this.databaseService.storePois(JSON.parse(content).features);
        } catch (ex) {
            this.toastService.error(ex.toString());
        }
    }

    private imagesStoreCallback = async (content: string, percentage: number) => {
        try {
            await this.databaseService.storeImages(JSON.parse(content));
            this.toastService.info(percentage.toFixed(1) + "%");
        } catch (ex) {
            this.toastService.error(ex.toString());
        }
    }

    private glyphsCallback = (percentage) => {
        this.toastService.info(percentage.toFixed(1) + "%");
    }

    public async save() {
        let data = this.dataContainerService.getDataForFileExport();
        if (!this.isDataSaveable(data)) {
            return;
        }
        try {
            let showToast = await this.fileService.saveToFile(this.getName(data) + ".gpx", "gpx", data);
            if (showToast) {
                this.toastService.success(this.resources.fileSavedSuccessfully);
            }
        } catch (ex) {
            this.toastService.error(this.resources.unableToSaveToFile);
        }
    }

    private getName(data: DataContainer): string {
        let name = "IsraelHikingMap";
        if (data.routes.length === 1 && data.routes[0].name) {
            name = data.routes[0].name;
        }
        return name;
    }

    private isDataSaveable(data: DataContainer): boolean {
        if (data.routes.length === 0) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return false;
        }
        if (every(data.routes, r => r.segments.length === 0 && r.markers.length === 0)) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return false;
        }
        return true;
    }

    public print() {
        window.print();
    }

    public showPrint(): boolean {
        return !this.runningContextService.isMobile;
    }

    @HostListener("window:keydown", ["$event"])
    public onFileShortcutKeys($event: KeyboardEvent) {
        if ($event.ctrlKey === false) {
            return true;
        }
        if ($event.key == null) {
            return true;
        }
        switch ($event.key.toLowerCase()) {
            case "o":
                // this doesn't work on firefox due to security reasons. it does work in chrome and IE though.
                this.openFileElement.nativeElement.click();
                break;
            case "s":
                this.save();
                break;
            case "p":
                this.print();
                break;
            default:
                return true;
        }
        return true;
    }
}
