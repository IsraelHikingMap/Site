import { inject, Injectable } from "@angular/core";
import { Title } from "@angular/platform-browser";

@Injectable()
export class IHMTitleService {
    
    private readonly titleService = inject(Title);

    public clear() {
        this.set();
    }

    public set(message = "") {
        const prefix = message ? `${message} | ` : "";
        const s = `${prefix}Israel Hiking Map`;
        this.titleService.setTitle(s);
    }

}
