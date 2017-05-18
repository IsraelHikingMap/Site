import { Directive, ElementRef, Input, Output, OnChanges, OnInit, EventEmitter, DoCheck, IterableDiffers, IterableDiffer } from "@angular/core";

@Directive({
    selector: "[google-chart]",
})
export class GoogleChartDirective implements OnChanges, OnInit, DoCheck {

    private element: HTMLElement;
    @Input()
    public chartType: string;
    @Input()
    public chartOptions: Object;
    @Input()
    public chartData: google.visualization.DataObject;
    @Input()
    public chartView: string[];

    @Output()
    public onWrapperReady = new EventEmitter();

    @Output()
    public afterUpdate = new EventEmitter();

    private static loaded: boolean = false;
    private chartWrapper: google.visualization.ChartWrapper;
    private dataObjectRowDiffer: IterableDiffer<google.visualization.DataObjectRow>;

    constructor(element: ElementRef,
        iterableDiffer: IterableDiffers) {
        this.dataObjectRowDiffer = iterableDiffer.find([]).create<google.visualization.DataObjectRow>(null);

        this.element = element.nativeElement;
    }

    public ngOnInit() {
        google.load("visualization", "1.0", { "packages": ["corechart"], callback: () => { this.onLoadCallback(); } });
        // this doesn"t work for some reason... :-/
        //google.charts.load("current", { packages: ["corechart"] });
        //google.charts.setOnLoadCallback(() => { this.onLoadCallback(); });
    }

    public ngOnChanges() {
        if (!GoogleChartDirective.loaded) {
            return;
        }
        this.update();
    }

    public ngDoCheck() {
        let dataObjectChanges = this.dataObjectRowDiffer.diff(this.chartData.rows);
        if (dataObjectChanges) {
            this.update();
        }
    }

    private onLoadCallback = () => {
        this.chartWrapper = new google.visualization.ChartWrapper({
            chartType: this.chartType,
            dataTable: this.chartData,
            options: this.chartOptions || {},
            view: this.chartView
        });
        this.chartWrapper.draw(this.element);
        this.chartWrapper.setContainerId(this.element.id);
        GoogleChartDirective.loaded = true;
        this.onWrapperReady.emit(this.chartWrapper);
    }

    private update() {
        if (GoogleChartDirective.loaded)
        {
            this.chartWrapper.setChartType(this.chartType);
            this.chartWrapper.setDataTable(this.chartData as any);
            this.chartWrapper.setView(JSON.stringify(this.chartView));
            this.chartWrapper.setOptions(this.chartOptions);
            this.chartWrapper.draw();
            this.afterUpdate.emit();
        }
    }
}