import {
  Component,
  OnInit,
  Input,
  OnChanges,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  SimpleChanges,
  Renderer2,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import Cleave from 'cleave.js';
import { BACKSPACE } from '../keycodes';
import { CleaveOptions } from '../options';

const { NumeralFormatter, DateFormatter, TimeFormatter, PhoneFormatter, CreditCardDetector, Util, DefaultProperties } = Cleave;

interface IPttOnChange {
  rawValue: any;
  value: any;
}

@Component({
  selector: 'ptt-input-mask',
  templateUrl: './input-mask.component.html',
  styleUrls: ['./input-mask.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: InputMaskComponent,
      multi: true
    }
  ]
})
export class InputMaskComponent
  implements OnInit, OnChanges, ControlValueAccessor {
  @Input() value: any;
  @Input() placeholder: string;
  @Input() options: CleaveOptions = {};

  @Output() pttOnFocus = new EventEmitter();
  @Output() pttOnBlur = new EventEmitter();
  @Output() pttOnKeyDown = new EventEmitter();
  @Output() pttOnChange = new EventEmitter<IPttOnChange>();
  @Output() valueChange = new EventEmitter();

  @ViewChild('element', { static: true }) element: ElementRef<HTMLInputElement>;

  displayValue = '';

  isFocus = false;

  // internal props
  properties: CleaveOptions & {
    [key: string]: any;
  } = {};
  isAndroid = false;
  hasBackspaceSupport = true;
  cursorPosition = 0;
  lastInputValue: any;
  rawValue: any;
  // CVA
  isDisabled = false;
  private cvaOnChange = (v: any) => { };
  private cvaOnTouched = (v: any) => { };

  constructor(private renderer: Renderer2) { }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('options' in changes || 'value' in changes) {
      this.properties = DefaultProperties.assign(
        {},
        {
          ...this.options,
          initValue: this.value
        }
      );
      this.init();
    }
    if ('placeholder' in changes || this.placeholder == null) {
      this.placeholder = '';
    }
  }

  setRawValue(value: any) {
    const pps = this.properties;

    value = value !== undefined && value !== null ? value.toString() : '';

    if (pps.numeral) {
      value = value.replace('.', pps.numeralDecimalMark);
    }

    pps.postDelimiterBackspace = false;

    this.processValueChange(value);
  }

  getRawValue(): any {
    const pps = this.properties;
    let rawValue = pps.result;

    if (pps.rawValueTrimPrefix) {
      rawValue = Util.getPrefixStrippedValue(
        rawValue,
        pps.prefix,
        pps.prefixLength,
        pps.result,
        pps.delimiter,
        pps.delimiters
      );
    }

    if (pps.numeral) {
      rawValue = pps.numeralFormatter
        ? pps.numeralFormatter.getRawValue(rawValue)
        : '';
    } else {
      rawValue = Util.stripDelimiters(rawValue, pps.delimiter, pps.delimiters);
    }

    return rawValue;
  }

  getISOFormatDate() {
    const pps = this.properties;

    return pps.date ? pps.dateFormatter.getISOFormatDate() : '';
  }

  getISOFormatTime() {
    const pps = this.properties;
    return pps.time ? pps.timeFormatter.getISOFormatTime() : '';
  }
  // #start DOM event
  onKeyDown(event: KeyboardEvent) {
    const pps = this.properties;
    // tslint:disable-next-line: deprecation
    let charCode = event.which || event.keyCode;

    // if we got any charCode === BACKSPACE, this means, that this device correctly
    // sends backspace keys in event, so we do not need to apply any hacks
    this.hasBackspaceSupport =
      this.hasBackspaceSupport || charCode === BACKSPACE;
    if (
      !this.hasBackspaceSupport &&
      Util.isAndroidBackspaceKeydown(this.lastInputValue, pps.result)
    ) {
      charCode = BACKSPACE;
    }

    // hit backspace when last character is delimiter
    const postDelimiter = Util.getPostDelimiter(
      pps.result,
      pps.delimiter,
      pps.delimiters
    );
    if (charCode === BACKSPACE && postDelimiter) {
      pps.postDelimiterBackspace = postDelimiter;
    } else {
      pps.postDelimiterBackspace = false;
    }

    this.pttOnKeyDown.emit(event);
  }

  onFocus(event: FocusEvent) {
    this.isFocus = true;
    const pps = this.properties;

    const rawValue = this.getRawValue();
    const element = this.element.nativeElement;
    this.renderer.setProperty(element, 'rawValue', rawValue);
    this.renderer.setProperty(element, 'value', pps.result);

    this.rawValue = rawValue;
    this.pttOnFocus.emit(event);

    Util.fixPrefixCursor(
      this.element.nativeElement,
      pps.prefix,
      pps.delimiter,
      pps.delimiters
    );
  }

  onBlur(event: any) {
    this.isFocus = false;
    const pps = this.properties;

    const rawValue = this.getRawValue();
    const element = this.element.nativeElement;
    this.renderer.setProperty(element, 'rawValue', rawValue);
    this.renderer.setProperty(element, 'value', pps.result);

    this.rawValue = rawValue;
    this.pttOnBlur.emit(event);
    this.cvaOnTouched(true);
  }

  onChange(event: Event) {
    const element = this.element.nativeElement;

    this.processValueChange(element.value);
  }

  // #end DOM event

  formatInput(value: any, fromProps = false) {
    const pps = this.properties;

    // case 1: delete one more character "4"
    // 1234*| -> hit backspace -> 123|
    // case 2: last character is not delimiter which is:
    // 12|34* -> hit backspace -> 1|34*
    const postDelimiterAfter = Util.getPostDelimiter(
      value,
      pps.delimiter,
      pps.delimiters
    );
    if (
      !fromProps &&
      !pps.numeral &&
      pps.postDelimiterBackspace &&
      !postDelimiterAfter
    ) {
      value = Util.headStr(
        value,
        value.length - pps.postDelimiterBackspace.length
      );
    }

    // phone formatter
    if (pps.phone) {
      if (pps.prefix && (!pps.noImmediatePrefix || value.length)) {
        pps.result =
          pps.prefix +
          pps.phoneFormatter.format(value).slice(pps.prefix.length);
      } else {
        pps.result = pps.phoneFormatter.format(value);
      }
      this.updateValueState();

      return;
    }

    // numeral formatter
    if (pps.numeral) {
      // Do not show prefix when noImmediatePrefix is specified
      // This mostly because we need to show user the native input placeholder
      if (pps.prefix && pps.noImmediatePrefix && value.length === 0) {
        pps.result = '';
      } else {
        pps.result = pps.numeralFormatter.format(value);
      }
      this.updateValueState();

      return;
    }

    // date
    if (pps.date) {
      value = pps.dateFormatter.getValidatedDate(value);
    }

    // time
    if (pps.time) {
      value = pps.timeFormatter.getValidatedTime(value);
    }

    // strip delimiters
    value = Util.stripDelimiters(value, pps.delimiter, pps.delimiters);

    // strip prefix
    value = Util.getPrefixStrippedValue(
      value,
      pps.prefix,
      pps.prefixLength,
      pps.result,
      pps.delimiter,
      pps.delimiters,
      pps.noImmediatePrefix
    );

    // strip non-numeric characters
    value = pps.numericOnly ? Util.strip(value, /[^\d]/g) : value;

    // convert case
    value = pps.uppercase ? value.toUpperCase() : value;
    value = pps.lowercase ? value.toLowerCase() : value;

    // prevent from showing prefix when no immediate option enabled with empty input value
    if (pps.prefix && (!pps.noImmediatePrefix || value.length)) {
      value = pps.prefix + value;

      // no blocks specified, no need to do formatting
      if (pps.blocksLength === 0) {
        pps.result = value;
        this.updateValueState();

        return;
      }
    }

    // update credit card props
    if (pps.creditCard) {
      this.updateCreditCardPropsByValue(value);
    }

    // strip over length characters
    value = pps.maxLength > 0 ? Util.headStr(value, pps.maxLength) : value;

    // apply blocks
    pps.result = Util.getFormattedValue(
      value,
      pps.blocks,
      pps.blocksLength,
      pps.delimiter,
      pps.delimiters,
      pps.delimiterLazyShow
    );

    this.updateValueState();
  }
  updateValueState() {
    const pps = this.properties;
    const element = this.element.nativeElement;
    if (!element) {
      this.displayValue = pps.result;
      return;
    }

    let endPos = element.selectionEnd;
    const oldValue = element.value;
    const newValue = pps.result;

    this.lastInputValue = newValue;

    endPos = Util.getNextCursorPosition(
      endPos,
      oldValue,
      newValue,
      pps.delimiter,
      pps.delimiters
    );

    if (this.isAndroid) {
      window.setTimeout(() => {
        this.displayValue = newValue;
        // TODO: handle cursorPosition
        this.cursorPosition = endPos;
        setTimeout(() => this.setCursorPosition());
      }, 1);

      return;
    }

    this.displayValue = newValue;
    // TODO: handle cursorPosition
    this.cursorPosition = endPos;
    setTimeout(() => this.setCursorPosition());
  }
  updateCreditCardPropsByValue(value: any) {
    const pps = this.properties;
    let creditCardInfo: any;

    // At least one of the first 4 characters has changed
    if (Util.headStr(pps.result, 4) === Util.headStr(value, 4)) {
      return;
    }

    creditCardInfo = CreditCardDetector.getInfo(
      value,
      pps.creditCardStrictMode
    );

    pps.blocks = creditCardInfo.blocks;
    pps.blocksLength = pps.blocks.length;
    pps.maxLength = Util.getMaxLength(pps.blocks);

    // credit card type changed
    if (pps.creditCardType !== creditCardInfo.type) {
      pps.creditCardType = creditCardInfo.type;

      pps.onCreditCardTypeChanged.call(this, pps.creditCardType);
    }
  }

  // internal
  private init() {
    const pps = this.properties;

    // so no need for this lib at all
    if (
      !pps.numeral &&
      !pps.phone &&
      !pps.creditCard &&
      !pps.time &&
      !pps.date &&
      (pps.blocksLength === 0 && !pps.prefix)
    ) {
      this.formatInput(pps.initValue);
      // .onInit(this); // TODO

      return;
    }

    pps.maxLength = Util.getMaxLength(pps.blocks);

    this.isAndroid = Util.isAndroid();

    this.initPhoneFormatter();
    this.initDateFormatter();
    this.initTimeFormatter();
    this.initNumeralFormatter();

    // avoid touch input field if value is null
    // otherwise Firefox will add red box-shadow for <input required />
    if (pps.initValue || (pps.prefix && !pps.noImmediatePrefix)) {
      this.formatInput(pps.initValue);
    }

    // .onInit(this); // TODO
  }
  private initPhoneFormatter() {
    const pps = this.properties;
    if (!pps.phone) {
      return;
    }

    // Cleave.AsYouTypeFormatter should be provided by
    // external google closure lib
    try {
      pps.phoneFormatter = new PhoneFormatter(
        new pps.root.Cleave.AsYouTypeFormatter(pps.phoneRegionCode),
        pps.delimiter
      );
    } catch (ex) {
      throw new Error('Please include phone-type-formatter.{country}.js lib');
    }
  }
  private initDateFormatter() {
    const pps = this.properties;
    if (!pps.date) {
      return;
    }

    pps.dateFormatter = new DateFormatter(
      pps.datePattern,
      pps.dateMin,
      pps.dateMax
    );
    pps.blocks = pps.dateFormatter.getBlocks();
    pps.blocksLength = pps.blocks.length;
    pps.maxLength = Util.getMaxLength(pps.blocks);
  }
  private initTimeFormatter() {
    const pps = this.properties;
    if (!pps.time) {
      return;
    }

    pps.timeFormatter = new TimeFormatter(pps.timePattern, pps.timeFormat);
    pps.blocks = pps.timeFormatter.getBlocks();
    pps.blocksLength = pps.blocks.length;
    pps.maxLength = Util.getMaxLength(pps.blocks);
  }
  private initNumeralFormatter() {
    const pps = this.properties;

    if (!pps.numeral) {
      return;
    }

    pps.numeralFormatter = new NumeralFormatter(
      pps.numeralDecimalMark,
      pps.numeralIntegerScale,
      pps.numeralDecimalScale,
      pps.numeralThousandsGroupStyle,
      pps.numeralPositiveOnly,
      pps.stripLeadingZeroes,
      pps.prefix,
      pps.signBeforePrefix,
      pps.delimiter
    );
  }

  private setCursorPosition() {
    const pps = this.properties;
    const element = this.element.nativeElement;
    if (element && this.isFocus) {
      Util.setSelection(element, this.cursorPosition, pps.document);
    }
  }

  private processValueChange(value: any) {
    const element = this.element.nativeElement;
    const pps = this.properties;
    this.formatInput(value);

    const rawValue = this.getRawValue();
    this.renderer.setProperty(element, 'rawValue', rawValue);
    this.renderer.setProperty(element, 'value', pps.result);
    this.displayValue = pps.result;
    this.rawValue = rawValue;

    this.valueChange.emit(rawValue);
    this.pttOnChange.emit({
      rawValue,
      value: this.displayValue,
    });
    this.cvaOnChange(rawValue);
  }

  // ControlValueAccessor
  writeValue(obj: any): void {
    this.value = obj;
    this.setRawValue(this.value);
  }
  registerOnChange(fn: any): void {
    this.cvaOnChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.cvaOnTouched = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }
}
