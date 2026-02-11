import { inject } from "@angular/core";
import { HttpHandlerFn, HttpRequest, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";

import { Urls } from "../urls";
import type { ApplicationState } from "../models";

export function osmTokenInterceptor(request: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> {
    const store = inject(Store);
    let token = "";
    try {
        token = store.selectSnapshot((s: ApplicationState) => s.userState).token;
    } catch {
        // store is not ready yet
    }

    if (token && (request.url.includes(Urls.apiBase) || request.url.includes(Urls.osmApi) || request.url.includes(Urls.userApiBase))) {
        request = request.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
    }
    return next(request);
}
