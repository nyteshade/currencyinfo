# CurrencyInfo

A powerful and flexible JavaScript library for handling currency formatting, detection, and localization.

## Features

- Currency formatting based on locale
- Currency detection from formatted strings
- Support for multiple currencies and locales
- Caching mechanism for improved performance
- Built on native `Intl` APIs for broad compatibility

## Installation

```bash
npm install currencyinfo

## Usage

### Basic Usage

```js
import { CurrencyInfo } from 'currencyinfo';

// Format currency
const usd = CurrencyInfo.USD;
console.log(usd.format(1234.56)); // '$1,234.56'

// Strip formatting
console.log(usd.strip('$1,234.56')); // 1234.56

// Detect currency and locale
const detected = CurrencyInfo.detect('1 234,56 €');
console.log(detected.locale); // 'fr-FR'
console.log(detected.currencyInfo.currency); // 'EUR'
```

### Creating Custom Instances

```js
const gbp = new CurrencyInfo('GBP', 'en-GB');
console.log(gbp.format(1234.56)); // '£1,234.56'
```

### Currency Detection

Basic detection looks for USD and CAD currencies in 
US and CA, for en, es, and fr languages. When detecting
with these defaults, you need simply pass in a string
to attempt detection

```js
const result = CurrencyInfo.detect('$1.00')
console.log(result.locale) // en-US
console.log(result.currency) // USD
```

However the language, country and currency combinations
are configurable

```js
const result = CurrencyInfo.detect('$1,234.56', {
  currencies: ['USD', 'CAD', 'AUD'],
  languages: ['en'],
  countries: ['US', 'CA', 'AU']
});
console.log(result.locale); // 'en-US'
console.log(result.currencyInfo.currency); // 'USD'
```

While `.detect()` does accept number primitives, there
isn't enough to go on in such cases. If you don't know
if your value is a string or a number, you can provide
an assume configuration. It can take either an instance
of `CurrencyInfo` or an object with the keys for locale
and currency, such as `{ locale: "en-US", currency: "USD" }`

```js
console.log(CurrencyInfo.detect(1)) // null

// here we use the static en-US USD CurrencyInfo instance
let result = CurrencyInfo.detect(1, { assume: CurrencyInfo.USD })
console.log(result?.locale) // 'en-US'
console.log(result?.currency) // 'USD'

// the result would be the same with
let result = CurrencyInfo.detect(1, { assume: {
  locale: 'en-US',
  currency: 'USD' 
}})
```

## API

`CurrencyInfo`

### Constructor

 - `new CurrencyInfo(currency: string, locale: string, doNotThrow?: boolean)`
 
### Static Methods

 - `checkForInputErrors(currency: string, locale?: string): error[]`
 - `detect(formatted: string, options?: DetectOptions): DetectResult`
 - `get(currency: string, locale: string, doNotThrow?: boolean): CurrencyInfo`
 - `isCurrencyInfo(value: any): boolean`
 - `validateCurrency(currency: string): boolean | TypeError`
 - `validateLocale(locale: string): boolean | RangeError`
 - `validateRuntime(): boolean | Error`

### Instance Methods

 - `format(value: number): string`
 - `strip(formatted: string): number`

### Properties

 - `currency: string`
 - `locale: string`
 - `separators: { group: string, decimal: string, symbol: string }``
 - `symbol: { position: string, locator: Function }``

### Pre-configured Instances

 - `CurrencyInfo.USD`: US Dollars (en-US)
 - `CurrencyInfo.CAD`: Canadian Dollars (fr-CA)
 - `CurrencyInfo.enCAD`: Canadian Dollars (en-CA)
 - `CurrencyInfo.frCAD`: Canadian Dollars (fr-CA)

## Browser Support

This library use the built-in `Intl` API, which is supported in all modern browsers.
For older browsers, you may need to use a polyfill. If you do not, an error will be
raised when attemting to use the class.

## License

MIT

## Contributing

Contributors are welcome! Please submit a Pull Request.

