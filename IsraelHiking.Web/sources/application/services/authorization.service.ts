import { Injectable } from "@angular/core";
import { RequestOptionsArgs, Headers } from "@angular/http";
import { LocalStorage } from "ngx-store";
import osmAuth = require("osm-auth");

@Injectable()
export class AuthorizationService {

    @LocalStorage()
    public osmToken: string = null;

    public getHeader = (): RequestOptionsArgs => {
        let options = {} as RequestOptionsArgs;
        if (!this.osmToken) {
            return options;
        }
        options.headers = new Headers();
        options.headers.append("Authorization", `Bearer ${this.osmToken}`);
        return options;
    }

    public setXhrHeader(xhr: XMLHttpRequest) {
        xhr.setRequestHeader("Authorization", `Bearer ${this.osmToken}`);
    }

    public createOSMAuth(options: OSMAuth.OSMAuthOptions): OSMAuth.OSMAuthInstance {
        return new osmAuth(options);
    }

    public createXMLHttpRequest(): XMLHttpRequest
    {
        return new XMLHttpRequest();
    }
}