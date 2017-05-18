import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";
import "rxjs/add/operator/toPromise";

@Injectable()
export class GetTextCatalogService {

    constructor(private http: Http) { };

    strings: {};
    baseLanguage: string;

    setCurrentLanguage(lang: string): void {
        this.baseLanguage = lang;
    }

    getCurrentLanguage(): string {
        return this.baseLanguage;
    }

    getString(string: string, scope?: any, context?: string): string
    {
        return this.strings[string] as string;
    }

    loadRemote(url: string): Promise<Response>
    {
        let promise = this.http.get(url).toPromise();
        promise.then((res) => {
            this.strings = res.json()[this.getCurrentLanguage()];
        });
        return promise;
    }
}