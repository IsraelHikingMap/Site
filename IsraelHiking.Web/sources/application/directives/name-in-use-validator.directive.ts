import { Directive, Input, AfterViewInit } from "@angular/core";
import { Validator, AbstractControl, NG_VALIDATORS } from "@angular/forms";

import { LayersService } from "../services/layers/layers.service";

@Directive({
    selector: "[nameInUse]",
    providers: [{ provide: NG_VALIDATORS, useExisting: NameInUseValidatorDirective, multi: true }]
})
export class NameInUseValidatorDirective implements Validator, AfterViewInit {

    @Input()
    public nameInUse: string;

    @Input()
    public isOverlay: boolean;

    private initialKey: string;

    public constructor(private readonly layersService: LayersService) { }

    public ngAfterViewInit(): void {
        this.initialKey = this.nameInUse;
    }

    public validate(control: AbstractControl): { [key: string]: any } {
        if (this.layersService.isNameAvailable(this.initialKey, control.value, this.isOverlay)) {
            return null;
        }
        return { "nameInUse": control.value };
    }
}