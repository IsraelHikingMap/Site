import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

@Injectable()
export class GetTextCatalogService {

    private strings: Record<string, string> = {};
    private baseLanguage: string;

    private readonly httpClient = inject(HttpClient);

    public setCurrentLanguage(lang: string): void {
        this.baseLanguage = lang;
    }

    public getCurrentLanguage(): string {
        return this.baseLanguage;
    }

    public getString(word: string): string {
        return this.strings[word] as string || word || "";
    }

    public async loadRemote(url: string): Promise<void> {
        const response = await firstValueFrom(this.httpClient.get<Record<string, string>>(url));
        this.strings = response;
    }
}
