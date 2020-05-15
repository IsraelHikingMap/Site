import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";

@Injectable()
export class GetTextCatalogService {

    private strings: {};
    private baseLanguage: string;

    constructor(private readonly httpClient: HttpClient) {
        this.strings = {};
    }

    public setCurrentLanguage(lang: string): void {
        this.baseLanguage = lang;
    }

    public getCurrentLanguage(): string {
        return this.baseLanguage;
    }

    public getString(word: string, scope?: any, context?: string): string {
        return this.strings[word] as string || word || "";
    }

    public async loadRemote(url: string): Promise<void> {
        let response = await this.httpClient.get(url).toPromise();
        this.strings = response;
    }
}
