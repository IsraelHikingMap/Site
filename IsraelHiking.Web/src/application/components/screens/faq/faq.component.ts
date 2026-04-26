import { Component, inject, signal } from "@angular/core";
import { MarkdownComponent } from "ngx-markdown";

import { Router } from "@angular/router";

@Component({
    selector: "faq",
    templateUrl: "./faq.component.html",
    imports: [MarkdownComponent]
})
export class FaqComponent {
    public direction = signal<string>("ltr");
    public markdownFilePath = signal<string>("content/faq-en-US.md");

    private readonly router = inject(Router);

    constructor() {
        const language = this.router.url.split("/")[1];
        this.markdownFilePath.set(`content/faq-${language}.md`);
        if (language === "he" || language === "ar") {
            this.direction.set("rtl");
        }
    }
}