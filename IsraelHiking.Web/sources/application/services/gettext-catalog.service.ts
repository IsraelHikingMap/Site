import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import "rxjs/add/operator/toPromise";

@Injectable()
export class GetTextCatalogService {

    constructor(private httpClient: HttpClient) {
        this.strings = {};
    }

    private strings: {};
    private baseLanguage: string;

    public setCurrentLanguage(lang: string): void {
        this.baseLanguage = lang;
    }

    public getCurrentLanguage(): string {
        return this.baseLanguage;
    }

    public getString(word: string, scope?: any, context?: string): string
    {
        return this.strings[word] as string || word || "";
    }

    public async loadRemote(url: string): Promise<any>
    {
        let response = await this.httpClient.get(url).toPromise();
        this.strings = response[this.getCurrentLanguage()];
    }
}