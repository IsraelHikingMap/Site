import { Injectable } from "@angular/core";
import { RequestOptionsArgs, Headers } from "@angular/http";
import { LocalStorage } from "ngx-store";
import osmAuth = require("osm-auth");

@Injectable()
export class AuthorizationService {

    @LocalStorage()
    public token: string = null;

    constructor() {

    }

    public getHeader = (): RequestOptionsArgs => {
        let options = {} as RequestOptionsArgs;
        if (!this.token) {
            return options;
        }
        options.headers = new Headers();
        options.headers.append("Authorization", `Bearer ${this.token}`);
        return options;
    }

    public setXhrHeader(xhr: XMLHttpRequest) {
        xhr.setRequestHeader("Authorization", `Bearer ${this.token}`);
    }

    public createOSMAuth(options: OSMAuth.OSMAuthOptions): OSMAuth.OSMAuthInstance {
        return new osmAuth(options);
    }

    public createXMLHttpRequest(): XMLHttpRequest
    {
        return new XMLHttpRequest();
    }
}