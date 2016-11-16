namespace IsraelHiking.Services {
    export class AuthorizationInterceptorService {
        $q: angular.IQService;
        $injector: angular.auto.IInjectorService;
        localStorageService: angular.local.storage.ILocalStorageService;

        constructor($q: angular.IQService,
            $injector: angular.auto.IInjectorService,
            localStorageService: angular.local.storage.ILocalStorageService) {

            this.$q = $q;
            this.$injector = $injector;
            this.localStorageService = localStorageService;
        }

        request = (config) => {
            config.headers = config.headers || {};

            var authData = this.localStorageService.get(OsmUserService.AUTHORIZATION_DATA_KEY) as string;
            if (authData) {
                config.headers.Authorization = `Bearer ${authData}`;
            }
            return config;
        }

        responseError = (rejection) => {
            if (rejection.status !== 401) {
                return this.$q.reject(rejection);
            }
            let toastr = this.$injector.get(Strings.Services.toastr) as Toastr;
            let resourcesService = this.$injector.get(Strings.Services.resourcesService) as Services.ResourcesService;
            let osmUserService = this.$injector.get(Strings.Services.osmUserService) as Services.OsmUserService;
            toastr.error(resourcesService.unableToLogin);
            osmUserService.logout();
            return this.$q.reject(rejection);
        }
    }
}