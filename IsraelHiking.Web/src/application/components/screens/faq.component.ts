import { AfterViewInit, Component, inject, viewChildren } from "@angular/core";
import { ResourcesService } from "../../services/resources.service";
import { Store } from "@ngxs/store";
import { ApplicationState } from "application/models";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from "@angular/material/expansion";
import { ActivatedRoute, Router } from "@angular/router";

export type FAQSection = {
    question: string;
    answer: string;
    id: string;
}

@Component({
    selector: "faq",
    templateUrl: "./faq.component.html",
    styleUrls: ["./faq.component.scss"],
    imports: [MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle]
})
export class FaqComponent implements AfterViewInit {
    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);

    public sections: FAQSection[];

    private panels = viewChildren(MatExpansionPanel);

    constructor() {
        this.store.select((s: ApplicationState) => s.configuration.language).pipe(takeUntilDestroyed()).subscribe(() => {
            this.buildSections();
        });
    }

    public ngAfterViewInit(): void {
        this.route.fragment.subscribe(fragment => {
            if (!fragment) { return; }
            const index = this.sections.findIndex(s => s.id === fragment);
            if (index === -1) { return; }
            const panel = this.panels()[index];
            if (!panel) { return; }
            // wait for expansion animation then scroll
            setTimeout(() => {
                panel.open();
                document.getElementById(fragment)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 0);
        });
    }

    private hashQuestion(text: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
        }
        return "q" + Math.abs(hash).toString(36);
    }

    private buildSections(): void {
        this.sections = this.resources.faqContent.split("\n").map(line => {
            const parts = line.split("|");
            const question = parts[0];
            return {
                question,
                answer: parts.slice(1).join("|"),
                id: this.hashQuestion(question)
            };
        });
    }

    public onPanelOpened(id: string): void {
        this.router.navigate(["/faq"], { fragment: id, replaceUrl: true });
    }
}