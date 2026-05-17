import { RenderMode, ServerRoute } from "@angular/ssr";
import { AVAILABLE_LANGUAGES } from "../application/reducers/initial-state";

export const serverRoutes: ServerRoute[] = [
    {
        path: "about",
        renderMode: RenderMode.Prerender
    },
    {
        path: ":lang/faq",
        renderMode: RenderMode.Prerender,
        async getPrerenderParams() {
            return AVAILABLE_LANGUAGES.map(lang => ({ lang: lang.code }));
        }
    },
    {
        path: "privacy-policy",
        renderMode: RenderMode.Prerender
    },
    {
        path: "attribution",
        renderMode: RenderMode.Prerender
    },
    {
        path: "**",
        renderMode: RenderMode.Client,
    }
];
