import { Component, inject } from "@angular/core";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "faq",
    templateUrl: "./faq.component.html",
    styleUrls: ["./faq.component.scss"]
})
export class FaqComponent {
    public readonly resources = inject(ResourcesService);
}