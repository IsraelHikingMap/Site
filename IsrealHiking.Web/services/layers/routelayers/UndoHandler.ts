namespace IsraelHiking.Services.Layers.RouteLayers {
    export class UndoHandler {

        private undoStack: Common.RouteData[];

        constructor() {
            this.undoStack = [];
        }

        public pop = () => {
            if (this.isUndoDisbaled()) {
                return;
            }
            this.undoStack.pop();
        }

        public top = (): Common.RouteData => {
            return this.undoStack[this.undoStack.length - 1];
        }

        public isUndoDisbaled = (): boolean => {
            return this.undoStack.length <= 1;
        }

        public addDataToUndoStack = (data: Common.RouteData) => {
            this.undoStack.push(data);
        }
    }
}