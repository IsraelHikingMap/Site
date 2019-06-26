/// <reference types="cordova-plugin-camera" />
import { Directive, Output, ElementRef, Renderer2, OnDestroy, EventEmitter, NgZone } from "@angular/core";

import { environment } from "../../environments/environment";
import { NonAngularObjectsFactory } from "../services/non-angular-objects.factory";
import { ResourcesService } from "../services/resources.service";
import { ToastService } from "../services/toast.service";

@Directive({
    selector: "[imageCapture]",
})
export class ImageCaptureDirective implements OnDestroy {

    @Output()
    public changed: EventEmitter<any>;

    private listenFunction: () => void;

    constructor(elementRef: ElementRef,
                private readonly renderer: Renderer2,
                private readonly ngZone: NgZone,
                private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
                private readonly resources: ResourcesService,
                private readonly toastService: ToastService) {

        this.changed = new EventEmitter();
        this.listenFunction = this.renderer.listen(elementRef.nativeElement, "click", (event) => {
            if (!environment.isCordova) {
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
                confirmAction: () => this.getPicture(Camera.PictureSourceType.CAMERA, true),
                declineAction: () => this.getPicture(Camera.PictureSourceType.PHOTOLIBRARY, false),
            });
        });
    }

    private getPicture(sourceType: number, saveToPhotoAlbum: boolean) {
        navigator.camera.getPicture(
            (imageUri: string) => {
                let blob = this.nonAngularObjectsFactory.b64ToBlob("data:image/jpeg;base64," + imageUri);
                let changeEvent = {
                    dataTransfer: {
                        files: [blob]
                    },
                    target: {}
                };
                this.ngZone.run(() => this.changed.next(changeEvent));
            },
            (err) => {
                console.error(err);
            },
            {
                destinationType: Camera.DestinationType.DATA_URL,
                sourceType,
                saveToPhotoAlbum,
                correctOrientation: true
            });
    }

    ngOnDestroy(): void {
        this.listenFunction();
    }
}
