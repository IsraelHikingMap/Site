import { Directive, output, ElementRef, Renderer2, OnDestroy, NgZone, inject } from "@angular/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

import { environment } from "../../environments/environment";
import { FileService } from "../services/file.service";
import { ResourcesService } from "../services/resources.service";
import { ToastService } from "../services/toast.service";

interface HTMLElementInputChangeEvent {
    dataTransfer: { files: File[] };
    target: any;
}

@Directive({ selector: "[imageCapture]" })
export class ImageCaptureDirective implements OnDestroy {

    public changed = output<HTMLElementInputChangeEvent>();

    private readonly renderer = inject(Renderer2);
    private readonly ngZone = inject(NgZone);
    private readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly fileService = inject(FileService);
    private readonly elementRef = inject(ElementRef);

    private unsbscribeFn: () => void;

    constructor() {

        this.unsbscribeFn = this.renderer.listen(this.elementRef.nativeElement, "click", (event) => {
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
        this.ngZone.run(() => this.changed.emit(changeEvent));
    }

    ngOnDestroy(): void {
        this.unsbscribeFn();
    }
}
