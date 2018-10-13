import { MapBrowserEvent, interaction } from "openlayers";

export class DragInteraction extends interaction.Pointer {

    private dragging: boolean;

    constructor(private readonly action: () => void) {
        super({
            handleEvent: (e) => this.handleDrag(e)
        });
        this.dragging = false;
    }

    private handleDrag = (event: MapBrowserEvent) => {
        switch (event.type) {
            case "pointerdrag":
                this.dragging = true;
                break;
            case "pointerup":
                if (this.dragging) {
                    this.action();
                }
                break;
        }
        return true;
    }
}