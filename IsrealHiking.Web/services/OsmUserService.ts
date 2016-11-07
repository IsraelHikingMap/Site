declare var osmAuth: Function;

namespace IsraelHiking.Services {

    interface IOsmAuthService {
        authenticated(): boolean;
        xhr(options: Object, callback: Function);
        logout(): void;
    }

    export class OsmUserService {
        private oauth;
        private x2Js: IX2JS;
        private $q: angular.IQService;

        public displayName: string;
        public imageUrl: string;
        public traces: any[];
        public shares: any[];

        constructor($q: angular.IQService) {
            this.$q = $q;
            this.oauth = osmAuth({
                oauth_consumer_key: "H5Us9nv9eDyFpKbBTiURf7ZqfdBArNddv10n6R6U",
                oauth_secret: "ccYaQUKLz26XEzbNd8uWoQ6HwbcnrUUp8milXnXG",
                auto: true, // show a login form if the user is not authenticated and you try to do a call
                landing: "controllers/oauth-close-window.html"
            }) as IOsmAuthService;
            if (this.oauth.authenticated()) {
                this.getDetails();
            }
            this.x2Js = new X2JS();
            this.traces = [];
            this.shares = [];
        }

        public logout = () => {
            this.oauth.logout();
        }

        public isLoggedIn = (): boolean => {
            return this.oauth.authenticated();
        }

        public login = (): angular.IPromise<{}> => {
            return this.getDetails();
        }

        private getDetails = (): angular.IPromise<{}> => {
            let deferred = this.$q.defer();
            this.oauth.xhr({
                method: "GET",
                path: "/api/0.6/user/details"
            }, (detailsError, details) => {
                if (detailsError) {
                    deferred.reject(detailsError);
                    return;
                }
                let detailJson = this.x2Js.xml2json(details) as any;
                this.displayName = detailJson.osm.user._display_name;
                this.imageUrl = detailJson.osm.user.img._href;
                this.oauth.xhr({
                    method: "GET",
                    path: "/api/0.6/user/gpx_files"
                }, (tracesError, traces) => {
                    if (tracesError) {
                        deferred.reject(tracesError);
                        return;
                    }
                    let tracesJson = this.x2Js.xml2json(traces) as any;
                    this.traces = [];
                    for (let traceJson of tracesJson.osm.gpx_file) {
                        let url = `https://www.openstreetmap.org/user/${traceJson._user}/traces/${traceJson._id}`; 
                        this.traces.push({
                            fileName: traceJson._name,
                            description: traceJson.description,
                            url: url,
                            imageUrl: url + "/icon"
                        });
                    }
                    deferred.resolve();
                });

                // HM TODO: get shares from API by osm user id
            });
            return deferred.promise;
        }
    }
}