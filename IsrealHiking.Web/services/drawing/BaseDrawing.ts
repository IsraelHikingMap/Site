module IsraelHiking.Services.Drawing {
    export class DrawingState {
        public static active = "active";
        public static inactive = "inactive";
        public static hidden = "hidden";
    }

    export interface IDrawing {
        state: string;
        name: string;
        getColor: () => string;
        changeStateTo: (state: string) => void;
        undo: () => void;
        enable(enable: boolean): void;
        isEnabled: () => boolean;
        clear: () => void;
        getRoutingType: () => string;
        setRoutingType: (routingType: string) => void;
        isUndoDisbaled: () => boolean;
    }


    export abstract class BaseDrawing<TData> extends ObjectWithMap implements IDrawing {

        private dataStack: TData[];
        protected hashService: HashService;
        protected enabled: boolean;

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
        public getColor = (): string => { throw new Error("Should be implemented in derrived class") }
        // should be override in derived
        public getColorKeyValue = (): { key: string, value: string } => { throw new Error("Should be implemented in derrived class") }
        // should be override in derived
        public changeStateTo = (targetState: string) => { throw new Error("Should be implemented in derrived class") }
        // should be override in derived
        public getData = (): TData => { throw new Error("Should be implemented in derrived class") }
        // should be override in derived
        public setData = (data: TData): void => { throw new Error("Should be implemented in derrived class") }

        public isEnabled = (): boolean => {
            return this.enabled && this.state === DrawingState.active;
        }

        // should be override in derived
        public enable = (enable: boolean): void => { throw new Error("Should be implemented in derrived class") }
        // should be override in derived
        public clear = () => { throw new Error("Should be implemented in derrived class") }

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
        }

        public isUndoDisbaled = (): boolean => {
            return this.dataStack.length <= 1;
        }

        protected addDataToStack = (data: TData) => {
            this.dataStack.push(data);
        }
    }
} 