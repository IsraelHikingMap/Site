import { Directive, AfterViewInit, OnDestroy, NgZone, ElementRef, Input } from "@angular/core";
import { MapComponent } from "ngx-mapbox-gl";
import { Subscription } from "rxjs";

@Directive({
    selector: "[antPath]",
})
export class AntPathDirective implements AfterViewInit, OnDestroy {

    @Input()
    antPathDashLength: number;

    @Input()
    antPathDashGap: number;

    private intervalId: any;
    private subscription: Subscription;

    constructor(private readonly elementRef: ElementRef,
        private readonly ngZone: NgZone,
        private readonly host: MapComponent) { }

    public ngAfterViewInit(): void {

        const dashLength = this.antPathDashLength;
        const gapLength = this.antPathDashGap;

        // We divide the animation up into 40 steps to make careful use of the finite space in
        // LineAtlas
        const steps = 40;
        // A # of steps proportional to the dashLength are devoted to manipulating the dash
        const dashSteps = steps * dashLength / (gapLength + dashLength);
        // A # of steps proportional to the gapLength are devoted to manipulating the gap
        const gapSteps = steps - dashSteps;
        let step = steps;

        this.subscription = this.host.load.subscribe(() => {
            this.ngZone.runOutsideAngular(() => {
                this.intervalId = setInterval(() => {
                    if (this.host.mapInstance == null) {
                        return;
                    }
                    step = (step - 1);
                    if (step < 0) {
                        step = steps;
                    }

                    let dashStep, dash1, gap1, dash2, gap2;
                    if (step < dashSteps) {
                        dashStep = step / dashSteps;
                        dash1 = (1 - dashStep) * dashLength;
                        gap1 = gapLength;
                        dash2 = dashStep * dashLength;
                        gap2 = 0;
                    } else {
                        dashStep = (step - dashSteps) / (gapSteps);
                        dash1 = 0;
                        gap1 = (1 - dashStep) * gapLength;
                        dash2 = dashLength;
                        gap2 = dashStep * gapLength;
                    }
                    this.host.mapInstance.setPaintProperty(this.elementRef.nativeElement.id,
                        "line-dasharray",
                        [dash1, gap1, dash2, gap2]);
                }, 50);
            });
        });
    }

    public ngOnDestroy(): void {
        clearInterval(this.intervalId);
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}