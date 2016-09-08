// link to translations: https://translate.zanata.org/iteration/view/IsraelHiking/Main
namespace IsraelHiking.Services {

    export interface ILocale {
        languageCode: string;
        rtl: boolean;
    }

    export class ResourcesService {
        private gettextCatalog: angular.gettext.gettextCatalog;
        public direction: string;

        // all the strings //
        /////////////////////
        public about: string;
        public help: string;
        public legend: string;



        constructor(gettextCatalog: angular.gettext.gettextCatalog) {
            this.gettextCatalog = gettextCatalog;
            this.setRtl(false);
        }

        private setRtl = (rtl: boolean) => {
            if (rtl) {
                this.direction = "rtl";
            } else {
                this.direction = "ltr";
            }
        }

        public changeLanguage = (locale: ILocale): angular.IPromise<any> => {
            this.setRtl(locale.rtl);
            this.gettextCatalog.setCurrentLanguage(locale.languageCode);

            return this.gettextCatalog.loadRemote(Common.Urls.translations + locale.languageCode + ".json")
                .then(() => {
                    this.about = this.gettextCatalog.getString("About");
                    this.help = this.gettextCatalog.getString("Help");
                    this.legend = this.gettextCatalog.getString("Legend");
                });
        }
    }
}