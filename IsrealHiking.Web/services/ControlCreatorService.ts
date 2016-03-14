module IsraelHiking.Services {

    /**
     * This service allows the creation of leaflet controls on the map
     */
    export class ControlCreatorService extends ObjectWithMap {
        $rootScope: angular.IRootScopeService;
        $compile: angular.ICompileService;

        constructor($rootScope: angular.IRootScopeService,
            $compile: angular.ICompileService,
            mapService: MapService) {
            super(mapService);
            this.$rootScope = $rootScope;
            this.$compile = $compile;
        }

        /**
         * Creates a control on the leaflet map
         * 
         * @param directiveHtmlName - the dricetive html string
         * @param position - the position to place the control: topleft/topright/bottomleft/bottomright
         */
        public create(directiveHtmlName: string, position = "topleft") {
            var control = L.Control.extend({
                options: {
                    position: position
                } as L.ControlOptions,
                onAdd: (): HTMLElement => {
                    var controlDiv = angular.element("<div>")
                        .addClass(directiveHtmlName + "-container")
                        .append(this.$compile(`<${directiveHtmlName}></${directiveHtmlName}>`)(this.$rootScope.$new()));
                    return controlDiv[0];
                },
                onRemove: () => { }
            } as L.ClassExtendOptions);
            new control().addTo(this.map);
        }
    }
} 