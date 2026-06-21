import { DOCUMENT, inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";

import type { ApplicationState, Theme } from "../models";

@Injectable()
export class ThemeService {
    public static readonly DARK_THEME_CLASS = "dark-theme";

    private readonly document = inject(DOCUMENT);
    private readonly store = inject(Store);

    public initialize() {
        this.store.select((state: ApplicationState) => state.configuration.theme)
            .subscribe((theme: Theme) => this.applyTheme(theme));
    }

    private applyTheme(theme: Theme) {
        const body = this.document.body;
        if (body == null) {
            return;
        }
        if (theme === "dark") {
            body.classList.add(ThemeService.DARK_THEME_CLASS);
        } else {
            body.classList.remove(ThemeService.DARK_THEME_CLASS);
        }
    }
}
