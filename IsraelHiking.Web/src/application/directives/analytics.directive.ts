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
    selector: "[analyticsOn]"
})
// HM TODO: rename this!
export class AnalyticsDirective implements AfterViewInit {
    readonly analyticsOn = input<string>()
    readonly analyticsLabel = input.required<string>()
    readonly analyticsCategory = input.required<string>()

    private readonly renderer = inject(Renderer2);
    private readonly el = inject(ElementRef);
    private readonly analyticsService = inject(AnalyticsService);

    ngAfterViewInit() {
        this.renderer.listen(this.el.nativeElement, this.analyticsOn(), () => {
            this.analyticsService.trackEvent(this.analyticsCategory(), this.analyticsLabel());
        });

    }
}