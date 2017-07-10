import { ResourcesService } from "../services/resources.service";

export abstract class BaseMapComponent {
    constructor(public resources: ResourcesService) { }

    suppressEvents(e: Event) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
    }
}
