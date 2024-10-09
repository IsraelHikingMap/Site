import { inject, Injectable } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";

import { RunningContextService } from "./running-context.service";

@Injectable()
export class WhatsAppService {

    private readonly sanitizer = inject(DomSanitizer);
    private readonly runningContextService = inject(RunningContextService);

    public getUrl(title: string, escaped: string): SafeUrl {
        const titleAndLink = `${title}: ${escaped}`;
        if (this.runningContextService.isMobile) {
            return this.sanitizer.bypassSecurityTrustUrl(`whatsapp://send?text=${titleAndLink}`);
        }
        return `https://web.whatsapp.com/send?text=${titleAndLink}`;
    }
}
