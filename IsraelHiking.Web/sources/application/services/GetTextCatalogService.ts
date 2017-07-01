import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";
import "rxjs/add/operator/toPromise";

@Injectable()
export class GetTextCatalogService {

    constructor(private http: Http) { };

    private strings: {};
    private baseLanguage: string;

    public setCurrentLanguage(lang: string): void {
        this.baseLanguage = lang;
    }

    public getCurrentLanguage(): string {
        return this.baseLanguage;
    }

    public getString(string: string, scope?: any, context?: string): string
    {
        return this.strings[string] as string || "";
    }

    public loadRemote(url: string): Promise<Response>
    {
        let promise = this.http.get(url).toPromise();
        promise.then((res) => {
            this.strings = res.json()[this.getCurrentLanguage()];
        });
        return promise;
    }
}