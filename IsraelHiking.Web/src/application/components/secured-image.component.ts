import { Component, ElementRef, OnChanges, inject, input } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable } from "rxjs";
import { switchMap, map, filter, take } from "rxjs/operators";
import { AsyncPipe } from "@angular/common";

@Component({
    selector: "secured-image",
    template: `
    <img [src]="dataUrl$|async" loading="lazy" alt="" class="float-end w-1/3 h-auto object-cover block ps-2 rounded-2xl"/>
  `,
    imports: [AsyncPipe]
})
export class SecuredImageComponent implements OnChanges {
    // This code block just creates an rxjs stream from the src
    // this makes sure that we can handle source changes
    // or even when the component gets destroyed
    // So basically turn src into src$
    public src = input<string>("");

    private src$ = new BehaviorSubject(this.src());

    private isVisible$ = new BehaviorSubject<boolean>(false);
    private el = inject(ElementRef);

    // this stream will contain the actual url that our img tag will load
    // everytime the src changes, the previous call would be canceled and the
    // new resource would be loaded, it will do it when the component is visible and only once
    dataUrl$ = this.isVisible$.pipe(
        filter(visible => visible), // Wait until visible
        take(1),                    // Load only once per component lifecycle
        switchMap(() => this.src$),
        switchMap(url => this.loadImage(url))
    );

    private readonly httpClient = inject(HttpClient);
    private readonly domSanitizer = inject(DomSanitizer);

    constructor() { }

    public ngOnChanges(): void {
        this.src$.next(this.src());
    }

    ngAfterViewInit() {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                this.isVisible$.next(true);
                observer.disconnect(); // Cleanup immediately after visibility detected
            }
        }, { rootMargin: '100px' }); // Load slightly before it hits the screen

        observer.observe(this.el.nativeElement);
    }

    private loadImage(url: string): Observable<any> {
        return this.httpClient
            // load the image as a blob
            .get(url, { responseType: "blob" })
            // create an object url of that blob that we can use in the src attribute
            .pipe(map(e => this.domSanitizer.bypassSecurityTrustUrl(URL.createObjectURL(e))));
    }
}
