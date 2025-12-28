import { Directive, AfterViewInit, input, inject } from "@angular/core";
import { Validator, AbstractControl, NG_VALIDATORS } from "@angular/forms";

import { LayersService } from "../services/layers.service";
import { SelectedRouteService } from "../services/selected-route.service";

@Directive({
    selector: "[nameInUse]",
    providers: [{ provide: NG_VALIDATORS, useExisting: NameInUseValidatorDirective, multi: true }]
})
export class NameInUseValidatorDirective implements Validator, AfterViewInit {

    public nameInUse = input<string>();
    public isOverlay = input<boolean>();
    public isRoute = input<boolean>();

    private initialKey: string;

    private readonly layersService = inject(LayersService);
    private readonly selectedRouteService = inject(SelectedRouteService);

    public constructor() { }

    public ngAfterViewInit(): void {
        this.initialKey = this.nameInUse();
    }

    public validate(control: AbstractControl): { [key: string]: any } {
        if (this.initialKey === control.value) {
            return null;
        }
        if (!control.value) {
            return { nameInUse: control.value };
        }
        if (this.isRoute()) {
            if (this.selectedRouteService.isNameAvailable(control.value)) {
                return null;
            }
            return { nameInUse: control.value };
        }
        if (this.layersService.isNameAvailable(this.initialKey, control.value, this.isOverlay())) {
            return null;
        }
        return { nameInUse: control.value };
    }
}
