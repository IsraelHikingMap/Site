import { Component, input } from "@angular/core";

import type { DeviceProvider } from "../services/device-providers/device-provider";

/**
 * A device service's app icon followed by its name, sized by the height given to the element.
 */
@Component({
    selector: "device-logo",
    template: `
        <img [src]="provider().icon" alt="" class="h-full aspect-square rounded-[22%]">
        <span class="font-medium" dir="ltr">{{provider().displayName}}</span>
    `,
    host: { class: "inline-flex items-center gap-2" }
})
export class DeviceLogoComponent {
    public readonly provider = input.required<DeviceProvider>();
}
