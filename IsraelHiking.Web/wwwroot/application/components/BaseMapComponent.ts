import { ResourcesService } from "../services/ResourcesService";

export abstract class BaseMapComponent {
    constructor(public resources: ResourcesService) { }

    suppressEvents(e: Event) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
    }
}
