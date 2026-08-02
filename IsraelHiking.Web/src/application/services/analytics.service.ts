import { afterNextRender, DOCUMENT, inject, Injectable, Injector, NgZone, RendererFactory2 } from "@angular/core";

declare let gtag: (event: string, action: string, params: { event_category: string }) => void;

@Injectable()
export class AnalyticsService {
    private readonly document = inject(DOCUMENT);
    private readonly rendererFactory = inject(RendererFactory2);
    private readonly ngZone = inject(NgZone);
    private readonly injector = inject(Injector);

    initialize() {
        // Analytics is not needed for the first paint, so it is loaded only once the page has
        // rendered, instead of competing with the app's own scripts and fonts for bandwidth.
        // afterNextRender never runs while prerendering, so this is browser only by construction.
        afterNextRender(() => this.injectGoogleTagScripts(), { injector: this.injector });
    }

    private injectGoogleTagScripts() {
        this.ngZone.runOutsideAngular(() => {
            const renderer = this.rendererFactory.createRenderer(null, null);
            const script = renderer.createElement("script");
            script.src = "https://www.googletagmanager.com/gtag/js?id=G-H495KRZ5CD";
            script.async = true;
            renderer.appendChild(this.document.head, script);

            const initScript = renderer.createElement("script");
            initScript.text = `
                window.dataLayer = window.dataLayer || [];
                function gtag() { dataLayer.push(arguments); }
                gtag('js', new Date());
                gtag('config', 'G-H495KRZ5CD');
            `;
            renderer.appendChild(this.document.head, initScript);
        });
    }

    trackEvent(category: string, action: string) {
        try {
            gtag("event", action, {
                event_category: category
            });
        } catch {
            // ignore
        }
    }
}