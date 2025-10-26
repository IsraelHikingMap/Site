import { Directive, type AfterViewInit, input, inject } from "@angular/core";
import { type Validator, type AbstractControl, NG_VALIDATORS } from "@angular/forms";

import { LayersService } from "../services/layers.service";

@Directive({
    selector: "[nameInUse]",
    providers: [{ provide: NG_VALIDATORS, useExisting: NameInUseValidatorDirective, multi: true }]
})
export class NameInUseValidatorDirective implements Validator, AfterViewInit {

    public nameInUse = input<string>();
    public isOverlay = input<boolean>();

    private initialKey: string;

    private readonly layersService = inject(LayersService);

    public constructor() { }

    public ngAfterViewInit(): void {
        this.initialKey = this.nameInUse();
    }

    public validate(control: AbstractControl): { [key: string]: any } {
        if (this.layersService.isNameAvailable(this.initialKey, control.value, this.isOverlay())) {
            return null;
        }
        return { nameInUse: control.value };
    }
}
