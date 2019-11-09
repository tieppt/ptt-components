import {
  Component,
  OnInit,
  Input,
  OnChanges,
  ViewChild,
  ElementRef,
  AfterViewChecked
} from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';
import * as NumeralFormatter from 'cleave.js/src/shortcuts/NumeralFormatter';
import * as DateFormatter from 'cleave.js/src/shortcuts/DateFormatter';
import * as TimeFormatter from 'cleave.js/src/shortcuts/TimeFormatter';
import * as PhoneFormatter from 'cleave.js/src/shortcuts/PhoneFormatter';
import * as CreditCardDetector from 'cleave.js/src/shortcuts/CreditCardDetector';
import * as Util from 'cleave.js/src/utils/Util';
import * as DefaultProperties from 'cleave.js/src/common/DefaultProperties';
import { LEFT_ARROW, RIGHT_ARROW, BACKSPACE } from '../keycodes';

@Component({
  selector: 'ptt-input-mask',
  templateUrl: './input-mask.component.html',
  styleUrls: ['./input-mask.component.scss']
})
export class InputMaskComponent
  implements OnInit, OnChanges, AfterViewChecked, ControlValueAccessor {
  @Input() value: any;

  @Input() options: {
    [key: string]: any;
  } = {};

  @ViewChild('element', { static: true }) element: ElementRef<HTMLInputElement>;

  displayValue = '';

  isFocus = false;

  // internal props
  properties: {
    [key: string]: any;
  } = {};
  isAndroid = false;
  hasBackspaceSupport = true;
  // cursorPosition = 0;
  lastInputValue: any;
  rawValue: any;

  constructor() {}

  ngOnInit() {
    this.init();
    console.log(this);
  }

  ngOnChanges() {
    this.properties = DefaultProperties.assign(
      {},
      {
        ...this.options,
        initValue: this.value
      }
    );
  }

  ngAfterViewChecked() {
    // TODO: handle cursorPosition
    // const pps = this.properties;
    // const element = this.element.nativeElement;
    // if (element && this.isFocus) {
    //   Util.setSelection(element, this.cursorPosition, pps.document);
    // }
  }

  setRawValue(value: any) {
    const pps = this.properties;

    value = value !== undefined && value !== null ? value.toString() : '';

    if (pps.numeral) {
      value = value.replace('.', pps.numeralDecimalMark);
    }

    pps.postDelimiterBackspace = false;

    // this.onChange({
    //   target: { value },

    //   // Methods to better resemble a SyntheticEvent
    //   stopPropagation: Util.noop,
    //   preventDefault: Util.noop,
    //   persist: Util.noop
    // });
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

    // TODO: handle cursorPosition
    // if (charCode === LEFT_ARROW) {
    //   this.cursorPosition--;
    //   if (this.cursorPosition < 0) {
    //     this.cursorPosition = 0;
    //   }
    // } else if (charCode === RIGHT_ARROW) {
    //   this.cursorPosition++;
    // }

    // .onKeyDown(event);
  }

  onFocus(event: any) {
    this.isFocus = true;
    const pps = this.properties;

    const rawValue = this.getRawValue();
    event.target.rawValue = rawValue;
    event.target.value = pps.result;

    this.rawValue = rawValue;

    // .onFocus(event);

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
    event.target.rawValue = rawValue;
    event.target.value = pps.result;

    this.rawValue = rawValue;

    // .registeredEvents.onBlur(event);
  }

  onChange(event: any) {
    const pps = this.properties;

    this.formatInput(event.target.value);

    const rawValue = this.getRawValue();
    event.target.rawValue = rawValue;
    event.target.value = pps.result;

    this.rawValue = rawValue;

    // .onChange(event);
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
        // this.cursorPosition = endPos;
      }, 1);

      return;
    }

    this.displayValue = newValue;
    // TODO: handle cursorPosition
    // this.cursorPosition = endPos;
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

  // ControlValueAccessor
  writeValue(obj: any): void {
    // throw new Error('Method not implemented.');
  }
  registerOnChange(fn: any): void {
    // throw new Error('Method not implemented.');
  }
  registerOnTouched(fn: any): void {
    // throw new Error('Method not implemented.');
  }
  setDisabledState?(isDisabled: boolean): void {
    // throw new Error('Method not implemented.');
  }
}
