import { inject, Pipe, PipeTransform } from "@angular/core";
import { ResourcesService } from "../services/resources.service";

@Pipe({
    name: "distance",
    standalone: true
})
export class DistancePipe implements PipeTransform {
    private readonly resources = inject(ResourcesService);

    transform(value: number): string {
        if (value == null) {
            return "0";
        }
        if (Math.abs(value) > 1000) {
            return (value / 1000.0).toFixed(2) + " " + this.resources.kmUnit;
        }
        return `\u200E${value.toFixed(0)} ${this.resources.meterUnit}`; // \u200E is for negative numbers to prevent RTL issues.
    }
}