import { afterNextRender, DOCUMENT, inject, Injector, NgZone, RendererFactory2, Service } from "@angular/core";
import { Store } from "@ngxs/store";
import { FirebaseAnalytics } from "@capacitor-firebase/analytics";
import { AppsFlyer } from "appsflyer-capacitor-plugin";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetFirstActionReportedAction } from "../reducers/configuration.reducer";
import type { ApplicationState } from "../models";

declare let gtag: (event: string, action: string, params: { event_category: string }) => void;

/** The key of the mapeak account in appsflyer, taken from its dashboard under App Settings. */
const APPSFLYER_DEV_KEY = "7pb6uSoqSzb6UbFtEMTzM5";

/** Appsflyer identifies the ios app by its app store id, the way the android app is identified by its package name. */
const IOS_APP_STORE_ID = "6751947875";

/** The container in google tag manager, taken from its workspace under Admin, Install Google Tag Manager. */
const GOOGLE_TAG_MANAGER_ID = "GTM-MSQ848P2";

@Service()
export class AnalyticsService {
    private readonly document = inject(DOCUMENT);
    private readonly rendererFactory = inject(RendererFactory2);
    private readonly ngZone = inject(NgZone);
    private readonly injector = inject(Injector);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    initialize() {
        // Analytics is not needed for the first paint, so it is loaded only once the page has
        // rendered, instead of competing with the app's own scripts and fonts for bandwidth.
        // afterNextRender never runs while prerendering, so this is browser only by construction.
        afterNextRender(() => {
            this.injectGoogleTagScripts();
            this.injectTagManagerScript();
        }, { injector: this.injector });
        if (this.runningContextService.isCapacitor) {
            this.initializeFirebase();
            this.initializeAppsFlyer();
            this.reportUserId();
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

    /**
     * The tag manager's documented snippet is a script in the head plus a noscript iframe in the body, and
     * neither belongs in the markup here - the iframe only serves browsers with javascript turned off, which
     * can not run this app at all, and the script is nothing but the dataLayer push and the loader below.
     * The container is a web one, which has no notion of an install, so the app is left to the sdks that do.
     */
    private injectTagManagerScript() {
        if (this.runningContextService.isCapacitor) {
            return;
        }
        this.ngZone.runOutsideAngular(() => {
            this.pushToDataLayer({ "gtm.start": Date.now(), event: "gtm.js" });
            const renderer = this.rendererFactory.createRenderer(null, null);
            const script = renderer.createElement("script");
            script.src = `https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_MANAGER_ID}`;
            script.async = true;
            renderer.appendChild(this.document.head, script);
        });
    }

    /**
     * The queue a tag manager container reads its events off. It has to exist before the container loads,
     * which is why the loader pushes to it first, and the container replaces it with its own object once
     * it is up - so it is read off the window every time instead of being held on to.
     */
    private pushToDataLayer(event: Record<string, unknown>) {
        const view = this.document.defaultView as (Window & { dataLayer?: Record<string, unknown>[] }) | null;
        if (view == null) {
            return;
        }
        view.dataLayer ??= [];
        view.dataLayer.push(event);
    }

    /**
     * The first call into firebase is what configures it from the google services file, and configuring it
     * is what counts the install - there is nothing else to ask it for. Collection is on by default, so
     * this only makes sure the native sdk is loaded even when nothing is tracked in this session.
     */
    private async initializeFirebase() {
        try {
            await FirebaseAnalytics.setEnabled({ enabled: true });
        } catch (ex) {
            this.loggingService.error(`[Analytics] Failed to initialize firebase: ${(ex as Error).message}`);
        }
    }

    /**
     * Appsflyer is what attributes an install to the campaign that brought it. Since version 7 it starts
     * its session only when asked to, and only once it reports itself ready. An install is reported once
     * in the lifetime of the installation, so there is nothing to retry and a failure is only logged.
     */
    private async initializeAppsFlyer() {
        try {
            await AppsFlyer.init({ devKey: APPSFLYER_DEV_KEY, appId: IOS_APP_STORE_ID });
            await AppsFlyer.registerSessionReadyListener(() => this.startAppsFlyerSession());
        } catch (ex) {
            this.loggingService.error(`[Analytics] Failed to initialize appsflyer: ${(ex as Error).message}`);
        }
    }

    /**
     * The first deliberate thing the user does with the app, reported once in the lifetime of the
     * installation. The ad networks that brought the install in optimize against this event, so it has to
     * be something an interested user does on the first day - a login or a saved route happen too late and
     * too rarely for a campaign to learn from them, and are reported as events of their own instead.
     */
    public reportFirstAction() {
        if (this.store.selectSnapshot((state: ApplicationState) => state.configuration).isFirstActionReported) {
            return;
        }
        this.store.dispatch(new SetFirstActionReportedAction());
        this.trackEvent("Application", "first_action");
    }

    /**
     * Both sdks tie a session's events to an id the app hands them, which is what connects an install to
     * the user it turned into. The osm user id is the only identifier sent - the sdks have their own
     * setters for a name, an email and a phone, and none of them is ever called. Firebase takes a null to
     * forget the user on logout, while appsflyer has no call that unsets an id it was already given.
     */
    private reportUserId() {
        this.store.select((state: ApplicationState) => state.userState.userInfo).subscribe(async (userInfo) => {
            try {
                const id = userInfo?.id?.toString() ?? null;
                await FirebaseAnalytics.setUserId({ userId: id });
                if (id != null) {
                    await AppsFlyer.setCustomerUserId({ customerId: id });
                }
            } catch (ex) {
                this.loggingService.error(`[Analytics] Failed to report the user id: ${(ex as Error).message}`);
            }
        });
    }

    /** @see initializeAppsFlyer */
    private async startAppsFlyerSession() {
        try {
            await AppsFlyer.start();
        } catch (ex) {
            this.loggingService.error(`[Analytics] Failed to start the appsflyer session: ${(ex as Error).message}`);
        }
    }

    trackEvent(category: string, action: string) {
        try {
            gtag("event", action, {
                event_category: category
            });
        } catch {
            // ignore
        }
        if (this.runningContextService.isCapacitor) {
            this.trackNativeEvent(category, action);
        } else {
            this.pushToDataLayer({ event: action, event_category: category });
        }
    }

    /**
     * The google tag in the page is not the one a campaign is measured against on a device, so an event
     * is sent to the native sdks as well. Both of them only accept a name of letters, digits and
     * underscores, while the app tracks human readable labels like "Plan & Explore", hence the rewrite.
     */
    private async trackNativeEvent(category: string, action: string) {
        const eventName = action.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
        try {
            await FirebaseAnalytics.logEvent({ name: eventName, params: { event_category: category } });
            await AppsFlyer.logEvent({ eventName, eventValues: { event_category: category } });
        } catch (ex) {
            this.loggingService.debug(`[Analytics] Failed to track ${eventName}: ${(ex as Error).message}`);
        }
    }
}
