import {
    Directive,
    Renderer2,
    AfterViewInit,
    ElementRef,
    input,
    inject
} from "@angular/core";

import { AnalyticsService } from "../services/analytics.service";

@Directive({
    selector: "[angulartics2On]"
})
// HM TODO: rename this!
export class Angulartics2OnModule implements AfterViewInit {
    angulartics2On = input<string>()
    angularticsAction = input.required<string>()
    angularticsCategory = input.required<string>()

    private readonly renderer = inject(Renderer2);
    private readonly el = inject(ElementRef);
    private readonly analyticsService = inject(AnalyticsService);

    ngAfterViewInit() {
        this.renderer.listen(this.el.nativeElement, this.angulartics2On(), () => {
            this.analyticsService.trackEvent(this.angularticsCategory(), this.angularticsAction());
        });

    }
}