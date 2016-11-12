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
        private $http: angular.IHttpService;

        public displayName: string;
        public imageUrl: string;
        public changeSets: number;
        public traces: any[];
        public shares: Common.SiteUrl[];
        public userId: string;

        constructor($q: angular.IQService,
            $http: angular.IHttpService) {
            this.$q = $q;
            this.$http = $http;

            this.oauth = osmAuth({
                oauth_consumer_key: "H5Us9nv9eDyFpKbBTiURf7ZqfdBArNddv10n6R6U",
                oauth_secret: "ccYaQUKLz26XEzbNd8uWoQ6HwbcnrUUp8milXnXG",
                auto: true, // show a login form if the user is not authenticated and you try to do a call
                landing: "controllers/oauth-close-window.html"
            }) as IOsmAuthService;
            if (this.oauth.authenticated()) {
                this.refreshDetails();
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
            return this.refreshDetails();
        }

        public getSiteUrlPostfix(id: string) {
            return `/#!/?s=${id}`;
        }

        public refreshDetails = (): angular.IPromise<{}> => {
            let deferred = this.$q.defer();
            var sharesPromise = null;
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
                if (detailJson.osm.user.img && detailJson.osm.user.img._href) {
                    this.imageUrl = detailJson.osm.user.img._href;
                }
                this.changeSets = detailJson.osm.user.changesets._count;
                this.userId = detailJson.osm.user._id;
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
                sharesPromise = this.$http.get(Common.Urls.userUrls + this.userId).then((response: { data: Common.SiteUrl[] }) => {
                    this.shares = response.data;
                });
            });
            return this.$q.all([deferred.promise, this.$q.when(sharesPromise)]);
        }
    }
}