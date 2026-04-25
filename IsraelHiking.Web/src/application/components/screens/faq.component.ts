import { AfterViewInit, Component, DestroyRef, inject, signal, viewChildren } from "@angular/core";
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
    imports: [MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle]
})
export class FaqComponent implements AfterViewInit {
    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    public sections = signal<FAQSection[]>([]);

    private panels = viewChildren(MatExpansionPanel);

    constructor() {
        this.store.select((state: ApplicationState) => state.configuration.language).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.buildSections();
            this.openFaqItem(this.route.snapshot.fragment);
        });
    }

    public ngAfterViewInit(): void {
        this.route.fragment.subscribe(fragment => this.openFaqItem(fragment));
    }

    private openFaqItem(fragment: string | null): void {
        if (!fragment) { return; }
        const index = this.sections().findIndex(s => s.id === fragment);
        debugger;
        if (index === -1) { return; }
        setTimeout(() => {
            // wait for expansion panel to appear
            const panel = this.panels()[index];
            if (!panel) { return; }
            panel.open();
            document.getElementById(fragment)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
    }

    private hashQuestion(text: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
        }
        return "q" + Math.abs(hash).toString(36);
    }

    private buildSections(): void {
        if (!this.resources.faqContent) { return; }
        this.sections.set(this.resources.faqContent.split("\n").map(line => {
            const parts = line.split("|");
            const question = parts[0];
            return {
                question,
                answer: parts.slice(1).join("|"),
                id: this.hashQuestion(question)
            };
        }));
    }

    public onPanelOpened(id: string): void {
        this.router.navigate(["/faq"], { fragment: id, replaceUrl: true });
    }
}