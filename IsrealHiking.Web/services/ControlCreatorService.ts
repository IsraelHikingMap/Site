module IsraelHiking.Services {
    export class ControlCreatorService {
        $rootScope: angular.IRootScopeService;
        $compile: angular.ICompileService;

        constructor($rootScope: angular.IRootScopeService, $compile: angular.ICompileService) {
            this.$rootScope = $rootScope;
            this.$compile = $compile;
        }

        public create = (map: L.Map, directiveHtmlName: string, position = "topleft") => {
            var control = L.Control.extend(<L.ClassExtendOptions>{
                options: <L.ControlOptions> {
                    position: position
                },
                onAdd: (map: L.Map): HTMLElement => {
                    var containerClassName = directiveHtmlName + "-container";
                    var container = L.DomUtil.create("div", containerClassName);
                    container.appendChild(this.$compile("<" + directiveHtmlName + "></" + directiveHtmlName + ">")(this.$rootScope.$new())[0]);
                    return container;
                },
                onRemove: () => { }
            });
            (new control()).addTo(map);
        }

        //private createScope = (service: Controllers.IMapController): angular.IScope => {
        //    var newScope = this.$rootScope.$new();
        //    service.setScope(newScope);
        //    angular.extend(newScope, service);
        //    return newScope;
        //}
    }
} 