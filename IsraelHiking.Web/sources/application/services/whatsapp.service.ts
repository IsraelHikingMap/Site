import { Injectable } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";

import { RunningContextService } from "./running-context.service";

@Injectable()
export class WhatsAppService {

    constructor(private readonly sanitizer: DomSanitizer,
                private readonly runningContextService: RunningContextService) { }

    public getUrl(title: string, escaped: string): SafeUrl {
        let titleAndLink = `${title}: ${escaped}`;
        if (this.runningContextService.isMobile) {
            return this.sanitizer.bypassSecurityTrustUrl(`whatsapp://send?text=${titleAndLink}`);
        }
        return `https://web.whatsapp.com/send?text=${titleAndLink}`;
    }
}
