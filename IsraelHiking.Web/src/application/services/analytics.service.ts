import { DOCUMENT, inject, Injectable, RendererFactory2 } from "@angular/core";

declare let gtag: (event: string, action: string, params: { event_category: string }) => void;

@Injectable()
export class AnalyticsService {
    private document = inject(DOCUMENT);
    private rendererFactory = inject(RendererFactory2);

    initialize() {
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