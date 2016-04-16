module IsraelHiking.Services {

    export class SidebarService {
        private $compile: angular.ICompileService;
        public currentDirective: string;
        public isVisible: boolean;

        constructor($compile: angular.ICompileService) {
            this.$compile = $compile;
            this.hide();
        }

        public toggle = (directiveHtmlName: string, scope: angular.IScope) => {
            if (this.currentDirective === directiveHtmlName) {
                this.hide();
                return;
            }
            this.isVisible = true;
            this.currentDirective = directiveHtmlName;
            var html = this.$compile(`<${directiveHtmlName}></${directiveHtmlName}>`)(scope)[0];
            // HM TODO?: remove the need to know the id of the html element.
            angular.element("#sidebarContent").empty().append(html);
        }

        public hide = () => {
            this.isVisible = false;
            this.currentDirective = "";
        }
    }
}