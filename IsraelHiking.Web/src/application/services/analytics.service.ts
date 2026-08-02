import { isPlatformBrowser } from "@angular/common";
import { DOCUMENT, inject, Injectable, NgZone, PLATFORM_ID, RendererFactory2 } from "@angular/core";

declare let gtag: (event: string, action: string, params: { event_category: string }) => void;

@Injectable()
export class AnalyticsService {
    private readonly document = inject(DOCUMENT);
    private readonly rendererFactory = inject(RendererFactory2);
    private readonly ngZone = inject(NgZone);
    private readonly platformId = inject(PLATFORM_ID);

    initialize() {
        if (!isPlatformBrowser(this.platformId)) return;

        // Analytics is not needed for the first paint, so it is loaded once the browser is idle
        // instead of competing with the fonts and images for bandwidth while the page is rendering.
        this.whenIdle(() => this.injectGoogleTagScripts());
    }

    private whenIdle(callback: () => void) {
        const scheduler = (window as any).requestIdleCallback as ((cb: () => void, options?: { timeout: number }) => void) | undefined;
        if (scheduler) {
            scheduler(callback, { timeout: 5000 });
        } else {
            setTimeout(callback, 3000);
        }
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