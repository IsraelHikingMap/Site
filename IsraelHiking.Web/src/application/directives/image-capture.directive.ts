import { Directive, Output, ElementRef, Renderer2, OnDestroy, EventEmitter, NgZone } from "@angular/core";
import { Camera, CameraResultType } from "@capacitor/camera";
import { FileService } from "application/services/file.service";

import { environment } from "../../environments/environment";
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
        let data = await Camera.getPhoto({
            correctOrientation: true,
            saveToGallery: true,
            resultType: CameraResultType.Base64
        });
        let blob = await fetch(`data:image/jpeg;base64,${data.base64String}`).then(r => r.blob()) as File;
        this.raiseChangedEvent([blob]);
    }

    private async getPicturesFromGallery() {
        let response = await Camera.pickImages({
            correctOrientation: true,
        });
        let files = [];
        for (let photo of response.photos) {
            files.push(await this.fileService.getFileFromUrl(photo.path));
        }
        this.raiseChangedEvent(files);
    }

    private raiseChangedEvent(files: File[]) {
        let changeEvent = {
            dataTransfer: { files },
            target: {}
        };
        this.ngZone.run(() => this.changed.next(changeEvent));
    }

    ngOnDestroy(): void {
        this.listenFunction();
    }
}
