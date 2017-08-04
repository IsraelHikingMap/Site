import { UndoHandler } from "./undo-handler";

describe("UndoHandler", () => {
    it("Should be created disable", () => {
        let undoHandler = new UndoHandler<number>();

        expect(undoHandler.isUndoDisbaled).toBeTruthy();
    });

    it("Should be created disable", () => {
        let undoHandler = new UndoHandler<number>();

        expect(undoHandler.isUndoDisbaled()).toBeTruthy();
    });

    it("Should facilitate adding data", () => {
        let undoHandler = new UndoHandler<number>();

        undoHandler.addDataToUndoStack(42);
        undoHandler.addDataToUndoStack(7);
        
        expect(undoHandler.isUndoDisbaled()).toBeFalsy();
        expect(undoHandler.top()).toBe(7);
    });

    it("Should facilitate removing data", () => {
        let undoHandler = new UndoHandler<number>();

        undoHandler.addDataToUndoStack(42);
        undoHandler.addDataToUndoStack(7);
        undoHandler.pop();

        expect(undoHandler.top()).toBe(42);
    });

    it("Should keep the last item in the undo stack", () => {
        let undoHandler = new UndoHandler<number>();

        undoHandler.addDataToUndoStack(42);
        undoHandler.pop();
        undoHandler.pop();
        undoHandler.pop();

        expect(undoHandler.top()).toBe(42);
    });
});