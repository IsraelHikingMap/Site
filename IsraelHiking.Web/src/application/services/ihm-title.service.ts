import { Injectable } from "@angular/core";
import { ResourcesService } from "./resources.service";
import { Title } from "@angular/platform-browser";

@Injectable()
export class IHMTitleService {
    constructor(private readonly resources: ResourcesService,
        private titleService: Title,
    ) {
    }

    public clear() {
        this.set();
    }

    public set(message: string = "") {
        const prefix = message ? `${message} | ` : "";
        const s = `${prefix}Israel Hiking Map`;
        this.titleService.setTitle(s);
    }

}
