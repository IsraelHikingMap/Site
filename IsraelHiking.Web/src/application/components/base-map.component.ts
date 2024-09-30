import { ResourcesService } from "../services/resources.service";

// HM TODO: remove me!!
export abstract class BaseMapComponent {
    constructor(public resources: ResourcesService) { }
}
