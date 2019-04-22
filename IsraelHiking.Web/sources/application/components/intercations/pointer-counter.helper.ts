export class PointerCounterHelper {
    private pointers: string[];

    constructor() {
        this.pointers = [];
    }
    // HM TODO: finsih this
    public updatePointers(event: any) {
        if (!event.pointerEvent || !(event.pointerEvent as any).pointerId) {
            return;
        }
        let id = (event.pointerEvent as any).pointerId.toString();
        if (event.type === "pointerdown") {
            if (this.pointers.indexOf(id) === -1) {
                this.pointers.push(id);
            }
        } else if (event.type === "pointerup") {
            this.pointers.splice(this.pointers.indexOf(id), 1);
        }
    }

    public getPointersCount() {
        return this.pointers.length;
    }
}