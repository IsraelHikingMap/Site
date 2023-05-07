import { Injectable } from "@angular/core";
import { HttpInterceptor, HttpHandler, HttpRequest, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";

import { Urls } from "../urls";
import type { ApplicationState } from "../models/models";

@Injectable()
export class OsmTokenInterceptor implements HttpInterceptor {
    constructor(private readonly store: Store) { }

    public intercept = (request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> => {
        let token = "";
        try {
            token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
        } catch (ex) {
            // store is not ready yet
        }

        if (token && request.url.indexOf(Urls.apiBase) !== -1) {
            request = request.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`
                }
            });
        }
        return next.handle(request);
    };
}
