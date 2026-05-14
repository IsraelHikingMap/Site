import { Component, inject, signal } from "@angular/core";
import { MarkdownComponent } from "ngx-markdown";
import { skip } from "rxjs";

import { Router } from "@angular/router";
import { Store } from "@ngxs/store";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApplicationState } from "../../models";

@Component({
    selector: "faq",
    templateUrl: "./faq.component.html",
    imports: [MarkdownComponent]
})
export class FaqComponent {
    public direction = signal<string>("ltr");
    public markdownFilePath = signal<string>("content/faq/en-US.md");

    private readonly router = inject(Router);
    private readonly store = inject(Store);

    constructor() {
        this.loadMarkdownFile(this.router.url.split("/")[1]);
        this.store.select((state: ApplicationState) => state.configuration.language).pipe(takeUntilDestroyed(), skip(1)).subscribe((language) => {
            this.router.navigate([`${language.code}/faq`]);
            this.loadMarkdownFile(language.code);
        });
    }

    private loadMarkdownFile(languageCode: string) {
        this.markdownFilePath.set(`content/faq/${languageCode}.md`);
        if (languageCode === "he" || languageCode === "ar") {
            this.direction.set("rtl");
        } else {
            this.direction.set("ltr");
        }
    }
}