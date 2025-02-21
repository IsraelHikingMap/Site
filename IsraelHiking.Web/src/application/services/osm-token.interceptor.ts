import { inject, Injectable } from "@angular/core";
import { HttpInterceptor, HttpHandler, HttpRequest, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";

import { Urls } from "../urls";
import type { ApplicationState } from "../models/models";

@Injectable()
export class OsmTokenInterceptor implements HttpInterceptor {
    
    private readonly store = inject(Store);

    public intercept = (request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> => {
        let token = "";
        try {
            token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
        } catch {
            // store is not ready yet
        }

        if (token && (request.url.includes(Urls.apiBase) || request.url.includes(Urls.osmApi))) {
            request = request.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`
                }
            });
        }
        return next.handle(request);
    };
}
