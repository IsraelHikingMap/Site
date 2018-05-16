import { Injectable } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import * as L from "leaflet";

@Injectable()
export class WhatsAppService {

    constructor(private readonly sanitizer: DomSanitizer) {  }

    public getUrl(title: string, escaped: string): SafeUrl {
        let titleAndLink = `${title}: ${escaped}`;
        if (L.Browser.mobile) {
            return this.sanitizer.bypassSecurityTrustUrl(`whatsapp://send?text=${titleAndLink}`);
        }
        return `https://web.whatsapp.com/send?text=${titleAndLink}`;
    }
}