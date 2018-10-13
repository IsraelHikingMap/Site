import { ResourcesService } from "../services/resources.service";

export abstract class BaseMapComponent {
    constructor(public resources: ResourcesService) { }
}
