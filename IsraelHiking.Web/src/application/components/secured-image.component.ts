import { Component, OnChanges, inject, input } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable } from "rxjs";
import { switchMap, map } from "rxjs/operators";
import { AsyncPipe } from "@angular/common";

@Component({
    selector: "secured-image",
    template: `
    <img [src]="dataUrl$|async" class="w-full"/>
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

    // this stream will contain the actual url that our img tag will load
    // everytime the src changes, the previous call would be canceled and the
    // new resource would be loaded
    dataUrl$ = this.src$.pipe(switchMap(url => this.loadImage(url)));

    private readonly httpClient = inject(HttpClient);
    private readonly domSanitizer = inject(DomSanitizer);

    constructor() { }

    public ngOnChanges(): void {
        this.src$.next(this.src());
    }

    private loadImage(url: string): Observable<any> {
        return this.httpClient
            // load the image as a blob
            .get(url, { responseType: "blob" })
            // create an object url of that blob that we can use in the src attribute
            .pipe(map(e => this.domSanitizer.bypassSecurityTrustUrl(URL.createObjectURL(e))));
    }
}
