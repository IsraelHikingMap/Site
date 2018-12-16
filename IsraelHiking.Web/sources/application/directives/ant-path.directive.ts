import { Directive, AfterViewInit, OnDestroy } from "@angular/core";
import { SourceVectorComponent, StyleStrokeComponent } from "ngx-openlayers";

@Directive({
    selector: "[antPath]",
})
export class AntPathDirective implements AfterViewInit, OnDestroy {

    private intervalId: any;

    constructor(private readonly elementRef: StyleStrokeComponent,
        private readonly host: SourceVectorComponent) { }

    public ngAfterViewInit(): void {
        let stroke = this.elementRef.instance;
        const dash = stroke.getLineDash();
        let length = dash.reduce((a, b) => a + b, 0);

        this.intervalId = setInterval(() => {
            const offset = (stroke as any).getLineDashOffset() || 0;
            (stroke as any).setLineDashOffset(offset - 4 % length);
            this.host.instance.refresh();
        }, 60);
    }

    public ngOnDestroy(): void {
        clearInterval(this.intervalId);
    }
}