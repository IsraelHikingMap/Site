import { Directive, output, ElementRef, Renderer2, OnDestroy, NgZone, inject } from "@angular/core";
import { Camera, MediaTypeSelection } from "@capacitor/camera";

import { environment } from "../../environments/environment";
import { FileService, HTMLElementInputChangeEvent } from "../services/file.service";
import { ResourcesService } from "../services/resources.service";
import { ToastService } from "../services/toast.service";

@Directive({ selector: "[imageCapture]" })
export class ImageCaptureDirective implements OnDestroy {

    public changed = output<HTMLElementInputChangeEvent>();

    private readonly renderer = inject(Renderer2);
    private readonly ngZone = inject(NgZone);
    private readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly fileService = inject(FileService);
    private readonly elementRef = inject(ElementRef);

    private readonly unsbscribeFn: () => void;

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
                declineAction: async () => await this.getPicturesFromGallery()
            });
        });
    }

    private async getPictureFromCamera() {
        const media = await Camera.takePhoto({
            correctOrientation: true
        });
        this.raiseChangedEvent([await this.fileService.getFileFromUrl(media.uri)]);
    }

    private async getPicturesFromGallery() {
        const response = await Camera.chooseFromGallery({
            correctOrientation: true,
            mediaType: MediaTypeSelection.Photo,
            allowMultipleSelection: true
        });
        const files = [];
        for (const media of response.results) {
            files.push(await this.fileService.getFileFromUrl(media.uri));
        }
        this.raiseChangedEvent(files);
    }

    private raiseChangedEvent(files: File[]) {
        const changeEvent: HTMLElementInputChangeEvent = {
            dataTransfer: { files },
            target: null,
            preventDefault: () => { }
        };
        this.ngZone.run(() => this.changed.emit(changeEvent));
    }

    ngOnDestroy(): void {
        this.unsbscribeFn();
    }
}
