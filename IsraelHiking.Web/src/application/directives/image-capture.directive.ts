import { Directive, Output, ElementRef, Renderer2, OnDestroy, EventEmitter, NgZone } from "@angular/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

import { environment } from "../../environments/environment";
import { FileService } from "../services/file.service";
import { ResourcesService } from "../services/resources.service";
import { ToastService } from "../services/toast.service";

interface HTMLElementInputChangeEvent {
    dataTransfer: { files: File[] };
    target: any;
}

@Directive({
    selector: "[imageCapture]",
})
export class ImageCaptureDirective implements OnDestroy {

    @Output()
    public changed: EventEmitter<HTMLElementInputChangeEvent>;

    private listenFunction: () => void;

    constructor(elementRef: ElementRef,
                private readonly renderer: Renderer2,
                private readonly ngZone: NgZone,
                private readonly resources: ResourcesService,
                private readonly toastService: ToastService,
                private readonly fileService: FileService) {

        this.changed = new EventEmitter();
        this.listenFunction = this.renderer.listen(elementRef.nativeElement, "click", (event) => {
            if (!environment.isCapacitor) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            this.toastService.confirm({
                message: "",
                type: "Custom",
                customConfirmText: this.resources.camera,
                customDeclineText: this.resources.gallery,
                confirmIcon: "camera",
                declineIcon: "image",
                confirmAction: async () => await this.getPictureFromCamera(),
                declineAction: async () => await this.getPicturesFromGallery(),
            });
        });
    }

    private async getPictureFromCamera() {
        const data = await Camera.getPhoto({
            correctOrientation: true,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera
        });
        const blob = await fetch(data.dataUrl).then(r => r.blob()) as File;
        this.raiseChangedEvent([blob]);
    }

    private async getPicturesFromGallery() {
        const response = await Camera.pickImages({
            correctOrientation: true,
        });
        const files = [];
        for (const photo of response.photos) {
            files.push(await this.fileService.getFileFromUrl(photo.path));
        }
        this.raiseChangedEvent(files);
    }

    private raiseChangedEvent(files: File[]) {
        const changeEvent = {
            dataTransfer: { files },
            target: {}
        };
        this.ngZone.run(() => this.changed.next(changeEvent));
    }

    ngOnDestroy(): void {
        this.listenFunction();
    }
}
