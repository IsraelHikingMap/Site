import { Directive, Output, ElementRef, Renderer2, OnDestroy, EventEmitter, NgZone } from "@angular/core";
import { Camera } from "@ionic-native/camera/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";

import { environment } from "../../environments/environment";
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
                private readonly camera: Camera,
                private readonly statusBar: StatusBar,
                private readonly renderer: Renderer2,
                private readonly ngZone: NgZone,
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
                confirmAction: () => this.getPicture(this.camera.PictureSourceType.CAMERA, true),
                declineAction: () => this.getPicture(this.camera.PictureSourceType.PHOTOLIBRARY, false),
            });
        });
    }

    private async getPicture(sourceType: number, saveToPhotoAlbum: boolean) {
        let base64ImageData = await this.camera.getPicture({
            destinationType: this.camera.DestinationType.DATA_URL,
            sourceType,
            saveToPhotoAlbum,
            correctOrientation: true
        });
        this.statusBar.overlaysWebView(true);
        this.statusBar.overlaysWebView(false);
        let blob = await fetch(`data:image/jpeg;base64,${base64ImageData}`).then(r => r.blob());
        let changeEvent = {
            dataTransfer: {
                files: [blob]
            },
            target: {}
        };
        this.ngZone.run(() => this.changed.next(changeEvent));
    }

    ngOnDestroy(): void {
        this.listenFunction();
    }
}
