import { Injectable } from "@angular/core";
import { RequestOptionsArgs, Headers } from "@angular/http";
import { LocalStorage } from "angular2-localstorage";

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
}