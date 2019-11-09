import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { InputMaskComponent } from './input-mask/input-mask.component';

const EXPORTS = [InputMaskComponent];

@NgModule({
  declarations: [
    ...EXPORTS
  ],
  imports: [
    ReactiveFormsModule
  ],
  exports: [
    ...EXPORTS
  ]
})
export class InputMaskModule { }
