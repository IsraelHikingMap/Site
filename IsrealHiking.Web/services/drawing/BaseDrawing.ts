module IsraelHiking.Services.Drawing {
    export class DrawingState {
        public static active = "active";
        public static inactive = "inactive";
        public static hidden = "hidden";
    }

    export interface IDrawing {
        state: string;
        name: string;
        activate: () => void;
        deactivate: () => void;
        getColor: () => string;
        hide: () => void;
        show: () => void;
        undo: () => void;
        enable(enable: boolean): void;
        isEnabled: () => boolean;
        clear: () => void;
        getRoutingType: () => string;
        setRoutingType: (routingType: string) => void;
        isUndoDisbaled: () => boolean;
    }


    export class BaseDrawing<TData> extends ObjectWithMap implements IDrawing {

        private dataStack: TData[];
        protected hashService: HashService;

        public state: string;
        public name: string;

        constructor(mapService: MapService,
            hashService: HashService) {
            super(mapService);
            this.name = "";
            this.state = DrawingState.inactive;
            this.dataStack = [];
            this.hashService = hashService;
        }

        // should be override in derived
        public activate = (): void => { }
        // should be override in derived
        public deactivate = (): void => { }
        // should be override in derived
        public getColor = (): string => { return "" }
        // should be override in derived
        public hide = (): void => { }
        // should be override in derived
        public show = (): void => { }
        // should be override in derived
        public getData = (): TData => { return null; }
        // should be override in derived
        public setData = (data: TData): void => { }

        public isEnabled = (): boolean => {
            return this.state == DrawingState.active;
        }
        // should be override in derived
        public enable = (enable: boolean): void => { }
        // should be override in derived
        public clear = () => { }

        // should be override in derived
        public getRoutingType = (): string => {
            return Common.RoutingType.none;
        }

        // should be override in derived
        public setRoutingType = (routingType: string) => { };

        public undo = () => {
            if (this.isUndoDisbaled()) {
                return;
            }
            this.dataStack.pop();
            this.setData(this.dataStack[this.dataStack.length - 1]);
            this.postUndoHook();
        }

        public isUndoDisbaled = (): boolean => {
            return this.dataStack.length <= 1;
        }

        protected addDataToStack = (data: TData) => {
            this.dataStack.push(data);
        }

        // should be override in derived
        protected postUndoHook = () => { }
    }
} 