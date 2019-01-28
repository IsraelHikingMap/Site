import { MapBrowserPointerEvent } from "openlayers";

export class PointerCounterHelper {
    private pointers: string[];

    constructor() {
        this.pointers = [];
    }

    public updatePointers(event: MapBrowserPointerEvent) {
        const id = (event.pointerEvent as any).pointerId.toString();
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