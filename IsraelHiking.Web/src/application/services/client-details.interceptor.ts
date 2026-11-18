import { HttpHandlerFn, HttpRequest, HttpEvent } from "@angular/common/http";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Device } from "@capacitor/device";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import { Urls } from "../urls";

export const CLIENT_PLATFORM_HEADER = "X-Client-Platform";
export const CLIENT_VERSION_HEADER = "X-Client-Version";
export const CLIENT_DEVICE_ID_HEADER = "X-Device-Id";

/**
 * Only the app has a version of its own, a browser is served by the server it talks to,
 * so it stays empty there. Reading it is asynchronous, hence the cache.
 */
let appVersion = "";
if (environment.isCapacitor) {
    App.getInfo().then(info => appVersion = info.version);
}

/**
 * The device this client runs on - `identifierForVendor` on ios, `ANDROID_ID` on android and a uuid
 * kept in the local storage in a browser. It is reset by uninstalling the app or clearing the browser
 * storage, so a device can come back as a new one, but it never points at a device of a different user.
 * Reading it is asynchronous, hence the cache.
 */
let deviceId = "";
Device.getId().then(id => deviceId = id.identifier);

/**
 * Reports the platform, app version and device to our server, so that they can be logged, added to
 * the OSM changesets it creates and used to count the devices a subscription is used from. A request
 * without these headers is from a client that predates them.
 */
export function clientDetailsInterceptor(request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
    if (Urls.isOwnApiAddress(request.url)) {
        const headers: Record<string, string> = { [CLIENT_PLATFORM_HEADER]: Capacitor.getPlatform() };
        if (appVersion) {
            headers[CLIENT_VERSION_HEADER] = appVersion;
        }
        if (deviceId) {
            headers[CLIENT_DEVICE_ID_HEADER] = deviceId;
        }
        request = request.clone({ setHeaders: headers });
    }
    return next(request);
}
