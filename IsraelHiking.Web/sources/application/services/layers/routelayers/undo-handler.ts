export class UndoHandler<TData> {

    private undoStack: TData[];

    constructor() {
        this.undoStack = [];
    }

    public pop = () => {
        if (this.isUndoDisabled()) {
            return;
        }
        this.undoStack.pop();
    }

    public top = (): TData => {
        return this.undoStack[this.undoStack.length - 1];
    }

    public isUndoDisabled = (): boolean => {
        return this.undoStack.length <= 1;
    }

    public addDataToUndoStack = (data: TData) => {
        this.undoStack.push(data);
    }
}