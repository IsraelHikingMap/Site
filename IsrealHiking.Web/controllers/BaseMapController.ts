namespace IsraelHiking.Controllers {

    export class BaseMapController extends Services.ObjectWithMap {
       
        suppressEvents(e: Event) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
        }
    }
} 