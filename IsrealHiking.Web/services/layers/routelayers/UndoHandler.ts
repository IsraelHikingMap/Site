namespace IsraelHiking.Services.Layers.RouteLayers {
    export class UndoHandler<TData> {

        private undoStack: TData[];

        constructor() {
            this.undoStack = [];
        }

        public pop = () => {
            if (this.isUndoDisbaled()) {
                return;
            }
            this.undoStack.pop();
        }

        public top = (): TData => {
            return this.undoStack[this.undoStack.length - 1];
        }

        public isUndoDisbaled = (): boolean => {
            return this.undoStack.length <= 1;
        }

        public addDataToUndoStack = (data: TData) => {
            this.undoStack.push(data);
        }
    }
}