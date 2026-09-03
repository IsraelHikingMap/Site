import { HttpHandlerFn, HttpRequest, HttpEvent } from "@angular/common/http";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import { Urls } from "../urls";

export const CLIENT_PLATFORM_HEADER = "X-Client-Platform";
export const CLIENT_VERSION_HEADER = "X-Client-Version";

/**
 * Only the app has a version of its own, a browser is served by the server it talks to,
 * so it stays empty there. Reading it is asynchronous, hence the cache.
 */
let appVersion = "";
if (environment.isCapacitor) {
    App.getInfo().then(info => appVersion = info.version);
}

/**
 * Reports the platform and app version to our server, so that they can be logged and added to
 * the OSM changesets it creates. A request without these headers is from a client that predates them.
 */
export function clientDetailsInterceptor(request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
    if (Urls.isOwnApiAddress(request.url)) {
        const headers: Record<string, string> = { [CLIENT_PLATFORM_HEADER]: Capacitor.getPlatform() };
        if (appVersion) {
            headers[CLIENT_VERSION_HEADER] = appVersion;
        }
        request = request.clone({ setHeaders: headers });
    }
    return next(request);
}
