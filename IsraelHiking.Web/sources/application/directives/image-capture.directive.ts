import { Directive, Output, ElementRef, Renderer2, OnDestroy, EventEmitter, NgZone } from "@angular/core";

import { environment } from "../../environments/environment";
import { NonAngularObjectsFactory } from "../services/non-angular-objects.factory";

declare var navigator: any;
declare var Camera: any;

@Directive({
    selector: "[imageCapture]",
})
export class ImageCaptureDirective implements OnDestroy {

    @Output()
    public change: EventEmitter<any>;

    private listenFunction: Function;

    constructor(elementRef: ElementRef,
        renderer: Renderer2,
        private readonly ngZone: NgZone,
        nonAngularObjectsFactory: NonAngularObjectsFactory) {

        this.change = new EventEmitter();
        this.listenFunction = renderer.listen(elementRef.nativeElement, "click", (event) => {
            if (!environment.isCordova) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            // HM TODO: allow user to select gallery or camera?
            navigator.camera.getPicture(
                (imageUri: string) => {
                    let blob = nonAngularObjectsFactory.b64ToBlob("data:image/jpeg;base64," + imageUri);
                    let changeEvent = {
                        dataTransfer: {
                            files: [blob]
                        },
                        target: {}
                    };
                    this.ngZone.run(() => this.change.next(changeEvent));
                },
                (err) => {
                    console.log(err);
                },
                {
                    destinationType: Camera.DestinationType.DATA_URL,
                    sourceType: Camera.PictureSourceType.CAMERA,
                    saveToPhotoAlbum: true
                });
        });

    }

    ngOnDestroy(): void {
        this.listenFunction();
    }
}