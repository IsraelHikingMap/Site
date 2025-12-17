import {
    Directive,
    Renderer2,
    AfterViewInit,
    ElementRef,
    input,
    inject,
    NgZone
} from "@angular/core";

declare let gtag: Function;

@Directive({
    selector: "[angulartics2On]"
})
export class Angulartics2OnModule implements AfterViewInit {
    angulartics2On = input<string>()
    angularticsAction = input.required<string>()
    angularticsCategory = input.required<string>()

    private readonly renderer = inject(Renderer2);
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    constructor() { }

    ngAfterViewInit() {
        this.renderer.listen(this.el.nativeElement, this.angulartics2On(), () => {
            this.ngZone.runOutsideAngular(() => {
                try {
                    gtag("event", this.angularticsAction(), {
                        event_category: this.angularticsCategory(),
                    });
                } catch {
                    // ignore
                }
            });
        });

    }
}